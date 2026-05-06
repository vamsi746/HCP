"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _express = require('express');
var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
var _models = require('../models');
var _Sector = require('../models/Sector');
var _auth = require('../middleware/auth');
var _upload = require('../middleware/upload');
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _promises = require('fs/promises'); var _promises2 = _interopRequireDefault(_promises);
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _dsrparser = require('../services/dsr-parser');

const router = _express.Router.call(void 0, );

// ── Vice Category Matcher (mirrors dashboard analytics) ─────────────────────
// Maps a parsed DSR case to a normalized vice category bucket.
const VICE_CATEGORY_PATTERNS = {
  Peta: /peta|animal|cruelty/i,
  Gambling: /gambl|betting|matka/i,
  'Food Adulteration': /food|adulterat|edible|oil/i,
  'Cross Message': /cross.*mess|pamphlet|poster|propag/i,
  'Hookah Centers': /hookah|shisha|hukka/i,
  Narcotics: /ndps|ganja|drug|narcotic/i,
};

function classifyVice(socialViceType, natureOfCase) {
  const raw = String(socialViceType || natureOfCase || 'Other').toLowerCase();
  for (const [cat, re] of Object.entries(VICE_CATEGORY_PATTERNS)) {
    if (re.test(raw)) return cat;
  }
  return 'Others';
}

// Resolve caseIds (Memo.caseId is a String) for a given vice category by
// scanning DSR.parsedCases. Returns array of caseId strings, or null if no match.
async function resolveCaseIdsByVice(viceCategory) {
  const cat = String(viceCategory).trim();
  if (!cat) return null;
  const dsrs = await _models.DSR.find(
    {},
    { 'parsedCases._id': 1, 'parsedCases.socialViceType': 1, 'parsedCases.natureOfCase': 1 }
  ).lean();
  const ids = [];
  for (const dsr of dsrs) {
    for (const pc of dsr.parsedCases || []) {
      if (classifyVice(pc.socialViceType, pc.natureOfCase) === cat) {
        ids.push(String(pc._id));
      }
    }
  }
  return ids;
}

// ── Template Generation ──────────────────────────────────────────────────────



function normalizeWhitespace(value) {
  return String(_nullishCoalesce(value, () => ( ''))).replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(_nullishCoalesce(value, () => ( '')))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateParts(date, separator) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}${separator}${mm}${separator}${yyyy}`;
}

function parseLooseDate(value) {
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

function formatDateString(value, fallbackDate, separator) {
  const parsed = parseLooseDate(value);
  return formatDateParts(parsed || fallbackDate, separator);
}

function buildOffenceTitle(caseData) {
  const primary = normalizeWhitespace(caseData.natureOfCase || caseData.crimeHead || caseData.socialViceType || '');
  return primary || 'illegal activity';
}

function buildOffenceActivity(offenceTitle) {
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

function buildToBlock(psName, recipientName, recipientDesignation) {
  const safePs = escapeHtml(normalizeWhitespace(psName) || '________');
  if (recipientName) {
    const safeName = escapeHtml(normalizeWhitespace(recipientName));
    const safeDesignation = escapeHtml(normalizeWhitespace(recipientDesignation) || 'Inspector of Police');
    return `<p>To</p>\n<p>Sri. ${safeName}, ${safeDesignation},</p>\n<p>${safePs} P.S, Hyderabad.</p>\n<p>&nbsp;</p>`;
  }
  return `<p>To</p>\n<p>The Inspector of Police/SHO,</p>\n<p>${safePs} P.S, Hyderabad.</p>\n<p>&nbsp;</p>`;
}

function renderMemoTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => _nullishCoalesce(values[key], () => ( '')));
}

function replaceToBlock(content, toBlock) {
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

function ensureMemoFooterGrouping(content) {
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

function generateMemoHTML(caseData, psName, zoneName, divisionName, memoDate, recipientName, recipientDesignation) {
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
    toBlock: buildToBlock(psName, recipientName, recipientDesignation),
  });
}

// ── POST /api/memos/generate — Generate memo from a DSR parsed case ─────────

router.post('/generate', _auth.authenticate, async (req, res) => {
  try {
    const { dsrId, caseId } = req.body;
    if (!dsrId || !caseId) {
      res.status(400).json({ error: 'dsrId and caseId are required' });
      return;
    }

    // Check if memo already exists for this case — delete and regenerate
    const existing = await _models.Memo.findOne({ dsrId, caseId });
    if (existing) {
      await _models.Memo.deleteOne({ _id: existing._id });
    }

    // Get DSR with populated case data
    const dsr = await _models.DSR.findById(dsrId)
      .populate('parsedCases.matchedPSId', 'name code circleId')
      .populate('parsedCases.matchedZoneId', 'name code')
      .lean() ;

    if (!dsr) {
      res.status(404).json({ error: 'DSR not found' });
      return;
    }

    // Find the specific case
    const parsedCase = _optionalChain([dsr, 'access', _ => _.parsedCases, 'optionalAccess', _2 => _2.find, 'call', _3 => _3((c) => c._id.toString() === caseId)]);
    if (!parsedCase) {
      res.status(404).json({ error: 'Case not found in DSR' });
      return;
    }

    // Resolve PS, Zone, Division names
    const psName = parsedCase.policeStation || 'Unknown PS';
    let zoneName = '';
    let divisionName = '';

    if (parsedCase.matchedZoneId && typeof parsedCase.matchedZoneId === 'object') {
      zoneName = _optionalChain([parsedCase, 'access', _4 => _4.matchedZoneId, 'access', _5 => _5.name, 'optionalAccess', _6 => _6.replace, 'call', _7 => _7(/\s*Zone$/i, '')]) || '';
    }

    // Walk up: PS → Circle → Division
    if (parsedCase.matchedPSId && typeof parsedCase.matchedPSId === 'object') {
      const ps = await _models.PoliceStation.findById(parsedCase.matchedPSId._id).populate('circleId').lean() ;
      if (_optionalChain([ps, 'optionalAccess', _8 => _8.circleId])) {
        const circle = await _models.Circle.findById(ps.circleId._id || ps.circleId).lean() ;
        if (_optionalChain([circle, 'optionalAccess', _9 => _9.divisionId])) {
          const division = await _models.Division.findById(circle.divisionId).lean() ;
          if (division) {
            divisionName = _optionalChain([division, 'access', _10 => _10.name, 'optionalAccess', _11 => _11.replace, 'call', _12 => _12(/\s*Division$/i, '')]) || '';
            if (!zoneName && division.zoneId) {
              const zone = await _models.Zone.findById(division.zoneId).lean() ;
              if (zone) zoneName = _optionalChain([zone, 'access', _13 => _13.name, 'optionalAccess', _14 => _14.replace, 'call', _15 => _15(/\s*Zone$/i, '')]) || '';
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

    // Determine initial recipient from DSR match
    const initialRecipient = parsedCase.matchedOfficerId || parsedCase.matchedSHOId || null;
    const recipientName = initialRecipient ? initialRecipient.name : '';
    const recipientType = parsedCase.matchedOfficerId ? 'SI' : (parsedCase.matchedSHOId ? 'SHO' : '');
    const recipientDesignation = parsedCase.matchedOfficerId 
      ? (parsedCase.matchedOfficerId.rank === 'WSI' ? 'Woman Sub-Inspector of Police' : 'Sub-Inspector of Police')
      : (parsedCase.matchedSHOId ? 'Inspector of Police' : '');
    const recipientId = initialRecipient ? (initialRecipient._id || initialRecipient) : null;

    // Generate HTML content
    const content = generateMemoHTML(parsedCase, psName, zoneName, divisionName, memoDate, recipientName, recipientDesignation);

    // Create memo
    const memo = await _models.Memo.create({
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
      sector: parsedCase.sector || '',
      briefFacts: parsedCase.briefFacts,
      status: _models.MemoStatus.DRAFT,
      generatedBy: req.user.id,
      generatedAt: memoDate,
      recipientId,
      recipientName,
      recipientDesignation,
      recipientType,
      recipientPS: psName,
      copyTo: [
        { designation: 'ACP', name: '', unit: divisionName ? `${divisionName} Division, Hyderabad` : '________ Division, Hyderabad' },
        { designation: 'DCP', name: '', unit: zoneName ? `${zoneName} Zone, Hyderabad` : '________ Zone, Hyderabad' },
      ],
    });

    res.status(201).json({ data: memo });
  } catch (err) {
    console.error('[MEMO] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate memo' });
  }
});

// ── POST /api/memos/generate-charge-memo — Generate charge memo for officer with 3+ warnings ──

function generateChargeMemoHTML(officerName, officerDesignation, psName, zoneName, divisionName, memoDate) {
  const memoDateDisplay = formatDateParts(memoDate, '-');

  const template = `<p style="text-align: center"><strong>GOVERNMENT OF TELANGANA</strong></p>
<p style="text-align: center"><strong>POLICE DEPARTMENT</strong></p>
<p>&nbsp;</p>
<p style="text-align: right">Office of the,</p>
<p style="text-align: right">Commissioner of Police,</p>
<p style="text-align: right">Hyderabad City</p>
<p><span style="display:inline-block;width:60%;vertical-align:top">No. {{memoNumber}}</span><span style="display:inline-block;width:39%;text-align:right;vertical-align:top">Dated: {{memoDate}}</span></p>
<p style="text-align: center"><strong><u>CHARGE MEMO</u></strong></p>
<p>&nbsp;</p>
<p style="text-align: justify"><strong>Sub:</strong> Issuance of charge memo due to continued lapses in discharge of duties despite three warning memos.</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;It is observed that Sri. {{officerName}}, {{officerDesignation}}, of {{psName}} Police Station has been issued three warning memos for lapses in duty.</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Despite the above, there is no improvement in performance and the officer has failed to discharge duties properly.</p>
<p>&nbsp;</p>
<p style="text-align: justify"><strong>Charge:</strong></p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;The officer has shown negligence in duty, lack of supervision, and failure to prevent/detect offences in his jurisdiction.</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Therefore, the officer is hereby directed to submit his explanation within 7 days from the date of receipt of this memo.</p>
<p>&nbsp;</p>
<p style="text-align: justify">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;If no explanation is received within the stipulated time, it will be presumed that he has no explanation to offer and further action will be taken accordingly.</p>
<div class="memo-footer-block">
  <p>&nbsp;</p>
  <p>&nbsp;</p>
  <div class="memo-signature-block">
    <p style="text-align: right">Commissioner of Police,</p>
    <p style="text-align: right">Hyderabad City</p>
  </div>
  <p>&nbsp;</p>
  <p>&nbsp;</p>
  <p>&nbsp;</p>
  <div class="memo-dispatch-block">
    <p>To:</p>
    <p>Sri. {{officerName}}, {{officerDesignation}},</p>
    <p>{{psName}} P.S, Hyderabad.</p>
    <p>&nbsp;</p>
    <p>Copy:</p>
    <p>1. The ACP, {{divisionLabel}} for information and necessary action.</p>
    <p>2. The DCP, {{zoneLabel}} for information and necessary action.</p>
  </div>
</div>`;

  return renderMemoTemplate(template, {
    memoNumber: '___________',
    memoDate: escapeHtml(memoDateDisplay),
    officerName: escapeHtml(officerName),
    officerDesignation: escapeHtml(officerDesignation),
    psName: escapeHtml(psName),
    divisionLabel: escapeHtml(divisionName ? `${divisionName} Division, Hyderabad` : '________ Division, Hyderabad'),
    zoneLabel: escapeHtml(zoneName ? `${zoneName} Zone, Hyderabad` : '________ Zone, Hyderabad'),
  });
}

router.post('/generate-charge-memo', _auth.authenticate, async (req, res) => {
  try {
    const { officerId } = req.body;
    if (!officerId) {
      res.status(400).json({ error: 'officerId is required' });
      return;
    }

    // 1. Check officer exists
    const officer = await _models.Officer.findById(officerId).lean();
    if (!officer) {
      res.status(404).json({ error: 'Officer not found' });
      return;
    }

    // 2. Verify officer has 3+ approved/sent warning memos
    const warningCount = await _models.Memo.countDocuments({
      recipientId: officer._id,
      status: { $in: ['APPROVED', 'SENT'] },
    });
    if (warningCount < 3) {
      res.status(400).json({ error: 'Officer does not have 3 or more warning memos' });
      return;
    }

    // 3. Check if a charge memo already exists as DRAFT for this officer
    const existingCharge = await _models.Memo.findOne({
      recipientId: officer._id,
      memoType: 'CHARGE',
      status: 'DRAFT',
    });
    if (existingCharge) {
      // Return the existing draft instead of creating a new one
      res.status(200).json({ data: existingCharge });
      return;
    }

    // 4. Resolve officer's assignment (sector → PS → circle → division → zone)
    const assignment = await _models.SectorOfficer.findOne({ officerId: officer._id, isActive: true })
      .populate({
        path: 'sectorId',
        select: 'name policeStationId',
        populate: {
          path: 'policeStationId',
          select: 'name code circleId',
        },
      })
      .lean();

    let psName = '________';
    let zoneName = '';
    let divisionName = '';
    let psId = null;
    let zoneId = null;

    if (assignment) {
      const sec = assignment.sectorId;
      if (sec && sec.policeStationId) {
        const station = sec.policeStationId;
        psName = station.name || psName;
        psId = station._id;

        // Walk up: PS → Circle → Division → Zone
        if (station.circleId) {
          const circle = await _models.Circle.findById(station.circleId).lean();
          if (circle && circle.divisionId) {
            const division = await _models.Division.findById(circle.divisionId).lean();
            if (division) {
              divisionName = (division.name || '').replace(/\s*Division$/i, '');
              if (division.zoneId) {
                const zone = await _models.Zone.findById(division.zoneId).lean();
                if (zone) {
                  zoneName = (zone.name || '').replace(/\s*Zone$/i, '');
                  zoneId = zone._id;
                }
              }
            }
          }
        }
      }
    }

    // 5. Determine officer designation from rank
    const designationMap = {
      SI: 'Sub-Inspector of Police',
      WSI: 'Woman Sub-Inspector of Police',
      PSI: 'Probationary Sub-Inspector of Police',
      ASI: 'Assistant Sub-Inspector of Police',
      CI: 'Circle Inspector of Police',
      HEAD_CONSTABLE: 'Head Constable',
      CONSTABLE: 'Constable',
    };
    
    // Check if officer is explicitly linked as SHO of their station
    const stationForSHO = await _models.PoliceStation.findOne({ shoId: officer._id }).lean();
    const isSHO = !!stationForSHO;
    const officerDesignation = isSHO ? 'Inspector of Police' : (designationMap[officer.rank] || 'Inspector of Police');

    // 6. Generate HTML
    const memoDate = new Date();
    const content = generateChargeMemoHTML(officer.name, officerDesignation, psName, zoneName, divisionName, memoDate);

    const subject = 'Issuance of charge memo due to continued lapses in discharge of duties despite three warning memos.';

    // 7. Create charge memo
    const memo = await _models.Memo.create({
      memoType: 'CHARGE',
      date: memoDate,
      subject,
      reference: '',
      content,
      policeStation: psName,
      psId,
      zone: zoneName,
      zoneId,
      status: _models.MemoStatus.DRAFT,
      generatedBy: req.user.id,
      generatedAt: memoDate,
      recipientId: officer._id,
      recipientName: officer.name,
      recipientDesignation: officerDesignation,
      recipientType: isSHO ? 'SHO' : 'SI',
      recipientPS: psName,
      copyTo: [
        { designation: 'ACP', name: '', unit: divisionName ? `${divisionName} Division, Hyderabad` : '________ Division, Hyderabad' },
        { designation: 'DCP', name: '', unit: zoneName ? `${zoneName} Zone, Hyderabad` : '________ Zone, Hyderabad' },
      ],
    });

    res.status(201).json({ data: memo });
  } catch (err) {
    console.error('[MEMO] Generate charge memo error:', err.message);
    res.status(500).json({ error: 'Failed to generate charge memo' });
  }
});

// ── GET /api/memos/case-officers/:psId — Get SI and SHO for a PS ────────────

router.get('/case-officers/:psId', _auth.authenticate, async (req, res) => {
  try {
    const { sector } = req.query;
    console.log(`[DEBUG] getCaseOfficers psId=${req.params.psId} sector="${sector}"`);

    const sectors = await _Sector.Sector.find({ policeStationId: req.params.psId }).lean();
    if (sectors.length === 0) {
      console.log(`[DEBUG] No sectors found for PS ${req.params.psId}`);
      res.json({ data: { si: null, sho: null } });
      return;
    }

    // Robust sector matching
    let matchedSectorId = null;
    if (sector) {
      const cleanInput = String(sector).replace(/\s*Sector\s*/i, '').trim().toLowerCase();
      const sMatch = sectors.find(s => {
        const dbName = s.name.toLowerCase();
        const dbClean = dbName.replace(/\s*Sector\s*/i, '').trim();
        return dbClean === cleanInput || dbName === cleanInput || dbName.includes(cleanInput);
      });
      if (sMatch) {
        matchedSectorId = sMatch._id;
        console.log(`[DEBUG] Matched sector "${sector}" to DB sector "${sMatch.name}" (${sMatch._id})`);
      } else {
        console.log(`[DEBUG] Could not match sector "${sector}" in sectors:`, sectors.map(s => s.name));
      }
    }

    const soFilter = {
      role: 'PRIMARY_SI',
      isActive: true
    };

    if (matchedSectorId) {
      soFilter.sectorId = matchedSectorId;
    } else {
      soFilter.sectorId = { $in: sectors.map((s) => s._id) };
    }

    console.log(`[DEBUG] Querying SectorOfficer with filter: ${JSON.stringify(soFilter)}`);
    const sectorOfficers = await _models.SectorOfficer.find(soFilter).lean();
    console.log(`[DEBUG] Found ${sectorOfficers.length} primary SIs.`);
    
    if (sectorOfficers.length > 0) {
      console.log(`[DEBUG] First SI ID: ${sectorOfficers[0].officerId}`);
    }

    const ps = await _models.PoliceStation.findById(req.params.psId).populate('shoId').lean();
    if (!ps) {
      console.log(`[DEBUG] Police station ${req.params.psId} NOT FOUND in DB`);
      res.status(404).json({ error: 'Police station not found' });
      return;
    }

    const sho = _optionalChain([ps, 'access', _ => _.shoId, 'optionalAccess', _2 => ({
      _id: _2._id,
      name: _2.name,
      badgeNumber: _2.badgeNumber,
      rank: _2.rank,
      phone: _2.phone,
      remarks: _2.remarks
    })]) || null;

    let si = null;
    if (sectorOfficers.length > 0) {
      // If we have multiple (unlikely if matchedSectorId is set), we'll find the best one
      let bestSO = sectorOfficers[0];
      
      // If we have multiple but no matchedSectorId, we might want to prioritize based on something?
      // But usually it should be 1-to-1.
      
      const off = await _models.Officer.findById(bestSO.officerId).select('name badgeNumber rank phone remarks').lean();
      si = off;
      console.log(`[DEBUG] Returning SI: ${si ? si.name : 'None'}`);
    } else {
      console.log(`[DEBUG] No primary SI found`);
    }

    res.json({ data: { si, sho } });
  } catch (e) {
    console.error('[DEBUG] getCaseOfficers error:', e);
    res.status(500).json({ error: 'Failed to get officers' });
  }
});

// ── GET /api/memos/my-memos — List memos for the logged-in officer ──────────

router.get('/my-memos', _auth.authenticate, async (req, res) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      recipientId: req.user.id,
      status: { $in: ['APPROVED', 'SENT'] },
    };

    if (status) {
      filter.status = status;
    }

    const [memos, total] = await Promise.all([
      _models.Memo.find(filter)
        .populate('generatedBy', 'name badgeNumber rank')
        .populate('approvedBy', 'name badgeNumber rank')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      _models.Memo.countDocuments(filter),
    ]);

    res.json({ data: memos, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    console.error('[MEMO] My-memos error:', err.message);
    res.status(500).json({ error: 'Failed to fetch your memos' });
  }
});

// ── GET /api/memos — List memos with filters ────────────────────────────────

router.get('/', _auth.authenticate, async (req, res) => {
  try {
    const { status, dsrId, page = '1', limit = '20', zoneId, zone, psId, dateFrom, dateTo, sector, complianceView, complianceStatus: csFilter, recipientType, viceCategory, memoType } = req.query;
    const filter = {};
    if (memoType === 'CHARGE') filter.memoType = 'CHARGE';
    else if (memoType === 'WARNING') filter.memoType = { $ne: 'CHARGE' };
    if (complianceView) {
      filter.status = { $in: ['APPROVED', 'SENT'] };
      if (csFilter === 'AWAITING_REPLY') {
        filter.$or = [
          { complianceStatus: 'AWAITING_REPLY' },
          { complianceStatus: { $exists: false } },
        ];
      } else if (csFilter === 'COMPLIED') {
        filter.complianceStatus = 'COMPLIED';
      }
    } else if (status) {
      const statuses = (status ).split(',');
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (dsrId && dsrId !== '') filter.dsrId = dsrId;
    if (zoneId && zoneId !== '') filter.zoneId = zoneId;
    if (zone && zone !== '' && !zoneId) {
      const cleanZone = String(zone).replace(/\s*Zone\s*$/i, '').trim();
      filter.zone = new RegExp(`^${cleanZone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (psId && psId !== '') filter.psId = psId;
    if (recipientType) {
      if (recipientType === 'UNASSIGNED') {
        filter.$or = [
          ...(filter.$or || []),
          { recipientType: { $exists: false } },
          { recipientType: '' },
          { recipientType: null },
        ];
      } else {
        filter.recipientType = recipientType;
      }
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom );
      if (dateTo) {
        const end = new Date(dateTo );
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Sector filter: sector lives in DSR parsedCases, so pre-query matching caseIds
    if (sector) {
      const dsrs = await _models.DSR.find(
        { 'parsedCases.sector': { $regex: new RegExp(`^${(sector ).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'parsedCases._id': 1, 'parsedCases.sector': 1 }
      ).lean();
      const validCaseIds = [];
      for (const dsr of dsrs) {
        for (const pc of (dsr ).parsedCases || []) {
          if (pc.sector && (pc.sector ).toLowerCase() === (sector ).toLowerCase()) {
            validCaseIds.push(String(pc._id));
          }
        }
      }
      if (validCaseIds.length > 0) {
        filter.caseId = { $in: validCaseIds };
      } else {
        return res.json({ data: [], pagination: { page: parseInt(page ), limit: parseInt(limit ), total: 0 } });
      }
    }

    // Vice category filter: socialViceType/natureOfCase live in DSR.parsedCases
    if (viceCategory) {
      const ids = await resolveCaseIdsByVice(viceCategory);
      if (!ids || ids.length === 0) {
        return res.json({ data: [], pagination: { page: parseInt(page ), limit: parseInt(limit ), total: 0 } });
      }
      filter.caseId = filter.caseId
        ? { $in: filter.caseId.$in.filter((x) => ids.includes(x)) }
        : { $in: ids };
      if (filter.caseId.$in.length === 0) {
        return res.json({ data: [], pagination: { page: parseInt(page ), limit: parseInt(limit ), total: 0 } });
      }
    }

    const skip = (parseInt(page ) - 1) * parseInt(limit );
    const [memos, total] = await Promise.all([
      _models.Memo.find(filter)
        .populate('generatedBy', 'name badgeNumber rank')
        .populate('reviewedBy', 'name badgeNumber rank')
        .populate('recipientId', 'name badgeNumber rank phone')
        .populate('compliedBy', 'name badgeNumber rank')
        .populate('psId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit ))
        .lean(),
      _models.Memo.countDocuments(filter),
    ]);

    // Enrich each memo with its DSR parsed case details
    const enriched = await Promise.all(
      memos.map(async (memo) => {
        try {
          const dsr = await _models.DSR.findById(memo.dsrId)
            .populate('parsedCases.matchedSHOId', 'name badgeNumber rank')
            .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank')
            .lean();
          if (dsr) {
            const pc = _optionalChain([(dsr ), 'access', _16 => _16.parsedCases, 'optionalAccess', _17 => _17.find, 'call', _18 => _18(
              (c) => String(c._id) === String(memo.caseId)
            )]);
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
              memo.raidedBy = (dsr ).raidedBy || '';
            }
          }
        } catch (e2) { /* skip enrichment on error */ }
        return memo;
      })
    );

    res.json({ data: enriched, pagination: { page: parseInt(page ), limit: parseInt(limit ), total } });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to fetch memos' });
  }
});

// ── GET /api/memos/counts — Per-status counts with filters ──────────────────

router.get('/counts', _auth.authenticate, async (req, res) => {
  try {
    const { zoneId, zone, psId, dateFrom, dateTo, sector, recipientType, viceCategory, memoType } = req.query;
    const filter = {};
    if (memoType === 'CHARGE') filter.memoType = 'CHARGE';
    else if (memoType === 'WARNING') filter.memoType = { $ne: 'CHARGE' };
    if (zoneId) filter.zoneId = new _mongoose2.default.Types.ObjectId(zoneId );
    if (zone && !zoneId) {
      const cleanZone = String(zone).replace(/\s*Zone\s*$/i, '').trim();
      filter.zone = new RegExp(`^${cleanZone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (psId) filter.psId = new _mongoose2.default.Types.ObjectId(psId );
    if (sector) filter.sector = sector;
    if (recipientType) {
      if (recipientType === 'UNASSIGNED') {
        filter.$or = [
          { recipientType: { $exists: false } },
          { recipientType: '' },
          { recipientType: null },
        ];
      } else {
        filter.recipientType = recipientType;
      }
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom );
      if (dateTo) {
        const end = new Date(dateTo );
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Sector filter: sector lives in DSR parsedCases, so pre-query matching caseIds
    // Note: caseId is stored as String in Memo schema, so keep as strings
    if (sector) {
      const dsrs = await _models.DSR.find(
        { 'parsedCases.sector': { $regex: new RegExp(`^${(sector ).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'parsedCases._id': 1, 'parsedCases.sector': 1 }
      ).lean();
      const validCaseIds = [];
      for (const dsr of dsrs) {
        for (const pc of (dsr ).parsedCases || []) {
          if (pc.sector && (pc.sector ).toLowerCase() === (sector ).toLowerCase()) {
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

    // Vice category filter
    if (viceCategory) {
      const ids = await resolveCaseIdsByVice(viceCategory);
      if (!ids || ids.length === 0) {
        return res.json({ data: {} });
      }
      filter.caseId = filter.caseId
        ? { $in: filter.caseId.$in.filter((x) => ids.includes(x)) }
        : { $in: ids };
      if (filter.caseId.$in.length === 0) {
        return res.json({ data: {} });
      }
    }

    const pipeline = [];
    if (Object.keys(filter).length > 0) pipeline.push({ $match: filter });
    pipeline.push({ $group: { _id: '$status', count: { $sum: 1 } } });

    const results = await _models.Memo.aggregate(pipeline);
    const counts = {};
    for (const r of results) {
      counts[r._id] = r.count;
    }

    // Compliance tab counts
    const compFilter = { ...filter, status: { $in: ['APPROVED', 'SENT'] } };
    const compPipeline = [
      { $match: compFilter },
      { $group: { _id: { $ifNull: ['$complianceStatus', 'AWAITING_REPLY'] }, count: { $sum: 1 } } },
    ];
    const compResults = await _models.Memo.aggregate(compPipeline);
    let compTotal = 0;
    for (const r of compResults) {
      counts[`compliance_${r._id}`] = r.count;
      compTotal += r.count;
    }
    counts['__COMPLIANCE__'] = compTotal;

    res.json({ data: counts });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to fetch memo counts' });
  }
});

// ── GET /api/memos/:id — Get single memo ────────────────────────────────────

router.get('/:id', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id)
      .populate('generatedBy', 'name badgeNumber rank')
      .populate('reviewedBy', 'name badgeNumber rank')
      .populate('approvedBy', 'name badgeNumber rank')
      .populate('recipientId', 'name badgeNumber rank phone')
      .populate('psId', 'name code')
      .populate('zoneId', 'name code')
      .lean();

    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    res.json({ data: memo });
  } catch (e5) {
    res.status(500).json({ error: 'Failed to fetch memo' });
  }
});

// ── PUT /api/memos/:id — Update memo content (operator edits) ───────────────

router.put('/:id', _auth.authenticate, async (req, res) => {
  try {
    const { content, memoNumber, subject, reference, remarks } = req.body;
    const normalizedContent = typeof content === 'string' ? ensureMemoFooterGrouping(content) : content;
    const memo = await _models.Memo.findByIdAndUpdate(
      req.params.id,
      { content: normalizedContent, memoNumber, subject, reference, remarks },
      { new: true }
    );
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    res.json({ data: memo });
  } catch (e6) {
    res.status(500).json({ error: 'Failed to update memo' });
  }
});

// ── PUT /api/memos/:id/submit — Submit for CP review ────────────────────────

router.put('/:id/submit', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    if (memo.status !== _models.MemoStatus.DRAFT) {
      res.status(400).json({ error: 'Only DRAFT memos can be submitted for review' });
      return;
    }

    memo.status = _models.MemoStatus.PENDING_REVIEW;
    await memo.save();
    res.json({ data: memo });
  } catch (e7) {
    res.status(500).json({ error: 'Failed to submit memo' });
  }
});

// ── PUT /api/memos/:id/assign — CP assigns recipient (SI or SHO) ────────────

router.put('/:id/assign', _auth.authenticate, async (req, res) => {
  try {
    const { recipientType, recipientId } = req.body;
    if (!recipientType || !recipientId) {
      res.status(400).json({ error: 'recipientType and recipientId are required' });
      return;
    }

    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }

    // Look up officer
    const officer = await _models.Officer.findById(recipientId).lean();
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }

    memo.recipientType = recipientType;
    memo.recipientId = officer._id ;
    memo.recipientName = officer.name;
    memo.recipientDesignation = recipientType === 'SHO' ? 'Inspector of Police' : 'Sub-Inspector of Police';

    // Update the HTML content's "To" block with officer name and designation
    const psName = memo.recipientPS || memo.policeStation || '';
    const newToBlock = buildToBlock(psName, officer.name, memo.recipientDesignation || undefined);
    memo.content = replaceToBlock(memo.content, newToBlock);
    memo.content = ensureMemoFooterGrouping(memo.content);

    await memo.save();
    const populated = await _models.Memo.findById(memo._id)
      .populate('generatedBy', 'name badgeNumber rank')
      .populate('reviewedBy', 'name badgeNumber rank')
      .populate('recipientId', 'name badgeNumber rank phone')
      .lean();
    res.json({ data: populated });
  } catch (e8) {
    res.status(500).json({ error: 'Failed to assign recipient' });
  }
});

// ── PUT /api/memos/:id/hold — CP puts memo on hold ──────────────────────────

router.put('/:id/hold', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }

    memo.status = _models.MemoStatus.ON_HOLD;
    memo.reviewedBy = req.user.id ;
    memo.reviewedAt = new Date();
    memo.remarks = req.body.remarks || 'Put on hold by CP';
    await memo.save();
    res.json({ data: memo });
  } catch (e9) {
    res.status(500).json({ error: 'Failed to hold memo' });
  }
});

// ── PUT /api/memos/:id/reject — CP rejects memo ─────────────────────────────

router.put('/:id/reject', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }

    memo.status = _models.MemoStatus.REJECTED;
    memo.reviewedBy = req.user.id ;
    memo.reviewedAt = new Date();
    memo.remarks = req.body.remarks || 'Rejected by CP';
    await memo.save();
    res.json({ data: memo });
  } catch (e10) {
    res.status(500).json({ error: 'Failed to reject memo' });
  }
});

// ── PUT /api/memos/:id/approve — CP approves memo ───────────────────────────

router.put('/:id/approve', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    if (
      memo.status !== _models.MemoStatus.REVIEWED &&
      memo.status !== _models.MemoStatus.PENDING_REVIEW &&
      memo.status !== _models.MemoStatus.ON_HOLD
    ) {
      res.status(400).json({ error: 'Memo must be pending, reviewed, or on hold before approval' });
      return;
    }

    memo.status = _models.MemoStatus.APPROVED;
    memo.approvedBy = req.user.id ;
    memo.approvedAt = new Date();
    (memo ).complianceStatus = 'AWAITING_REPLY';
    await memo.save();
    res.json({ data: memo });
  } catch (e11) {
    res.status(500).json({ error: 'Failed to approve memo' });
  }
});

// ── PUT /api/memos/:id/comply — Record compliance response ──────────────────

router.put('/:id/comply', _auth.authenticate, _upload.upload.single('complianceDocument'), async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    if (!['APPROVED', 'SENT'].includes(memo.status )) {
      res.status(400).json({ error: 'Only approved or sent memos can be marked as complied' });
      return;
    }
    if ((memo ).complianceStatus === 'COMPLIED') {
      res.status(400).json({ error: 'Memo is already marked as complied' });
      return;
    }
    if (!req.body.complianceRemarks && !req.file) {
      res.status(400).json({ error: 'Please provide compliance remarks or upload a document' });
      return;
    }

    (memo ).complianceStatus = 'COMPLIED';
    (memo ).complianceRemarks = req.body.complianceRemarks || '';
    (memo ).compliedAt = new Date();
    (memo ).compliedBy = req.user.id;

    if (req.file) {
      let buffer = req.file.buffer;
      let originalName = req.file.originalname;
      const ext = _path2.default.extname(originalName).toLowerCase();
      const dir = _path2.default.join(__dirname, '../../uploads/compliance');
      await _promises2.default.mkdir(dir, { recursive: true });

      // Convert .doc to .docx at upload time for fast preview
      if (ext === '.doc') {
        try {
          const docxBuffer = await _dsrparser.convertDocToDocx.call(void 0, buffer);
          if (docxBuffer) {
            buffer = docxBuffer;
            originalName = originalName.replace(/\.doc$/i, '.docx');
          }
        } catch (convErr) {
          console.log('[MEMO] .doc conversion failed, saving original:', convErr.message);
        }
      }

      const saveExt = _path2.default.extname(originalName).toLowerCase();
      const filename = `compliance_${memo._id}_${Date.now()}${saveExt}`;
      await _promises2.default.writeFile(_path2.default.join(dir, filename), buffer);
      (memo ).complianceDocumentPath = `uploads/compliance/${filename}`;
      (memo ).complianceDocumentName = originalName;
    }

    await memo.save();
    res.json({ data: memo });
  } catch (err) {
    console.error('[MEMO] Comply error:', err.message);
    res.status(500).json({ error: 'Failed to record compliance' });
  }
});

// ── PATCH /api/memos/:id/compliance — Update compliance remarks / replace document ──

router.patch('/:id/compliance', _auth.authenticate, _upload.upload.single('complianceDocument'), async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    if ((memo ).complianceStatus !== 'COMPLIED') {
      res.status(400).json({ error: 'Memo is not yet marked as complied' });
      return;
    }

    if (req.body.complianceRemarks !== undefined) {
      (memo ).complianceRemarks = req.body.complianceRemarks;
    }

    if (req.file) {
      // Delete old file if exists
      if ((memo ).complianceDocumentPath) {
        const oldPath = _path2.default.join(__dirname, '../..', (memo ).complianceDocumentPath);
        await _promises2.default.unlink(oldPath).catch(() => {});
      }
      let buffer = req.file.buffer;
      let originalName = req.file.originalname;
      const ext = _path2.default.extname(originalName).toLowerCase();
      const dir = _path2.default.join(__dirname, '../../uploads/compliance');
      await _promises2.default.mkdir(dir, { recursive: true });

      // Convert .doc to .docx at upload time for fast preview
      if (ext === '.doc') {
        try {
          const docxBuffer = await _dsrparser.convertDocToDocx.call(void 0, buffer);
          if (docxBuffer) {
            buffer = docxBuffer;
            originalName = originalName.replace(/\.doc$/i, '.docx');
          }
        } catch (convErr) {
          console.log('[MEMO] .doc conversion failed, saving original:', convErr.message);
        }
      }

      const saveExt = _path2.default.extname(originalName).toLowerCase();
      const filename = `compliance_${memo._id}_${Date.now()}${saveExt}`;
      await _promises2.default.writeFile(_path2.default.join(dir, filename), buffer);
      (memo ).complianceDocumentPath = `uploads/compliance/${filename}`;
      (memo ).complianceDocumentName = originalName;
    }

    await memo.save();
    res.json({ data: memo });
  } catch (err) {
    console.error('[MEMO] Update compliance error:', err.message);
    res.status(500).json({ error: 'Failed to update compliance' });
  }
});

// ── DELETE /api/memos/:id/compliance-document — Delete compliance document ───

router.delete('/:id/compliance-document', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    if (!(memo ).complianceDocumentPath) {
      res.status(404).json({ error: 'No compliance document found' });
      return;
    }
    const filePath = _path2.default.join(__dirname, '../..', (memo ).complianceDocumentPath);
    await _promises2.default.unlink(filePath).catch(() => {});
    (memo ).complianceDocumentPath = undefined;
    (memo ).complianceDocumentName = undefined;
    await memo.save();
    res.json({ data: memo });
  } catch (err) {
    console.error('[MEMO] Delete compliance doc error:', err.message);
    res.status(500).json({ error: 'Failed to delete compliance document' });
  }
});

// ── GET /api/memos/:id/compliance-document — Download compliance document ────

router.get('/:id/compliance-document', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findById(req.params.id).lean() ;
    if (!memo || !memo.complianceDocumentPath) {
      res.status(404).json({ error: 'No compliance document found' });
      return;
    }
    const filePath = _path2.default.join(__dirname, '../..', memo.complianceDocumentPath);
    const docName = memo.complianceDocumentName || 'compliance-document';

    // Legacy .doc files uploaded before conversion-at-upload was added
    if (/\.doc$/i.test(docName) && !/\.docx$/i.test(docName)) {
      try {
        const docBuffer = _fs2.default.readFileSync(filePath);
        const docxBuffer = await _dsrparser.convertDocToDocx.call(void 0, docBuffer);
        if (docxBuffer) {
          // Cache the converted file for future requests
          const docxName = docName.replace(/\.doc$/i, '.docx');
          const docxFilename = _path2.default.basename(filePath).replace(/\.doc$/i, '.docx');
          const docxPath = _path2.default.join(_path2.default.dirname(filePath), docxFilename);
          await _promises2.default.writeFile(docxPath, docxBuffer).catch(() => {});
          // Update DB so future requests skip conversion
          await _models.Memo.findByIdAndUpdate(req.params.id, {
            complianceDocumentPath: memo.complianceDocumentPath.replace(/\.doc$/i, '.docx'),
            complianceDocumentName: docxName,
          }).catch(() => {});
          res.setHeader('Content-Disposition', `attachment; filename="${docxName}"`);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          res.send(docxBuffer);
          return;
        }
      } catch (convErr) {
        console.log('[MEMO] .doc conversion failed, serving original:', convErr.message);
      }
    }

    res.download(filePath, docName);
  } catch (e12) {
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// ── DELETE /api/memos/:id ────────────────────────────────────────────────────

router.delete('/:id', _auth.authenticate, async (req, res) => {
  try {
    const memo = await _models.Memo.findByIdAndDelete(req.params.id);
    if (!memo) { res.status(404).json({ error: 'Memo not found' }); return; }
    res.json({ message: 'Memo deleted' });
  } catch (e13) {
    res.status(500).json({ error: 'Failed to delete memo' });
  }
});

exports. default = router;
