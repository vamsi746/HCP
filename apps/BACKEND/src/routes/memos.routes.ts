import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Memo, MemoStatus, DSR, Officer, PoliceStation, Zone, Division, Circle, SectorOfficer } from '../models';
import { Sector } from '../models/Sector';
import { authenticate } from '../middleware/auth';

const router = Router();

// ── Template Generation ──────────────────────────────────────────────────────

type MemoTemplateValues = Record<string, string>;

function normalizeWhitespace(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateParts(date: Date, separator: '-' | '.'): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}${separator}${mm}${separator}${yyyy}`;
}

function parseLooseDate(value: unknown): Date | null {
  const raw = normalizeWhitespace(value);
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function formatDateString(value: unknown, fallbackDate: Date, separator: '-' | '.'): string {
  const parsed = parseLooseDate(value);
  return formatDateParts(parsed || fallbackDate, separator);
}

function buildOffenceTitle(caseData: any): string {
  const primary = normalizeWhitespace(caseData.natureOfCase || caseData.crimeHead || caseData.socialViceType || '');
  return primary || 'illegal activity';
}

function buildOffenceActivity(offenceTitle: string): string {
  const lower = offenceTitle.toLowerCase();
  if (lower.includes('food') || lower.includes('adulterat') || lower.includes('edible') || lower.includes('oil')) {
    return 'food adulteration and illegal edible product manufacturing';
  }
  if (lower.includes('ndps') || lower.includes('ganja') || lower.includes('drug') || lower.includes('narcotic')) {
    return 'narcotic drug offences';
  }
  if (lower.includes('liquor') || lower.includes('excise') || lower.includes('arrack') || lower.includes('toddy')) {
    return 'illicit liquor offences';
  }
  if (lower.includes('gambl') || lower.includes('betting') || lower.includes('matka')) {
    return 'gambling and betting offences';
  }
  if (lower.includes('prostitut') || lower.includes('immoral traffic')) {
    return 'immoral traffic offences';
  }
  return offenceTitle;
}

function buildToBlock(psName: string, recipientName?: string, recipientDesignation?: string): string {
  const safePs = escapeHtml(normalizeWhitespace(psName) || '________');
  if (recipientName) {
    const safeName = escapeHtml(normalizeWhitespace(recipientName));
    const safeDesignation = escapeHtml(normalizeWhitespace(recipientDesignation) || 'Inspector of Police');
    return `<p>To</p>\n<p>Sri. ${safeName}, ${safeDesignation},</p>\n<p>${safePs} P.S, Hyderabad.</p>\n<p>&nbsp;</p>`;
  }
  return `<p>To</p>\n<p>The Inspector of Police/SHO,</p>\n<p>${safePs} P.S, Hyderabad.</p>\n<p>&nbsp;</p>`;
}

function renderMemoTemplate(template: string, values: MemoTemplateValues): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => values[key] ?? '');
}

function replaceToBlock(content: string, toBlock: string): string {
  const toUntilCopyRegex = /<p>\s*To\s*<\/p>[\s\S]*?(?=<p>\s*Copy:\s*<\/p>)/i;
  if (toUntilCopyRegex.test(content)) {
    return content.replace(toUntilCopyRegex, `${toBlock}\n`);
  }

  const legacyToRegex = /<p>To<\/p>\s*(?:<p>[^<]+,<\/p>\s*)?<p>The (?:Inspector of Police\/SHO|Sub-Inspector of Police),<\/p>\s*<p>[^<]*PS, Hyderabad,<\/p>/i;
  if (legacyToRegex.test(content)) {
    return content.replace(legacyToRegex, toBlock.trim());
  }

  return content;
}

function ensureMemoFooterGrouping(content: string): string {
  const source = String(content || '');
  if (!source) return source;
  if (source.includes('memo-footer-block')) {
    return source.replace(/<div class="memo-page-break"><\/div>\s*(?=<div class="memo-footer-block">)/ig, '');
  }

  const footerTailRegex = /(<p[^>]*text-align:\s*right[^>]*>\s*Commissioner of Police,\s*<\/p>\s*<p[^>]*text-align:\s*right[^>]*>\s*Hyderabad City\s*<\/p>\s*<p>\s*&nbsp;\s*<\/p>\s*<p>\s*To\s*<\/p>[\s\S]*)$/i;
  if (!footerTailRegex.test(source)) return source;

  return source.replace(footerTailRegex, (tail) => {
    const withSignature = tail.replace(
      /(<p[^>]*text-align:\s*right[^>]*>\s*Commissioner of Police,\s*<\/p>\s*<p[^>]*text-align:\s*right[^>]*>\s*Hyderabad City\s*<\/p>)/i,
      '<div class="memo-signature-block">$1</div>'
    );
    const withDispatch = withSignature.replace(
      /(<p>\s*To\s*<\/p>[\s\S]*)$/i,
      '<div class="memo-dispatch-block">$1</div>'
    );
    return `<div class="memo-footer-block">${withDispatch}</div>`;
  });
}

function generateMemoHTML(caseData: any, psName: string, zoneName: string, divisionName: string, memoDate: Date): string {
  const crNo = normalizeWhitespace(caseData.crNo) || '___/____';
  const sections = normalizeWhitespace(caseData.sections) || '___';
  const memoDateDisplay = formatDateParts(memoDate, '-');
  const refDateDisplay = formatDateString(caseData.dor, memoDate, '.');

  const offenceTitle = buildOffenceTitle(caseData);
  const offenceDescription = offenceTitle.replace(/\.\s*$/, '');
  const offenceActivity = buildOffenceActivity(offenceTitle);
  const briefFacts = normalizeWhitespace(caseData.briefFacts || '');
  const isFoodRelated = /(food|adulterat|oil|edible|animal fat)/i.test(`${offenceTitle} ${briefFacts}`);
  const publicSafetySentence = isFoodRelated
    ? 'This activity is dangerous to public health and shows the need for better vigilance and effective intelligence to prevent such offences.'
    : 'This activity shows the need for better vigilance and effective intelligence to prevent such offences.';
  const coordinationDepartment = isFoodRelated
    ? 'Food Safety and other concerned departments'
    : 'other concerned departments';

  const template = `<p style="text-align: center"><strong>GOVERNMENT OF TELANGANA</strong></p>
<p style="text-align: center"><strong>POLICE DEPARTMENT</strong></p>
<p>&nbsp;</p>
<p style="text-align: right">Office of the,</p>
<p style="text-align: right">Commissioner of Police,</p>
<p style="text-align: right">Hyderabad City</p>
<p><span style="display:inline-block;width:60%;vertical-align:top">No. {{memoNumber}}</span><span style="display:inline-block;width:39%;text-align:right;vertical-align:top">Dated: {{memoDate}}</span></p>
<p style="text-align: center"><strong><u>MEMO</u></strong></p>
<p><strong>Sub:</strong> Hyderabad City Police - Failure to prevent {{offenceTitle}} - Explanation called for - Regarding.</p>
<p><strong>Ref:</strong> Crime No. {{crNo}} u/s {{sections}} of {{psName}} PS, dated {{refDate}}.</p>
<p style="text-align: center">* * * * *</p>
<p style="text-align: justify">A case has been reported vide Cr.No.{{crNo}}, which falls under in your PS limits pertaining to {{offenceDescription}}. {{publicSafetySentence}}</p>
<p style="text-align: justify">The following certain instructions are issued for strict compliance:</p>
<ol style="margin:0 0 0 26px;padding:0">
  <li>Develop a reliable informer network to gather information about {{offenceActivity}} in your jurisdiction.</li>
  <li>Maintain a close watch on suspected manufacturing units, storage places, warehouses, and any suspicious locations.</li>
  <li>Conduct regular surprise inspections and raids on suspected illegal units.</li>
  <li>Coordinate actively with {{coordinationDepartment}} for information and action.</li>
  <li>Keep continuous surveillance on habitual offenders and known persons involved in {{offenceActivity}}.</li>
  <li>Take preventive action against suspects under relevant legal provisions.</li>
  <li>Ensure proper supervision of Patrol cars and Blue Colts staff and responsibility in detecting such offences.</li>
</ol>
<p style="text-align: justify">It is observed that, being a Station House Officer there was failure to detect and prevent the illegal activity at an earlier stage, which shows a lack of proper observance, intelligence gathering and supervisory control.</p>
<p style="text-align: justify">Therefore, you are hereby instructed to submit your explanation for the above lapse within three (3) days from the date of receipt of this memo. Failing which, it will be presumed that you have no explanation to offer and appropriate disciplinary action will be initiated against you.</p>
<div class="memo-footer-block">
  <p>&nbsp;</p>
  <div class="memo-signature-block">
    <p style="text-align: right">Commissioner of Police,</p>
    <p style="text-align: right">Hyderabad City</p>
  </div>
  <p>&nbsp;</p>
  <div class="memo-dispatch-block">
    {{toBlock}}
    <p>Copy:</p>
    <p>1. The ACP, {{divisionLabel}} for information and necessary action.</p>
    <p>2. The DCP, {{zoneLabel}} for information and necessary action.</p>
  </div>
</div>`;

  return renderMemoTemplate(template, {
    memoNumber: '___________',
    memoDate: escapeHtml(memoDateDisplay),
    offenceTitle: escapeHtml(offenceTitle),
    crNo: escapeHtml(crNo),
    sections: escapeHtml(sections),
    psName: escapeHtml(psName),
    refDate: escapeHtml(refDateDisplay),
    offenceDescription: escapeHtml(offenceDescription),
    publicSafetySentence: escapeHtml(publicSafetySentence),
    offenceActivity: escapeHtml(offenceActivity),
    coordinationDepartment: escapeHtml(coordinationDepartment),
    divisionLabel: escapeHtml(divisionName ? `${divisionName} Division, Hyderabad` : '________ Division, Hyderabad'),
    zoneLabel: escapeHtml(zoneName ? `${zoneName} Zone, Hyderabad` : '________ Zone, Hyderabad'),
    toBlock: buildToBlock(psName),
  });
}

// ── POST /api/memos/generate — Generate memo from a DSR parsed case ─────────

router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { dsrId, caseId } = req.body;
    if (!dsrId || !caseId) {
      res.status(400).json({ error: 'dsrId and caseId are required' });
      return;
    }

    // Check if memo already exists for this case — delete and regenerate
    const existing = await Memo.findOne({ dsrId, caseId });
    if (existing) {
      await Memo.deleteOne({ _id: existing._id });
    }

    // Get DSR with populated case data
    const dsr = await DSR.findById(dsrId)
      .populate('parsedCases.matchedPSId', 'name code circleId')
      .populate('parsedCases.matchedZoneId', 'name code')
      .lean() as any;

    if (!dsr) {
      res.status(404).json({ error: 'DSR not found' });
      return;
    }

    // Find the specific case
    const parsedCase = dsr.parsedCases?.find((c: any) => c._id.toString() === caseId);
    if (!parsedCase) {
      res.status(404).json({ error: 'Case not found in DSR' });
      return;
    }

    // Resolve PS, Zone, Division names
    const psName = parsedCase.policeStation || 'Unknown PS';
    let zoneName = '';
    let divisionName = '';

    if (parsedCase.matchedZoneId && typeof parsedCase.matchedZoneId === 'object') {
      zoneName = parsedCase.matchedZoneId.name?.replace(/\s*Zone$/i, '') || '';
    }

    // Walk up: PS → Circle → Division
    if (parsedCase.matchedPSId && typeof parsedCase.matchedPSId === 'object') {
      const ps = await PoliceStation.findById(parsedCase.matchedPSId._id).populate('circleId').lean() as any;
      if (ps?.circleId) {
        const circle = await Circle.findById(ps.circleId._id || ps.circleId).lean() as any;
        if (circle?.divisionId) {
          const division = await Division.findById(circle.divisionId).lean() as any;
          if (division) {
            divisionName = division.name?.replace(/\s*Division$/i, '') || '';
            if (!zoneName && division.zoneId) {
              const zone = await Zone.findById(division.zoneId).lean() as any;
              if (zone) zoneName = zone.name?.replace(/\s*Zone$/i, '') || '';
            }
          }
        }
      }
    }

    // Use DSR raided date (not current date)
    const memoDate = dsr.date ? new Date(dsr.date) : new Date();
    const offenceTitle = buildOffenceTitle(parsedCase);
    const subject = `Hyderabad City Police - Failure to prevent ${offenceTitle} - Explanation called for - Regarding.`;
    const reference = `Crime No. ${parsedCase.crNo || '___'} u/s ${parsedCase.sections || '___'} of ${psName} PS, dated ${formatDateString(parsedCase.dor, memoDate, '.')}.`;

    // Generate HTML content
    const content = generateMemoHTML(parsedCase, psName, zoneName, divisionName, memoDate);

    // Create memo
    const memo = await Memo.create({
      dsrId,
      caseId,
      date: memoDate,
      subject,
      reference,
      content,
      crimeNo: parsedCase.crNo,
      sections: parsedCase.sections,
      policeStation: psName,
      psId: typeof parsedCase.matchedPSId === 'object' ? parsedCase.matchedPSId._id : parsedCase.matchedPSId,
      zone: zoneName,
      zoneId: typeof parsedCase.matchedZoneId === 'object' ? parsedCase.matchedZoneId._id : parsedCase.matchedZoneId,
      briefFacts: parsedCase.briefFacts,
      status: MemoStatus.DRAFT,
      generatedBy: req.user!.id,
      generatedAt: memoDate,
      recipientPS: psName,
      copyTo: [
        { designation: 'ACP', name: '', unit: divisionName ? `${divisionName} Division, Hyderabad` : '________ Division, Hyderabad' },
        { designation: 'DCP', name: '', unit: zoneName ? `${zoneName} Zone, Hyderabad` : '________ Zone, Hyderabad' },
      ],
    });

    res.status(201).json({ data: memo });
  } catch (err: any) {
    console.error('[MEMO] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate memo' });
  }
});

// ── GET /api/memos/case-officers/:psId — Get SI and SHO for a PS ────────────

router.get('/case-officers/:psId', authenticate, async (req: Request, res: Response) => {
  try {
    const sectors = await Sector.find({ policeStationId: req.params.psId }).lean();
    if (sectors.length === 0) {
      res.json({ data: { si: null, sho: null } });
      return;
    }

    const sectorOfficers = await SectorOfficer.find({
      sectorId: { $in: sectors.map((s: any) => s._id) },
      role: 'PRIMARY_SI',
      isActive: true,
    }).lean();

    let sho: any = null;
    let si: any = null;

    for (const so of sectorOfficers) {
      const off = await Officer.findById(so.officerId).select('name badgeNumber rank phone remarks').lean();
      if (!off) continue;
      const remarks = (off.remarks || '').toLowerCase();
      if (remarks.includes('admin') && !sho) {
        sho = off;
      } else if (!si) {
        const hasDigit = /\d/.test(remarks);
        const isPureNonSector = !hasDigit && (remarks.includes('admin') || remarks.includes('dsi'));
        if (!isPureNonSector) si = off;
      }
    }

    res.json({ data: { si, sho } });
  } catch {
    res.status(500).json({ error: 'Failed to get officers' });
  }
});

// ── GET /api/memos — List memos with filters ────────────────────────────────

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, dsrId, page = '1', limit = '20', zoneId, psId, dateFrom, dateTo, sector } = req.query;
    const filter: any = {};
    if (status) {
      const statuses = (status as string).split(',');
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (dsrId) filter.dsrId = dsrId;
    if (zoneId) filter.zoneId = zoneId;
    if (psId) filter.psId = psId;
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom as string);
      if (dateTo) {
        const end = new Date(dateTo as string);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Sector filter: sector lives in DSR parsedCases, so pre-query matching caseIds
    if (sector) {
      const dsrs = await DSR.find(
        { 'parsedCases.sector': { $regex: new RegExp(`^${(sector as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'parsedCases._id': 1, 'parsedCases.sector': 1 }
      ).lean();
      const validCaseIds: string[] = [];
      for (const dsr of dsrs) {
        for (const pc of (dsr as any).parsedCases || []) {
          if (pc.sector && (pc.sector as string).toLowerCase() === (sector as string).toLowerCase()) {
            validCaseIds.push(String(pc._id));
          }
        }
      }
      if (validCaseIds.length > 0) {
        filter.caseId = { $in: validCaseIds };
      } else {
        return res.json({ data: [], pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total: 0 } });
      }
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [memos, total] = await Promise.all([
      Memo.find(filter)
        .populate('generatedBy', 'name badgeNumber rank')
        .populate('reviewedBy', 'name badgeNumber rank')
        .populate('recipientId', 'name badgeNumber rank phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .lean(),
      Memo.countDocuments(filter),
    ]);

    // Enrich each memo with its DSR parsed case details
    const enriched = await Promise.all(
      memos.map(async (memo: any) => {
        try {
          const dsr = await DSR.findById(memo.dsrId)
            .populate('parsedCases.matchedSHOId', 'name badgeNumber rank')
            .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank')
            .lean();
          if (dsr) {
            const pc = (dsr as any).parsedCases?.find(
              (c: any) => String(c._id) === String(memo.caseId)
            );
            if (pc) {
              memo.caseDetails = {
                natureOfCase: pc.natureOfCase || pc.crimeHead || '',
                sector: pc.sector || '',
                actionTakenBy: pc.actionTakenBy || '',
                socialViceType: pc.socialViceType || '',
                sho: pc.matchedSHOId || null,
                si: pc.matchedOfficerId || null,
                accusedParticulars: pc.accusedParticulars || pc.accusedDetails || '',
                briefFacts: pc.briefFacts || '',
                seizedProperty: pc.seizedProperty || '',
                seizedWorth: pc.seizedWorth || '',
                numAccused: pc.numAccused || 0,
                numCases: pc.numCases || 0,
                abscondingAccused: pc.abscondingAccused || 0,
                psWithCrDetails: pc.psWithCrDetails || '',
                dor: pc.dor || '',
                warningGenerated: pc.warningGenerated || false,
              };
              memo.raidedDate = dsr.date;
              memo.raidedBy = (dsr as any).raidedBy || '';
            }
          }
        } catch { /* skip enrichment on error */ }
        return memo;
      })
    );

    res.json({ data: enriched, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch memos' });
  }
});

// ── GET /api/memos/counts — Per-status counts with filters ──────────────────

router.get('/counts', authenticate, async (req: Request, res: Response) => {
  try {
    const { zoneId, psId, dateFrom, dateTo, sector } = req.query;
    const filter: any = {};
    if (zoneId) filter.zoneId = new mongoose.Types.ObjectId(zoneId as string);
    if (psId) filter.psId = new mongoose.Types.ObjectId(psId as string);
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom as string);
      if (dateTo) {
        const end = new Date(dateTo as string);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Sector filter: sector lives in DSR parsedCases, so pre-query matching caseIds
    // Note: caseId is stored as String in Memo schema, so keep as strings
    if (sector) {
      const dsrs = await DSR.find(
        { 'parsedCases.sector': { $regex: new RegExp(`^${(sector as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'parsedCases._id': 1, 'parsedCases.sector': 1 }
      ).lean();
      const validCaseIds: string[] = [];
      for (const dsr of dsrs) {
        for (const pc of (dsr as any).parsedCases || []) {
          if (pc.sector && (pc.sector as string).toLowerCase() === (sector as string).toLowerCase()) {
            validCaseIds.push(String(pc._id));
          }
        }
      }
      if (validCaseIds.length > 0) {
        filter.caseId = { $in: validCaseIds };
      } else {
        return res.json({ data: {} });
      }
    }

    const pipeline: any[] = [];
    if (Object.keys(filter).length > 0) pipeline.push({ $match: filter });
    pipeline.push({ $group: { _id: '$status', count: { $sum: 1 } } });

    const results = await Memo.aggregate(pipeline);
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r._id] = r.count;
    }
    res.json({ data: counts });
  } catch {
    res.status(500).json({ error: 'Failed to fetch memo counts' });
  }
});

// ── GET /api/memos/:id — Get single memo ────────────────────────────────────

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const memo = await Memo.findById(req.params.id)
      .populate('generatedBy', 'name badgeNumber rank')
      .populate('reviewedBy', 'name badgeNumber rank')
      .populate('approvedBy', 'name badgeNumber rank')
      .populate('recipientId', 'name badgeNumber rank phone')
      .populate('psId', 'name code')
      .populate('zoneId', 'name code')
      .lean();

    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    res.json({ data: memo });
  } catch {
    res.status(500).json({ error: 'Failed to fetch memo' });
  }
});

// ── PUT /api/memos/:id — Update memo content (operator edits) ───────────────

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { content, memoNumber, subject, reference, remarks } = req.body;
    const normalizedContent = typeof content === 'string' ? ensureMemoFooterGrouping(content) : content;
    const memo = await Memo.findByIdAndUpdate(
      req.params.id,
      { content: normalizedContent, memoNumber, subject, reference, remarks },
      { new: true }
    );
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    res.json({ data: memo });
  } catch {
    res.status(500).json({ error: 'Failed to update memo' });
  }
});

// ── PUT /api/memos/:id/submit — Submit for CP review ────────────────────────

router.put('/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const memo = await Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    if (memo.status !== MemoStatus.DRAFT) {
      res.status(400).json({ error: 'Only DRAFT memos can be submitted for review' });
      return;
    }

    memo.status = MemoStatus.PENDING_REVIEW;
    await memo.save();
    res.json({ data: memo });
  } catch {
    res.status(500).json({ error: 'Failed to submit memo' });
  }
});

// ── PUT /api/memos/:id/assign — CP assigns recipient (SI or SHO) ────────────

router.put('/:id/assign', authenticate, async (req: Request, res: Response) => {
  try {
    const { recipientType, recipientId } = req.body;
    if (!recipientType || !recipientId) {
      res.status(400).json({ error: 'recipientType and recipientId are required' });
      return;
    }

    const memo = await Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }

    // Look up officer
    const officer = await Officer.findById(recipientId).lean();
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }

    memo.recipientType = recipientType;
    memo.recipientId = officer._id as any;
    memo.recipientName = officer.name;
    memo.recipientDesignation = recipientType === 'SHO' ? 'Inspector of Police' : 'Sub-Inspector of Police';

    // Update the HTML content's "To" block with officer name and designation
    const psName = memo.recipientPS || memo.policeStation || '';
    const newToBlock = buildToBlock(psName, officer.name, memo.recipientDesignation || undefined);
    memo.content = replaceToBlock(memo.content, newToBlock);
    memo.content = ensureMemoFooterGrouping(memo.content);

    await memo.save();
    const populated = await Memo.findById(memo._id)
      .populate('generatedBy', 'name badgeNumber rank')
      .populate('reviewedBy', 'name badgeNumber rank')
      .populate('recipientId', 'name badgeNumber rank phone')
      .lean();
    res.json({ data: populated });
  } catch {
    res.status(500).json({ error: 'Failed to assign recipient' });
  }
});

// ── PUT /api/memos/:id/hold — CP puts memo on hold ──────────────────────────

router.put('/:id/hold', authenticate, async (req: Request, res: Response) => {
  try {
    const memo = await Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }

    memo.status = MemoStatus.ON_HOLD;
    memo.reviewedBy = req.user!.id as any;
    memo.reviewedAt = new Date();
    memo.remarks = req.body.remarks || 'Put on hold by CP';
    await memo.save();
    res.json({ data: memo });
  } catch {
    res.status(500).json({ error: 'Failed to hold memo' });
  }
});

// ── PUT /api/memos/:id/reject — CP rejects memo ─────────────────────────────

router.put('/:id/reject', authenticate, async (req: Request, res: Response) => {
  try {
    const memo = await Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }

    memo.status = MemoStatus.REJECTED;
    memo.reviewedBy = req.user!.id as any;
    memo.reviewedAt = new Date();
    memo.remarks = req.body.remarks || 'Rejected by CP';
    await memo.save();
    res.json({ data: memo });
  } catch {
    res.status(500).json({ error: 'Failed to reject memo' });
  }
});

// ── PUT /api/memos/:id/approve — CP approves memo ───────────────────────────

router.put('/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const memo = await Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    if (
      memo.status !== MemoStatus.REVIEWED &&
      memo.status !== MemoStatus.PENDING_REVIEW &&
      memo.status !== MemoStatus.ON_HOLD
    ) {
      res.status(400).json({ error: 'Memo must be pending, reviewed, or on hold before approval' });
      return;
    }

    memo.status = MemoStatus.APPROVED;
    memo.approvedBy = req.user!.id as any;
    memo.approvedAt = new Date();
    await memo.save();
    res.json({ data: memo });
  } catch {
    res.status(500).json({ error: 'Failed to approve memo' });
  }
});

// ── DELETE /api/memos/:id ────────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const memo = await Memo.findByIdAndDelete(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    res.json({ message: 'Memo deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete memo' });
  }
});

export default router;
