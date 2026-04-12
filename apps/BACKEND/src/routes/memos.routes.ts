import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Memo, MemoStatus, DSR, Officer, PoliceStation, Zone, Division, Circle, SectorOfficer } from '../models';
import { Sector } from '../models/Sector';
import { authenticate } from '../middleware/auth';
import { OfficerRank } from '../models';

const router = Router();

// ── Template Generation ──────────────────────────────────────────────────────

function detectCrimeCategory(caseData: any): string {
  const sections = (caseData.sections || '').toLowerCase();
  const nature = (caseData.natureOfCase || caseData.crimeHead || '').toLowerCase();
  const socialVice = (caseData.socialViceType || '').toLowerCase();

  if (sections.includes('ndps') || nature.includes('narcotic') || nature.includes('ganja') ||
      nature.includes('cannabis') || nature.includes('cocaine') || nature.includes('heroin') ||
      nature.includes('charas') || nature.includes('opium') || socialVice.includes('narcotic'))
    return 'NDPS';
  if (sections.includes('essential commodities') || nature.includes('pds') ||
      nature.includes('essential commodit') || nature.includes('ration'))
    return 'ESSENTIAL_COMMODITIES';
  if (nature.includes('food') || nature.includes('adulterat') || nature.includes('expired') ||
      nature.includes('cattle feed') || nature.includes('dhaana'))
    return 'FOOD_SAFETY';
  if (socialVice.includes('gambling') || socialVice.includes('betting') ||
      nature.includes('gambling') || nature.includes('betting') || nature.includes('matka'))
    return 'GAMBLING';
  if (nature.includes('liquor') || nature.includes('illicit') || sections.includes('excise') ||
      nature.includes('toddy') || nature.includes('arrack'))
    return 'LIQUOR';
  if (nature.includes('prostitution') || socialVice.includes('prostitution') ||
      nature.includes('immoral traffic') || nature.includes('flesh trade'))
    return 'PROSTITUTION';
  return 'GENERAL';
}

function getInstructionParagraph(category: string): string {
  switch (category) {
    case 'NDPS':
      return 'You are hereby instructed to increase surveillance in your area, develop reliable and useful intelligence sources, conduct regular inspections, identify and maintain records of habitual offenders and keep strict watch on sensitive and vulnerable areas for strict implementation of the provisions of the NDPS Act.';
    case 'FOOD_SAFETY':
      return 'You are hereby instructed to increase surveillance in your jurisdiction, gather reliable and actionable information, identify and closely monitor storage units, fruit markets, and other sensitive areas and coordinate with concerned departments for effective enforcement.';
    case 'GAMBLING':
      return 'You are hereby instructed to increase surveillance in your area, develop reliable intelligence sources, identify and monitor gambling dens and habitual offenders, conduct regular raids and coordinate with concerned departments for effective enforcement.';
    case 'LIQUOR':
      return 'You are hereby instructed to increase surveillance in your area, develop reliable intelligence sources, identify and monitor illicit liquor manufacturing and distribution points, conduct regular raids and coordinate with Excise Department for effective enforcement.';
    case 'PROSTITUTION':
      return 'You are hereby instructed to increase surveillance in your area, develop reliable intelligence sources, identify and monitor vulnerable areas, conduct regular inspections and coordinate with concerned departments for effective enforcement under the Immoral Traffic (Prevention) Act.';
    default:
      return 'You are hereby instructed to increase surveillance in the area, develop reliable information sources, conduct regular inspections and coordinate with concerned departments for effective enforcement.';
  }
}

function getReviewParagraph(category: string): string {
  if (category === 'NDPS') {
    return 'Therefore, you must also review the existing preventive measures and correct any shortcomings to avoid such incidents in the future. Any negligence or failure in this matter will be viewed seriously and may lead to disciplinary action as per law.';
  }
  return 'Therefore, you must also review the existing preventive measures and take steps to correct any gaps to prevent such incidents in the future. Any negligence or failure in this matter will be taken seriously and may lead to disciplinary action as per law.';
}

function generateMemoHTML(caseData: any, psName: string, zoneName: string, divisionName: string, memoDate: string): string {
  const crNo = caseData.crNo || '___/____';
  const sections = caseData.sections || '___';
  const dor = caseData.dor || memoDate;
  const natureOfCase = (caseData.natureOfCase || caseData.crimeHead || '').trim();
  const seizedProperty = (caseData.seizedProperty || '').trim();

  const category = detectCrimeCategory(caseData);

  // Build crime description from natureOfCase (short), NOT briefFacts (long)
  let crimeDesc = '';
  if (natureOfCase) {
    crimeDesc = natureOfCase.charAt(0).toLowerCase() + natureOfCase.slice(1);
    crimeDesc = crimeDesc.replace(/\.\s*$/, '');
  }

  // Body paragraph 1 — crime-specific description
  let bodyPara1: string;
  if (crimeDesc) {
    bodyPara1 = `A case has been reported vide Cr.No.${crNo}, which falls under in your PS limits pertaining to ${crimeDesc}.`;
  } else {
    bodyPara1 = `A case has been reported vide Cr.No.${crNo}, which falls under in your PS limits.`;
  }

  // For NDPS cases, add seized property details
  if (seizedProperty && category === 'NDPS') {
    bodyPara1 += ` In the said case ${seizedProperty} were seized from their possession vide case cited.`;
  }

  // For non-NDPS, non-FOOD_SAFETY: add vigilance sentence
  if (category !== 'NDPS' && category !== 'FOOD_SAFETY') {
    bodyPara1 += ' This incident shows the need for better vigilance and improved intelligence to detect and prevent such illegal activities.';
  }

  const bodyPara2 = getInstructionParagraph(category);
  const bodyPara3 = getReviewParagraph(category);

  return `<p style="text-align: center"><strong>GOVERNMENT OF TELANGANA</strong></p>
<p style="text-align: center"><strong>POLICE DEPARTMENT</strong></p>
<p>&nbsp;</p>
<p style="text-align: right">Office of the,</p>
<p style="text-align: right">Commissioner of Police,</p>
<p style="text-align: right">Hyderabad City</p>
<p>&nbsp;</p>
<p>No.______&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dated: ${memoDate}</p>
<p style="text-align: center"><strong><u>MEMORANDUM</u></strong></p>
<p>&nbsp;</p>
<table><tbody><tr><td><p><strong>Sub:</strong></p></td><td><p>Hyderabad City Police- You are here by advised to strengthen your information – Regarding</p></td></tr><tr><td><p><strong>Ref:</strong></p></td><td><p>Crime No. ${crNo} u/s ${sections} of ${psName} PS, dated ${dor}.</p></td></tr></tbody></table>
<p>&nbsp;</p>
<p style="text-align: center">* * * * *</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${bodyPara1}</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${bodyPara2}</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${bodyPara3}</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;The acknowledged, and compliance report submitted at the earliest.</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p style="text-align: right">Commissioner of Police,</p>
<p style="text-align: right">Hyderabad City.</p>
<p>&nbsp;</p>
<p>To</p>
<p>The Inspector of Police/SHO,</p>
<p>${psName} PS, Hyderabad,</p>
<p>&nbsp;</p>
<p>Copy:</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;1. The ACP, ${divisionName} Division, Hyderabad for information and necessary action.</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;2. The DCP, ${zoneName} Zone, Hyderabad for information and necessary action.</p>`;
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
    const dateStr = `${memoDate.getDate()}-${memoDate.getMonth() + 1}-${memoDate.getFullYear()}`;

    const subject = 'Hyderabad City Police- You are here by advised to strengthen your information – Regarding';
    const reference = `Crime No. ${parsedCase.crNo || '___'} u/s ${parsedCase.sections || '___'} of ${psName} PS, dated ${parsedCase.dor || dateStr}.`;

    // Generate HTML content
    const content = generateMemoHTML(parsedCase, psName, zoneName, divisionName, dateStr);

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
        { designation: 'ACP', name: '', unit: `${divisionName} Division, Hyderabad` },
        { designation: 'DCP', name: '', unit: `${zoneName} Zone, Hyderabad` },
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
    const memo = await Memo.findByIdAndUpdate(
      req.params.id,
      { content, memoNumber, subject, reference, remarks },
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
    memo.recipientDesignation = recipientType === 'SHO' ? 'Inspector of Police/SHO' : 'Sub-Inspector of Police';

    // Update the HTML content's "To" block with officer name and designation
    const psName = memo.recipientPS || memo.policeStation || '';
    const newToBlock = `<p>To</p>\n<p>${officer.name},</p>\n<p>The ${memo.recipientDesignation},</p>\n<p>${psName} PS, Hyderabad,</p>`;

    // Replace the To block — handles original template AND re-assignments
    // Original: <p>To</p> <p>The Inspector of Police/SHO,</p> <p>PS Name PS, Hyderabad,</p>
    // After assign: <p>To</p> <p>OfficerName,</p> <p>The Designation,</p> <p>PS Name PS, Hyderabad,</p>
    memo.content = memo.content.replace(
      /<p>To<\/p>\s*(?:<p>[^<]+,<\/p>\s*)?<p>The (?:Inspector of Police\/SHO|Sub-Inspector of Police),<\/p>\s*<p>[^<]*PS, Hyderabad,<\/p>/,
      newToBlock
    );

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
