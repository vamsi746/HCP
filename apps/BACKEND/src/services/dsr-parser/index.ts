import mammoth from 'mammoth';
// @ts-ignore — no type declarations for word-extractor
import WordExtractor from 'word-extractor';
import { PoliceStation } from '../../models';

export interface ExtractedLocation {
  type: 'ps_reference' | 'residential' | 'incident_area';
  rawText: string;
  psName?: string;
}

export interface ParsedCase {
  slNo: number;
  zone: string;
  policeStation: string;
  sector: string;
  socialViceType: string;
  actionTakenBy: string;
  natureOfCase: string;
  crNo: string;
  sections: string;
  dor: string;
  psWithCrDetails: string;
  accusedParticulars: string;
  seizedProperty: string;
  seizedWorth: string;
  numAccused: number;
  numCases: number;
  abscondingAccused: number;
  crimeHead: string;
  accusedDetails: string;
  briefFacts: string;
  extractedLocations: ExtractedLocation[];
}

export interface DSRParseResult {
  reportDate: string;
  forceDescription: string;
  zoneCoverage: string;
  cases: ParsedCase[];
  rawText: string;
  totalCases: number;
}

// ── Text extraction ──────────────────────────────────────────────────────────

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromDoc(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody();
}

// ── HTML-based table extraction (preserves column structure) ─────────────────

export async function extractTableRowsFromDocx(buffer: Buffer): Promise<string[][]> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;

  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    // Match both <td> and <th> cells
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .trim();
      cells.push(cellText);
    }
    if (cells.length > 0) rows.push(cells);
  }

  console.log('[PARSER] extractTableRowsFromDocx: found', rows.length, 'rows');
  if (rows.length > 0) {
    console.log('[PARSER] first row cells:', rows[0].length, '- sample:', rows[0].map(c => c.slice(0, 40)));
  }
  if (rows.length > 1) {
    console.log('[PARSER] second row cells:', rows[1].length, '- sample:', rows[1].map(c => c.slice(0, 40)));
  }
  return rows;
}

// ── Normalization helpers ────────────────────────────────────────────────────

/** Collapse multiple whitespace/newlines into single space, trim */
function norm(s: string): string {
  return s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Normalize for comparison: lowercase, remove extra spaces, common substitutions */
function normCompare(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.]+/g, '').replace(/[''`]/g, '');
}

// ── Zone names ───────────────────────────────────────────────────────────────

const ZONE_NAMES = [
  'Charminar', 'Golconda', 'Golkonda', 'Falaknuma',
  'Jubilee Hills', 'Khairtabad', 'Khairthabad',
  'Rajendranagar', 'Secunderabad', 'Secundrabad',
  'Shamshabad', 'North', 'South', 'East', 'West', 'Central',
];

const ZONE_RE = new RegExp(
  `(${ZONE_NAMES.map(z => z.replace(/\s+/g, '\\s*')).join('|')})\\s*Zone`,
  'i'
);

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseTaskForceDSR(rawText: string): DSRParseResult {
  // Extract report date
  let reportDate = '';
  const dateMatch = rawText.match(/for\s+the\s+day\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i);
  if (dateMatch) {
    reportDate = dateMatch[1];
  } else {
    const datedMatch = rawText.match(/Dated:\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i);
    if (datedMatch) reportDate = datedMatch[1];
  }

  // Force description and zone coverage
  let forceDescription = '';
  let zoneCoverage = '';
  const forceMatch = rawText.match(/Commissioner[''\u2019]?s\s+Task\s+Force[,\s]*([\w\s&]+Zone)/i);
  if (forceMatch) {
    forceDescription = "Commissioner's Task Force";
    zoneCoverage = forceMatch[1].trim();
  }

  const cases = parseTableCases(rawText);

  // Enrich with detailed data from ANNEXURE-II (brief facts, detailed accused, detailed PS+Cr)
  enrichFromAnnexureII(rawText, cases);

  return {
    reportDate,
    forceDescription,
    zoneCoverage,
    cases,
    rawText,
    totalCases: cases.length,
  };
}

// ── Structured parser (HTML table rows with proper columns) ──────────────────

/**
 * Parse DSR from structured table rows extracted via mammoth HTML.
 * The actual document has 11 columns:
 *   0:  Sl. No
 *   1:  Zone, Name of the P.S., Sector
 *   2:  Social vice type
 *   3:  Action Taken by (Task Force, H-Fast, H-New)
 *   4:  Nature of Case (Crime Head)
 *   5:  Name of the P.S., Cr. No, U/Sec & D.O.R
 *   6:  Type of Work and Accused Particulars Name, Age, R/o
 *   7:  Seizer & Worth
 *   8:  No. of Accused
 *   9:  No. of Cases
 *   10: Absconding Accused
 */
export function parseStructuredDSR(rows: string[][], rawText: string): DSRParseResult {
  // Extract report date from raw text
  let reportDate = '';
  const dateMatch = rawText.match(/for\s+the\s+day\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i);
  if (dateMatch) {
    reportDate = dateMatch[1];
  } else {
    const datedMatch = rawText.match(/Dated:\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i);
    if (datedMatch) reportDate = datedMatch[1];
  }

  let forceDescription = '';
  let zoneCoverage = '';
  const forceMatch = rawText.match(/Commissioner[''\u2019]?s\s+Task\s+Force[,\s]*([\w\s&]+Zone)/i);
  if (forceMatch) {
    forceDescription = "Commissioner's Task Force";
    zoneCoverage = forceMatch[1].trim();
  }

  // Auto-detect column count from header row
  let colOffset = 0;
  for (const row of rows) {
    const joined = row.map(c => c.toLowerCase()).join('|');
    if (joined.includes('sl') && (joined.includes('zone') || joined.includes('p.s'))) {
      console.log('[PARSER-STRUCTURED] Header row detected with', row.length, 'columns:', row.map(c => c.slice(0, 30)));
      // If Sl.No is in its own column (11+ cols), offset = 0; if merged with zone (10 cols), offset = -1
      if (row.length >= 11) {
        colOffset = 0;
      } else if (row.length >= 10) {
        colOffset = -1; // Sl.No merged with zone column
      }
      break;
    }
  }

  const cases: ParsedCase[] = [];

  for (const row of rows) {
    if (row.length < 7) continue;

    // For data rows, check first cell starts with digit (Sl. No)
    const firstCell = (row[0] || '').trim();
    if (!/^\d+/.test(firstCell)) continue;
    if (/total\s*cases/i.test(row.join(' '))) continue;

    // Log row for debugging
    console.log(`[PARSER-STRUCTURED] Row (${row.length} cells):`, row.map(c => c.slice(0, 40)));

    // Determine column positions based on detected column count
    let colSlNo: string, colZonePS: string, colVice: string, colAction: string;
    let colNature: string, colCrDetails: string, colAccused: string;
    let colSeized: string, colNumAcc: string, colNumCases: string, colAbsconding: string;

    if (colOffset === 0 && row.length >= 11) {
      // 11-column layout: Sl.No is separate from Zone
      colSlNo     = row[0] || '';
      colZonePS   = row[1] || '';
      colVice     = row[2] || '';
      colAction   = row[3] || '';
      colNature   = row[4] || '';
      colCrDetails = row[5] || '';
      colAccused  = row[6] || '';
      colSeized   = row[7] || '';
      colNumAcc   = row[8] || '';
      colNumCases = row[9] || '';
      colAbsconding = row[10] || '';
    } else {
      // 10-column layout: Sl.No merged with Zone+PS+Sector
      colSlNo     = row[0] || '';
      colZonePS   = row[0] || ''; // same cell
      colVice     = row[1] || '';
      colAction   = row[2] || '';
      colNature   = row[3] || '';
      colCrDetails = row[4] || '';
      colAccused  = row[5] || '';
      colSeized   = row[6] || '';
      colNumAcc   = row[7] || '';
      colNumCases = row[8] || '';
      colAbsconding = row[9] || '';
    }

    // ── Sl. No ──
    const slMatch = colSlNo.match(/^(\d+)/);
    const slNo = slMatch ? parseInt(slMatch[1]) : cases.length + 1;

    // ── Zone, PS, Sector (from the zone+PS column) ──
    let zone = '';
    const zoneMatch = colZonePS.match(ZONE_RE);
    if (zoneMatch) zone = zoneMatch[0].replace(/\s+/g, ' ').trim();

    let policeStation = '';
    const psMatches = colZonePS.match(/\b([A-Za-z][A-Za-z .]{1,30}?)\s+PS\b/g);
    if (psMatches) {
      for (const psm of psMatches) {
        let cleaned = psm.replace(/\s+PS\s*$/i, '').trim();
        if (/^(SHO|the|of|to|from|Name|SI|DOR|Cr|U|IPC|BNS)$/i.test(cleaned)) continue;
        if (ZONE_NAMES.some(z => normCompare(cleaned) === normCompare(z))) continue;
        if (/Zone/i.test(cleaned)) continue;
        if (cleaned.length > 1 && cleaned.length < 35) {
          policeStation = cleaned;
          break;
        }
      }
    }

    let sector = '';
    const sectorMatch = colZonePS.match(/Sector\s*(\d+)/i);
    if (sectorMatch) sector = `Sector ${sectorMatch[1]}`;

    // ── Social Vice Type ──
    const socialViceType = norm(colVice) || 'None';

    // ── Action Taken By ──
    const actionTakenBy = norm(colAction) || 'Task Force';

    // ── Nature of Case (Crime Head) ──
    const natureOfCase = norm(colNature);

    // ── PS + Cr.No + U/Sec + DOR ──
    let crNo = '';
    const crMatch = colCrDetails.match(/Cr\.?\s*No\.?\s*:?\s*([\d\s/]+)/i);
    if (crMatch) crNo = crMatch[1].replace(/\s/g, '').trim();

    let sections = '';
    const secMatch = colCrDetails.match(/U\/s(?:ec)?\s+([\s\S]+?)(?:[,\s]+(?:DOR|D\.O\.R|dated)\b|\n\s*\n|$)/i);
    if (secMatch) sections = norm(secMatch[1]).replace(/[,\s]+$/, '');

    let dor = '';
    const dorMatch = colCrDetails.match(/(?:D\.?O\.?R\.?|dated)\s*[.:\s]\s*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
    if (dorMatch) dor = dorMatch[1];

    // ── Accused Particulars ──
    const accusedParticulars = norm(colAccused);

    // ── Seized Property + Worth ──
    const seizedProperty = norm(colSeized);
    let seizedWorth = '';
    const worthMatch = colSeized.match(/(?:W\/o|Worth\s*(?:of\s*)?|Total\s*(?:approx\s*)?)Rs\.?\s*:?\s*([\d,]+)/i);
    if (worthMatch) seizedWorth = 'Rs. ' + worthMatch[1].trim();

    // ── Counts ──
    const numAccused = parseInt(colNumAcc) || 0;
    const numCases = parseInt(colNumCases) || 1;
    const abscondingAccused = colAbsconding.trim() === '--' ? 0 : parseInt(colAbsconding) || 0;

    if (!policeStation && !crNo) continue;

    // De-duplicate
    const dupeKey = `${(crNo || '').toLowerCase()}|${(policeStation || '').toLowerCase()}`;
    if (dupeKey !== '|' && cases.some(c => `${(c.crNo || '').toLowerCase()}|${(c.policeStation || '').toLowerCase()}` === dupeKey)) continue;

    const extractedLocations = extractLocations(colZonePS + ' ' + colAccused, policeStation);

    console.log(`[PARSER-STRUCTURED] Case ${slNo}: zone=${zone}, PS=${policeStation}, sector=${sector}, crNo=${crNo}, action=${actionTakenBy}, vice=${socialViceType}`);

    cases.push({
      slNo, zone, policeStation, sector,
      socialViceType, actionTakenBy,
      natureOfCase, crNo, sections, dor,
      psWithCrDetails: norm(colCrDetails),
      accusedParticulars,
      seizedProperty, seizedWorth,
      numAccused: numAccused || 1,
      numCases: numCases || 1,
      abscondingAccused,
      crimeHead: natureOfCase,
      accusedDetails: accusedParticulars,
      briefFacts: '',
      extractedLocations,
    });
  }

  // Enrich with Annexure II (brief facts, detailed accused)
  enrichFromAnnexureII(rawText, cases);

  console.log('[PARSER-STRUCTURED] Total cases parsed:', cases.length);

  return {
    reportDate,
    forceDescription,
    zoneCoverage,
    cases,
    rawText,
    totalCases: cases.length,
  };
}

// ── Table-based case parsing ─────────────────────────────────────────────────

/**
 * The DSR document is a Word table. Mammoth extracts raw text where cells become
 * text blocks separated by newlines. Each case starts with a zone name (e.g.
 * "Charminar\n\nZone") followed by PS, Sector, then case details, ending with
 * count columns like "01\n\n01\n\n--".
 *
 * The document also has a narrative section after "Total Cases:" which we must skip.
 */
function parseTableCases(rawText: string): ParsedCase[] {
  const cases: ParsedCase[] = [];

  // Find start of data: after the last header keyword "Absconding Accused"
  const headerEndMatch = rawText.match(/Absconding\s+Accused/i);
  if (!headerEndMatch) {
    const annIdx = rawText.search(/ANNEXURE[\s-]*I\b/i);
    if (annIdx < 0) return cases;
  }
  const startIdx = headerEndMatch
    ? headerEndMatch.index! + headerEndMatch[0].length
    : 0;
  let body = rawText.slice(startIdx);

  // Stop at "Total Cases:" — everything after is summary/narrative sections
  const totalCasesIdx = body.search(/Total\s+Cases\s*:/i);
  if (totalCasesIdx > 0) {
    body = body.slice(0, totalCasesIdx);
  }

  console.log('[PARSER] body length after trim:', body.length);

  // Each case ends with count columns: "NN\n\nNN\n\n--" or "--\n\nNN\n\nNN\n\n--"
  // Split the body by these trailing count patterns
  // Pattern: optional whitespace, then 2-3 groups of (number or --) separated by newlines
  const caseBlocks: string[] = [];
  const countSplitter = /\n\s*(\d{1,2}|--)\s*\n\s*(\d{1,2}|--)\s*\n\s*(\d{1,2}|--)\s*\n/g;

  let lastEnd = 0;
  let cm: RegExpExecArray | null;
  const splits: { blockEnd: number; countEnd: number; counts: string[] }[] = [];

  while ((cm = countSplitter.exec(body)) !== null) {
    splits.push({
      blockEnd: cm.index,
      countEnd: cm.index + cm[0].length,
      counts: [cm[1], cm[2], cm[3]],
    });
  }

  console.log('[PARSER] count-row splits found:', splits.length);

  if (splits.length === 0) {
    // Fallback: treat entire body as one block
    const parsed = parseCaseBlock(body.trim(), 1);
    if (parsed) cases.push(parsed);
    return cases;
  }

  for (let i = 0; i < splits.length; i++) {
    const start = i === 0 ? 0 : splits[i - 1].countEnd;
    const end = splits[i].countEnd;
    const blockText = body.slice(start, end).trim();

    if (blockText.length < 20) continue; // skip empty/noise

    const parsed = parseCaseBlock(blockText, cases.length + 1);
    if (parsed) {
      // Apply counts from the split
      const [c1, c2, c3] = splits[i].counts;
      if (!parsed.numAccused) parsed.numAccused = c1 === '--' ? 0 : parseInt(c1) || 0;
      if (!parsed.numCases) parsed.numCases = c2 === '--' ? 0 : parseInt(c2) || 0;
      if (!parsed.abscondingAccused) parsed.abscondingAccused = c3 === '--' ? 0 : parseInt(c3) || 0;

      // De-duplicate: skip if same crNo + PS already exists (annexure repeats cases)
      const dupeKey = `${(parsed.crNo || '').toLowerCase()}|${(parsed.policeStation || '').toLowerCase()}`;
      if (dupeKey !== '|' && cases.some(c => `${(c.crNo || '').toLowerCase()}|${(c.policeStation || '').toLowerCase()}` === dupeKey)) {
        continue;
      }

      console.log(`[PARSER] Case ${parsed.slNo}: zone=${parsed.zone}, PS=${parsed.policeStation}, sector=${parsed.sector}, crNo=${parsed.crNo}`);
      cases.push(parsed);
    }
  }

  return cases;
}

function parseCaseBlock(block: string, slNo: number): ParsedCase | null {
  // Fix mammoth concatenation artifacts where cell boundaries are lost
  // "ZoneHussaini" → "Zone\nHussaini", "PSSector" → "PS\nSector"
  block = block
    .replace(/Zone(?=[A-Z])/g, 'Zone\n')
    .replace(/PS(?=Sector)/gi, 'PS\n')
    .replace(/PS(?=[A-Z][a-z])/g, 'PS\n');

  // ─── ZONE + PS + SECTOR ───
  let zone = '';
  let policeStation = '';
  let sector = '';

  const zoneMatch = block.match(ZONE_RE);
  if (zoneMatch) {
    zone = zoneMatch[0].replace(/\s+/g, ' ').trim();
  }

  // Police station: "XXX PS" pattern on a SINGLE LINE — \s must not cross newlines
  // Match word chars + spaces (no newlines) before " PS"
  const psMatches = block.match(/\b([A-Za-z][A-Za-z .]{1,30}?)\s+PS\b/g);
  if (psMatches) {
    for (const psm of psMatches) {
      let cleaned = psm.replace(/\s+PS\s*$/i, '').trim();
      // Skip noise words
      if (/^(SHO|the|of|to|from|Name|SI|DOR|Cr|U|IPC|BNS)$/i.test(cleaned)) continue;
      // Skip zone names that got concatenated
      if (ZONE_NAMES.some(z => normCompare(cleaned) === normCompare(z))) continue;
      // Skip if contains "Zone" — it's part of the zone header, not a PS name
      if (/Zone/i.test(cleaned)) continue;
      // Skip "of PS" patterns (e.g. "Rowdy Sheeter of PS Mirchowk")
      const psIdx = block.indexOf(psm);
      const before = block.slice(Math.max(0, psIdx - 30), psIdx);
      if (/of\s*$/i.test(before.trim())) continue;
      if (cleaned.length > 1 && cleaned.length < 35) {
        policeStation = cleaned;
        break;
      }
    }
  }

  // Sector: "Sector 1", "Sector 2", etc.
  const sectorMatch = block.match(/Sector\s*(\d+)/i);
  if (sectorMatch) {
    sector = `Sector ${sectorMatch[1]}`;
  }

  // ─── SOCIAL VICE TYPE ───
  // Appears after the zone/PS/sector block. Common values: None, Gambling, Narcotics, Food Adulteration, etc.
  let socialViceType = 'None';
  const viceTypes = [
    'Gambling', 'Narcotics', 'Food Adulteration', 'Prostitution',
    'Liquor', 'Excise', 'Betting', 'Online Cricket Betting',
    'Bootlegging', 'Immoral Trafficking',
  ];
  for (const vt of viceTypes) {
    const vtNorm = normCompare(vt);
    if (normCompare(block).includes(vtNorm)) {
      socialViceType = vt;
      break;
    }
  }
  // Also check the block for explicit "None" near the social vice position
  // The social vice column appears right after sector info

  // ─── ACTION TAKEN BY ───
  let actionTakenBy = 'Task Force'; // default
  // Look ONLY between the sector/PS info and the Cr.No line — not full block
  // This avoids matching "H-Fast" or "H-New" from header text or brief facts
  const sectorEnd = block.search(/Sector\s*\d/i);
  const crStart = block.search(/Cr\.?\s*No\.?\s*:?\s*\d/i);
  if (sectorEnd >= 0 && crStart > sectorEnd) {
    const actionArea = block.slice(sectorEnd, crStart);
    if (/\bH[-\s]*Fast\b/i.test(actionArea)) {
      actionTakenBy = 'H-Fast';
    } else if (/\bH[-\s]*New\b/i.test(actionArea)) {
      actionTakenBy = 'H-New';
    }
    // Otherwise stays "Task Force" (default)
  }

  // ─── NATURE OF CASE (Crime Head) ───
  let natureOfCase = '';
  // Look for text patterns that describe the nature — typically between social vice and CR details
  // Common patterns: "Murder & Kidnap", "Health Hazardous", "Robbery", "Attempt to Murder", "Gaming Act", "NDPS Act"
  const crimePatterns = [
    /Murder\s*(?:&|and)?\s*Kidnap(?:ping)?/i,
    /Attempt\s+to\s+Murder/i,
    /Health\s+Hazardous/i,
    /Robbery/i,
    /Gaming\s+Act/i,
    /NDPS\s+Act/i,
    /Dacoity/i,
    /Theft/i,
    /Cheating/i,
    /Chain\s+Snatching/i,
    /Burglary/i,
  ];

  // Extract the full "Nature of Case" block including parenthetical details
  // It's between the social vice type / zone+PS block and the CR number block
  const crIdx = block.search(/Cr\.?\s*No\.?\s*:?\s*\d/i);
  if (crIdx > 0) {
    // Look backwards from Cr.No to find the nature block
    // Find the PS line first
    const psLineMatch = block.match(new RegExp(`${policeStation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+PS`, 'i'));
    let natureStart = 0;
    if (psLineMatch && psLineMatch.index !== undefined) {
      // Nature is between the first PS mention (zone block) and the second PS mention (Cr details)
      // Find second occurrence of "PS Name PS"
      const firstPSEnd = psLineMatch.index + psLineMatch[0].length;
      const afterFirstPS = block.slice(firstPSEnd);
      const sectorEnd = afterFirstPS.search(/Sector\s*\d/i);
      if (sectorEnd >= 0) {
        natureStart = firstPSEnd + sectorEnd;
        const sectorLineEnd = afterFirstPS.slice(sectorEnd).search(/\n/);
        if (sectorLineEnd >= 0) {
          natureStart = firstPSEnd + sectorEnd + sectorLineEnd;
        }
      } else {
        natureStart = firstPSEnd;
      }
    }

    if (natureStart > 0 && natureStart < crIdx) {
      const rawNature = block.slice(natureStart, crIdx).trim();
      // Remove the social vice type text if it appears, and the PS name that starts the Cr.No block
      let cleaned = rawNature;
      // Remove leading "None" or social vice type
      cleaned = cleaned.replace(/^\s*None\s*/i, '');
      for (const vt of viceTypes) {
        cleaned = cleaned.replace(new RegExp(`^\\s*${vt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '');
      }
      // Remove trailing PS name (which is start of Cr section)
      if (policeStation) {
        const psEsc = policeStation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`\\s*${psEsc}\\s+PS\\s*$`, 'i'), '');
      }
      natureOfCase = norm(cleaned);
    }
  }

  // Fallback: try known crime patterns
  if (!natureOfCase) {
    for (const pat of crimePatterns) {
      const crimeM = block.match(pat);
      if (crimeM) {
        // Get surrounding context
        const ci = crimeM.index!;
        const end = Math.min(ci + 150, block.length);
        let raw = block.slice(ci, end);
        // Stop at newline or Cr.No
        const stopIdx = raw.search(/\n\s*\n|Cr\.?\s*No/i);
        if (stopIdx > 0) raw = raw.slice(0, stopIdx);
        natureOfCase = norm(raw);
        break;
      }
    }
  }

  // ─── PS + Cr.No + Sections + DOR ───
  let crNo = '';
  let sections = '';
  let dor = '';
  let psWithCrDetails = '';

  const crMatch = block.match(/Cr\.?\s*No\.?\s*:?\s*([\d\s/]+)/i);
  if (crMatch) crNo = crMatch[1].replace(/\s/g, '').trim();

  // Sections
  const secMatch = block.match(/U\/s(?:ec)?\s+([\s\S]+?)(?:[,\s]+(?:DOR|D\.O\.R|dated)\b|\n\s*\n)/i);
  if (secMatch) {
    let secText = secMatch[1].replace(/\s+/g, ' ').trim();
    secText = secText.replace(/[,\s]+of\s+(?:PS\s+[\w][\w\s]*|[\w][\w\s]*?\s+PS)\s*$/i, '').trim();
    secText = secText.replace(/[,\s]+$/, '').trim();
    sections = secText;
  }

  // DOR
  const dorMatch = block.match(/(?:D\.?O\.?R\.?|dated)\s*[.:\s]\s*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
  if (dorMatch) dor = dorMatch[1];

  // Full PS + Cr details block
  if (policeStation && crIdx > 0) {
    // Find where this block starts (second PS mention with Cr.No)
    const crBlockStart = block.lastIndexOf(policeStation, crIdx);
    if (crBlockStart >= 0) {
      // Find where accused details start: "Apprehended"
      const accIdx = block.search(/Apprehended/i);
      const blockEnd = accIdx > crIdx ? accIdx : crIdx + 200;
      psWithCrDetails = norm(block.slice(crBlockStart, blockEnd));
    } else {
      // Just capture from Cr.No backwards a bit
      const startSearch = Math.max(0, crIdx - 80);
      const accIdx = block.search(/Apprehended/i);
      const blockEnd = accIdx > crIdx ? accIdx : crIdx + 200;
      psWithCrDetails = norm(block.slice(startSearch, blockEnd));
    }
  }

  // ─── ACCUSED PARTICULARS (full text) ───
  let accusedParticulars = '';
  const apprehendedMatch = block.match(/Apprehended[\s\S]*/i);
  if (apprehendedMatch) {
    let accText = apprehendedMatch[0];
    // Try to find where seized section starts, or end of accused
    const seizedIdx = accText.search(/\bSeized\s*:/i);
    const dashIdx = accText.search(/\n\s*--\s*\n/);
    // Also find number columns at end: patterns like just "01\t01\t--" or "02\t01\t--"
    const numColIdx = accText.search(/\n\s*\d{1,2}\s+\d{1,2}\s+(?:--|\d{1,2})\s*$/m);

    let endIdx = accText.length;
    if (seizedIdx > 0) endIdx = Math.min(endIdx, seizedIdx);
    if (dashIdx > 0) endIdx = Math.min(endIdx, dashIdx);
    if (numColIdx > 0) endIdx = Math.min(endIdx, numColIdx);
    accusedParticulars = norm(accText.slice(0, endIdx));
  }

  // ─── SEIZED PROPERTY & WORTH ───
  let seizedProperty = '';
  let seizedWorth = '';

  const seizedMatch = block.match(/Seized\s*:?\s*([\s\S]*?)(?:\n\s*\d{1,2}\s+\d{1,2}\s+(?:--|\d)|$)/i);
  if (seizedMatch) {
    let seizedText = seizedMatch[1];
    // Extract worth
    const worthMatch = seizedText.match(/(?:Total\s*(?:approx\s*)?)?(?:W\/o|Worth\s*(?:of\s*)?)\s*Rs\.?\s*:?\s*([\d,]+(?:\/-?)?)/i);
    if (worthMatch) {
      seizedWorth = 'Rs. ' + worthMatch[1].trim();
    }
    seizedProperty = norm(seizedText).slice(0, 800);
  }

  // If no separate seized section, check for "Worth of Rs:" in the accused block
  if (!seizedWorth) {
    const worthFallback = block.match(/(?:Total\s*(?:approx\s*)?)?(?:W\/o|Worth\s*(?:of\s*)?)\s*Rs\.?\s*:?\s*([\d,]+(?:\/-?)?)/i);
    if (worthFallback) seizedWorth = 'Rs. ' + worthFallback[1].trim();
  }

  // ─── COUNTS ───
  // These appear as the last 3 values in each row: No.Accused, No.Cases, Absconding
  let numAccused = 0;
  let numCases = 0;
  let abscondingAccused = 0;

  // Try to find trailing count columns: e.g. "01\t01\t--" or "02  01  --" or "01  01  01"
  const countMatch = block.match(/\b(\d{1,2})\s+(\d{1,2})\s+(--|\d{1,2})\s*$/);
  if (countMatch) {
    numAccused = parseInt(countMatch[1]) || 0;
    numCases = parseInt(countMatch[2]) || 0;
    abscondingAccused = countMatch[3] === '--' ? 0 : parseInt(countMatch[3]) || 0;
  }

  // Fallback: parse from "Apprehended (XX)" text
  if (!numAccused) {
    const accusedCountMatch = block.match(/(?:Apprehended|arrested)\s*\(?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\)?/i);
    if (accusedCountMatch) {
      const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
      const val = accusedCountMatch[1].toLowerCase();
      numAccused = wordToNum[val] || parseInt(val) || 1;
    }
  }
  if (!numCases) numCases = 1;

  // ─── Skip if no usable data ───
  console.log(`[PARSER] parseCaseBlock slNo=${slNo}: zone='${zone}' PS='${policeStation}' sector='${sector}' crNo='${crNo}'`);
  if (!policeStation && !crNo) return null;

  const extractedLocations = extractLocations(block, policeStation);

  return {
    slNo,
    zone,
    policeStation,
    sector,
    socialViceType,
    actionTakenBy,
    natureOfCase: natureOfCase || '',
    crNo,
    sections,
    dor,
    psWithCrDetails,
    accusedParticulars,
    seizedProperty,
    seizedWorth,
    numAccused: numAccused || 1,
    numCases: numCases || 1,
    abscondingAccused,
    crimeHead: natureOfCase, // alias
    accusedDetails: accusedParticulars, // alias
    briefFacts: '',
    extractedLocations,
  };
}

// ── ANNEXURE-II Enrichment ───────────────────────────────────────────────────

/**
 * Enrich parsed cases (from Annexure I) with detailed data from ANNEXURE-II.
 * Annexure II has three extra columns not fully captured in Annexure I:
 *   1. PS + Cr.No + Sections + DOR (more detail: LPC numbers, filing info)
 *   2. Details of Accused (full: S/o, house no, phone numbers)
 *   3. BRIEF FACTS (narrative paragraph — completely absent from Annexure I)
 *
 * Matching is done by Cr.No.
 */
function enrichFromAnnexureII(rawText: string, cases: ParsedCase[]): void {
  // Try multiple patterns for Annexure II header
  let annIdx = rawText.search(/ANNEXURE[\s\-–]*II\b/i);
  if (annIdx < 0) annIdx = rawText.search(/ANNEXURE[\s\-–]*2\b/i);
  if (annIdx < 0) annIdx = rawText.search(/ANNEX[\s\-–]*II\b/i);
  if (annIdx < 0) {
    console.log('[PARSER] No ANNEXURE-II section found in', rawText.length, 'chars');
    // Log last 500 chars to see what's at the end of the document
    console.log('[PARSER] Last 500 chars:', rawText.slice(-500));
    return;
  }
  const annBody = rawText.slice(annIdx);
  console.log('[PARSER] ANNEXURE-II found at index', annIdx, ', enriching', cases.length, 'cases');
  console.log('[PARSER] AnnII first 500 chars:', annBody.slice(0, 500));

  for (const c of cases) {
    if (!c.crNo) continue;

    // Build flexible regex for this case's Cr.No (allow whitespace around /)
    const crEsc = c.crNo
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\//g, '\\s*/\\s*');
    const crRe = new RegExp('Cr\\.?\\s*No\\.?\\s*[:.]?\\s*' + crEsc, 'i');
    const crM = crRe.exec(annBody);
    if (!crM) {
      console.log(`[PARSER] AnnII: crNo ${c.crNo} not found`);
      continue;
    }

    // Window: 200 chars before Cr.No (for PS name), 5000 chars after (for full block)
    const winStart = Math.max(0, crM.index - 200);
    const winEnd = Math.min(annBody.length, crM.index + 5000);
    const win = annBody.slice(winStart, winEnd);
    const crOff = crM.index - winStart;

    // Text after Cr.No match within this window
    const afterCr = win.slice(crOff);

    // ── 1. BRIEF FACTS ──
    // Always starts with "On DD-MM-YYYY" or "On DD.MM.YYYY" narrative
    // Try with newline first, then without (word-extractor may not preserve newlines the same way)
    let onDateM = afterCr.match(/\n\s*(On\s+\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
    if (!onDateM) {
      // Fallback: match "On date" anywhere after Cr.No details (without requiring leading newline)
      onDateM = afterCr.match(/(On\s+\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
    }
    if (!onDateM || onDateM.index === undefined) {
      console.log(`[PARSER] AnnII: No "On date" brief facts for crNo ${c.crNo}`);
      continue;
    }
    const briefStartIdx = onDateM.index + (onDateM[0].startsWith('\n') ? 1 : 0);

    // Brief facts ends at "Hence...for further action/handed over" sentence
    // The Hence line may or may not end with a period — stop at end of line
    const factsText = afterCr.slice(briefStartIdx);
    let briefEnd: number;

    // Primary: find "Hence" sentence ending with "for further action." or "handed over...action."
    // Stop at the period (.) after the action/over keyword — don't grab leaked column data
    const henceM = factsText.match(/Hence[^\n]*?(?:for\s+further|handed?\s+over|handing\s+over)[^.\n]*\./i);
    if (henceM) {
      briefEnd = henceM.index! + henceM[0].length;
    } else {
      // Fallback: stop at double-newline followed by dashes/numbers (count columns)
      const countColM = factsText.search(/\n\s*--\s*\n|\n\s*\d{1,2}\s*\n\s*(?:--|\d)/);
      if (countColM > 0) {
        briefEnd = countColM;
      } else {
        briefEnd = Math.min(factsText.length, 2000);
      }
    }
    c.briefFacts = norm(factsText.slice(0, briefEnd));
    console.log(`[PARSER] AnnII: briefFacts for ${c.crNo}: ${c.briefFacts.slice(0, 100)}...`);

    // ── 2. ACCUSED DETAILS (enriched) ──
    // Find first person-name marker (S/o, Age:) between Cr.No block and Brief Facts
    const nameMarkerM = afterCr.match(/(?:S\/o|s\/o|Age\s*:|,\s*age\s*:)/i);
    if (nameMarkerM && nameMarkerM.index !== undefined && nameMarkerM.index < briefStartIdx) {
      // Go back to start of line containing the name
      const beforeMarker = afterCr.slice(0, nameMarkerM.index);
      const lastNL = beforeMarker.lastIndexOf('\n');
      const accusedStart = lastNL >= 0 ? lastNL + 1 : 0;

      if (accusedStart < briefStartIdx) {
        const accusedText = norm(afterCr.slice(accusedStart, briefStartIdx));
        if (accusedText.length > 5) {
          c.accusedParticulars = accusedText;
          c.accusedDetails = accusedText;
        }
      }

      // ── 3. PS + CR DETAILS (enriched) ──
      // From Cr.No to the accused name start
      const psCrRaw = afterCr.slice(0, accusedStart);
      // Find PS name in the text before Cr.No
      const preCr = win.slice(Math.max(0, crOff - 150), crOff);
      let psName = '';
      if (c.policeStation) {
        const psIdx = preCr.lastIndexOf(c.policeStation);
        if (psIdx >= 0) {
          psName = norm(preCr.slice(psIdx)) + ' ';
        }
      }
      const enrichedPsCr = norm(psName + psCrRaw);
      if (enrichedPsCr.length > 0) {
        c.psWithCrDetails = enrichedPsCr;
      }
    }
  }
}

// ── Location / Area Extraction ──────────────────────────────────────────────

function extractLocations(text: string, primaryPS: string): ExtractedLocation[] {
  const locations: ExtractedLocation[] = [];
  const seen = new Set<string>();

  const addLocation = (type: ExtractedLocation['type'], rawText: string, psName?: string) => {
    const key = `${type}:${rawText.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push({ type, rawText: rawText.trim(), psName: psName?.trim() });
  };

  // All "XXX PS" references
  const psRefs = text.matchAll(/\b([\w][\w\s]{1,25}?)\s+PS\b/gi);
  for (const m of psRefs) {
    let name = m[1].trim();
    if (/^(SHO|the|of|to|from|and|for|over)$/i.test(name)) continue;
    const words = name.split(/\s+/);
    if (words.length > 3) name = words.slice(-2).join(' ');
    if (name.length > 1) addLocation('ps_reference', `${name} PS`, name);
  }

  // "R/o" residential addresses
  const roMatches = text.matchAll(/R\/o\s*:?\s*([\s\S]{5,200}?)(?:,\s*Hyderabad|,\s*Hyd|[\.\n]|Phone|Ph\.|\d{10}|who\b)/gi);
  for (const m of roMatches) {
    const addr = m[1].replace(/\s+/g, ' ').trim();
    if (addr.length > 3) {
      const areaPSName = extractPSFromAddress(addr);
      addLocation('residential', addr, areaPSName);
    }
  }

  // "limits of XXX PS"
  const limitsMatches = text.matchAll(/limits\s+of\s+([\w\s]+?)(?:\s+Police\s+Station|\s+PS)\b/gi);
  for (const m of limitsMatches) {
    addLocation('incident_area', m[0].trim(), m[1].trim());
  }

  return locations;
}

function extractPSFromAddress(address: string): string | undefined {
  const areaMatch = address.match(/([\w]+(?:\s+[\w]+)?)\s*(?:,\s*(?:Hyderabad|Hyd))?$/i);
  if (areaMatch) return areaMatch[1].trim();
  return undefined;
}

// ── Police Station Matching ─────────────────────────────────────────────────

function cleanPSName(name: string): string {
  return name.replace(/^\s*(?:of|the|from|to|at|near|and|over|under)\s+/i, '').trim();
}

// Simple Levenshtein edit distance
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Strip vowels to get consonant skeleton — handles transliteration variants
// e.g. "shalibanda" → "shlbnd", "shahalibanda" → "shhlbnd"
function consonantSkeleton(s: string): string {
  return s.replace(/[aeiou]/gi, '');
}

// Collapse repeated consonants: "shhlbnd" → "shlbnd"
function collapsedSkeleton(s: string): string {
  return consonantSkeleton(s).replace(/(.)\1+/g, '$1');
}

export async function matchPoliceStation(rawName: string): Promise<string | null> {
  if (!rawName) return null;

  const cleaned = cleanPSName(rawName);
  const normalized = cleaned.toLowerCase().replace(/\s*ps\s*$/i, '').replace(/\s+/g, '').trim();
  if (!normalized) return null;

  const stations = await PoliceStation.find({}).lean();

  const normDb = (name: string | undefined) => (name || '').toLowerCase().replace(/\s*ps\s*$/i, '').replace(/\s+/g, '');

  // 1. Exact match
  for (const s of stations) {
    if (normDb(s.name) === normalized) return s._id.toString();
  }

  // 2. Contains match (one is substring of the other)
  for (const s of stations) {
    const db = normDb(s.name);
    if (db.includes(normalized) || normalized.includes(db)) return s._id.toString();
  }

  // 3. First-word prefix match (4+ chars)
  const firstWord = normalized.split(/(?=[A-Z])/)[0] || normalized.slice(0, Math.min(6, normalized.length));
  if (firstWord && firstWord.length >= 4) {
    for (const s of stations) {
      if (normDb(s.name).startsWith(firstWord)) return s._id.toString();
    }
  }

  // 4. Consonant skeleton match — catches transliteration variants like
  //    Shalibanda↔Shahalibanda, Mirchowk↔Mirchok, Chaderghat↔Chadarghat
  const inputSkeleton = collapsedSkeleton(normalized);
  if (inputSkeleton.length >= 4) {
    for (const s of stations) {
      const dbSkeleton = collapsedSkeleton(normDb(s.name));
      if (dbSkeleton === inputSkeleton) return s._id.toString();
    }
    // Also check if one skeleton contains the other
    for (const s of stations) {
      const dbSkeleton = collapsedSkeleton(normDb(s.name));
      if (dbSkeleton.length >= 4 && (dbSkeleton.includes(inputSkeleton) || inputSkeleton.includes(dbSkeleton))) {
        return s._id.toString();
      }
    }
  }

  // 5. Fuzzy match: edit distance ≤ 3 for names ≥ 5 chars
  if (normalized.length >= 5) {
    let bestDist = Infinity;
    let bestId: string | null = null;
    for (const s of stations) {
      const db = normDb(s.name);
      if (db.length >= 5) {
        const dist = editDistance(normalized, db);
        if (dist <= 3 && dist < bestDist) {
          bestDist = dist;
          bestId = s._id.toString();
        }
      }
    }
    if (bestId) return bestId;
  }

  return null;
}
