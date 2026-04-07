import mammoth from 'mammoth';
import { PoliceStation } from '../../models';

export interface ExtractedLocation {
  type: 'ps_reference' | 'residential' | 'incident_area';
  rawText: string;
  psName?: string;
}

export interface ParsedCase {
  slNo: number;
  zone: string;
  crimeHead: string;
  policeStation: string;
  crNo: string;
  sections: string;
  dor: string;
  accusedDetails: string;
  briefFacts: string;
  seizedProperty: string;
  seizedWorth: string;
  numAccused: number;
  numCases: number;
  abscondingAccused: string;
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

// Zone names found in HCP DSR documents
const ZONE_NAME_LIST = [
  'Charminar', 'Golconda', 'Golkonda', 'Falaknuma',
  'Jubilee\\s*Hills?', 'Khairtabad', 'Khairthabad',
  'Rajendranagar', 'Secundrabad', 'Secunderabad',
  'Shamshabad', 'North', 'South', 'East', 'West', 'Central',
];
const ZONE_ALTERNATION = ZONE_NAME_LIST.join('|');

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function parseTaskForceDSR(rawText: string): DSRParseResult {
  // Report date
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

  // Split into annexures — ANNEXURE-II may not have ANNEXURE-III as end marker
  const annexure1Match = rawText.match(/ANNEXURE[\s-]*I\b([\s\S]*?)(?=ANNEXURE[\s-]*II\b)/i);

  // For ANNEXURE-II, capture to end of text, then trim at ANNEXURE-III if present
  const annexure2Match = rawText.match(/ANNEXURE[\s-]*II\b([\s\S]*)$/i);
  let annexure2Text = annexure2Match ? annexure2Match[1] : '';
  const ann3Idx = annexure2Text.search(/ANNEXURE[\s-]*III\b|A\s*N\s*N\s*E\s*X\s*U\s*R\s*E\s*[\s\u2013\u2013\u2014–-]*III/i);
  if (ann3Idx > 0) annexure2Text = annexure2Text.slice(0, ann3Idx);

  const annexure1Text = annexure1Match ? annexure1Match[1] : '';

  const cases = extractCases(annexure1Text, annexure2Text);

  return {
    reportDate,
    forceDescription,
    zoneCoverage,
    cases,
    rawText,
    totalCases: cases.length,
  };
}

// ── Case Block Splitting (zone-header based) ────────────────────────────────

interface CaseBlock { slNo: number; text: string; }

function splitIntoCaseBlocks(text: string): CaseBlock[] {
  const blocks: CaseBlock[] = [];

  // Each case starts with a zone header: "Charminar\n\nZone\n" or "Golconda Zone\n"
  // Require "Zone" to be followed by newline — excludes inline mentions like "Charminar Zone SI Sri..."
  const zoneRegex = new RegExp(
    `(?:${ZONE_ALTERNATION})\\s*\\n*\\s*Zone\\s*\\n`,
    'gi'
  );

  const matches: { index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = zoneRegex.exec(text)) !== null) {
    matches.push({ index: m.index });
  }

  if (matches.length === 0) return blocks;

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    let blockText = text.slice(start, end).trim();

    // Remove trailing TOTAL summary if present
    blockText = blockText.replace(/\bTOTAL\b[\s\S]*$/, '').trim();

    if (blockText.length < 20) continue;
    // Skip if this is just a column header (contains "Nature of Case" nearby)
    if (/Nature\s+of\s+Case/i.test(blockText.slice(0, 100))) continue;

    blocks.push({ slNo: i + 1, text: blockText });
  }

  return blocks;
}

function extractCases(annexure1: string, annexure2: string): ParsedCase[] {
  // Prefer ANNEXURE-II (detailed), fall back to ANNEXURE-I
  const primaryText = annexure2 || annexure1;
  if (!primaryText.trim()) return [];

  const primaryBlocks = splitIntoCaseBlocks(primaryText);
  const cases: ParsedCase[] = [];
  for (const block of primaryBlocks) {
    const parsed = parseSingleCase(block.text, block.slNo);
    if (parsed) cases.push(parsed);
  }

  // Enrich from the other annexure
  const secondaryText = annexure2 ? annexure1 : '';
  if (secondaryText) {
    const secBlocks = splitIntoCaseBlocks(secondaryText);
    for (let i = 0; i < secBlocks.length && i < cases.length; i++) {
      const enriched = parseSingleCase(secBlocks[i].text, secBlocks[i].slNo);
      if (!enriched) continue;
      const target = cases[i];
      if (!target.seizedProperty && enriched.seizedProperty) target.seizedProperty = enriched.seizedProperty;
      if (!target.seizedWorth && enriched.seizedWorth) target.seizedWorth = enriched.seizedWorth;
      if (!target.numAccused && enriched.numAccused) target.numAccused = enriched.numAccused;
      if (!target.accusedDetails && enriched.accusedDetails) target.accusedDetails = enriched.accusedDetails;
      if (!target.briefFacts && enriched.briefFacts) target.briefFacts = enriched.briefFacts;
      for (const loc of enriched.extractedLocations) {
        if (!target.extractedLocations.some((e) => e.rawText === loc.rawText)) {
          target.extractedLocations.push(loc);
        }
      }
    }
  }

  return cases;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function cleanPSName(name: string): string {
  return name.replace(/^\s*(?:of|the|from|to|at|near|and|over|under)\s+/i, '').trim();
}

// ── Single Case Parsing ─────────────────────────────────────────────────────

function parseSingleCase(text: string, slNo: number): ParsedCase | null {
  // === ZONE ===
  const zoneRegex = new RegExp(`^((?:${ZONE_ALTERNATION})\\s*\\n*\\s*Zone)`, 'i');
  const zoneMatch = text.match(zoneRegex);
  const zone = zoneMatch ? zoneMatch[1].replace(/\s*\n+\s*/g, ' ').trim() : '';

  // === POLICE STATION ===
  // PS appears on its own line before Cr.No: "Shalibanda PS" standalone
  let policeStation = '';
  const psLines = text.match(/^\s*([\w][\w\s]{1,35}?)\s+PS\s*$/gm);
  if (psLines) {
    // Take the FIRST standalone "Name PS" line (skip any in crime head parens)
    for (const line of psLines) {
      const m = line.match(/^\s*([\w][\w\s]{1,35}?)\s+PS\s*$/i);
      if (m) {
        let name = m[1].trim();
        // If multiline name, take last line
        const parts = name.split(/\n/).filter(l => l.trim());
        name = parts[parts.length - 1].trim();
        // Skip noise like "SHO" references or column headers
        if (/^(SHO|the|of|to|Name|SI)$/i.test(name)) continue;
        if (name.length > 1 && name.length < 35) {
          policeStation = name;
          break;
        }
      }
    }
  }

  // === CRIME HEAD ===
  let crimeHead = '';
  if (zone) {
    const zoneWordIdx = text.search(/Zone\b/i);
    if (zoneWordIdx >= 0) {
      const afterZone = text.slice(zoneWordIdx + 4);
      // Crime head is between "Zone" and the standalone PS line
      let endIdx = -1;
      if (policeStation) {
        // Find the standalone "PS Name PS" line (not a PS mention inside parentheticals)
        const psEscaped = policeStation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
        const standaloneMatch = afterZone.search(new RegExp(`^\\s*${psEscaped}\\s+PS\\s*$`, 'mi'));
        if (standaloneMatch >= 0) endIdx = standaloneMatch;
      }
      if (endIdx < 0) {
        // Fallback: find first standalone "Name PS" line
        endIdx = afterZone.search(/^\s*[\w][\w\s]{1,35}?\s+PS\s*$/m);
      }
      if (endIdx > 0) {
        const raw = afterZone.slice(0, endIdx);
        crimeHead = raw
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  }

  // === Cr.No ===
  let crNo = '';
  const crMatch = text.match(/Cr\.?\s*No\.?\s*:?\s*([\d\s/]+)/i);
  if (crMatch) crNo = crMatch[1].replace(/\s/g, '').trim();

  // === SECTIONS ===
  let sections = '';
  // Capture from U/s to the end of sections text, stopping at DOR/dated/double-newline
  const secMatch = text.match(/U\/s(?:ec)?\s+([\s\S]+?)(?:[,\s]+(?:DOR|D\.O\.R|dated)\b|\n\s*\n)/i);
  if (secMatch) {
    let secText = secMatch[1].replace(/\s+/g, ' ').trim();
    // Remove trailing "of [Name] PS" or "of PS [Name]" (PS jurisdiction reference, not act name)
    secText = secText.replace(/[,\s]+of\s+(?:PS\s+[\w][\w\s]*|[\w][\w\s]*?\s+PS)\s*$/i, '').trim();
    // Remove trailing comma/spaces
    secText = secText.replace(/[,\s]+$/, '').trim();
    sections = secText;
  }

  // === DOR ===
  let dor = '';
  // Handles: "DOR. 21-05-2009", "DOR: 30-03-2026", "DOR 31-03-2026", "dated 21-05-2009"
  const dorMatch = text.match(/(?:D\.?O\.?R\.?|dated)\s*[.:\s]\s*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
  if (dorMatch) dor = dorMatch[1];

  // === ACCUSED DETAILS ===
  let accusedDetails = '';
  const accusedMatch = text.match(/Apprehended[\s\S]*?(?=\n\s*(?:Seized|Hence|Previously|On\s+\d{1,2}[-./])|\n\s*--\s*\n|$)/i);
  if (accusedMatch) {
    accusedDetails = accusedMatch[0].replace(/\s+/g, ' ').trim().slice(0, 800);
  }
  // Fallback: Name, S/o, Age pattern
  if (!accusedDetails) {
    const nameMatch = text.match(/[\w\s@]+\s+S\/o\s+[\s\S]{10,400}?(?=\n\s*On\b|\n\s*Hence|\n\s*--|\n\s*Seized|$)/i);
    if (nameMatch) accusedDetails = nameMatch[0].replace(/\s+/g, ' ').trim().slice(0, 800);
  }

  // === BRIEF FACTS ===
  let briefFacts = '';
  const factsMatch = text.match(/\bOn\s+\d{1,2}[-./]\d{1,2}[-./]\d{2,4}[\s\S]*?(?=\n\s*Hence|\n\s*Previously|\n\s*Seized\s*:|\n\s*--\s*\n|$)/i);
  if (factsMatch) {
    briefFacts = factsMatch[0].replace(/\s+/g, ' ').trim().slice(0, 1500);
  }

  // === SEIZED PROPERTY ===
  let seizedProperty = '';
  const seizedMatch = text.match(/Seized\s*:?\s*([\s\S]*?)(?:\bTotal\b|\bWorth\b|\bW\/o\b|\bHence\b|\n\s*--\s*\n|$)/i);
  if (seizedMatch) seizedProperty = seizedMatch[1].replace(/\s+/g, ' ').trim().slice(0, 500);

  // === SEIZED WORTH ===
  let seizedWorth = '';
  const worthMatch = text.match(/(?:Total\s*(?:approx\s*)?)?(?:W\/o|Worth\s*(?:of\s*)?)\s*Rs\.?\s*:?\s*([\d,]+(?:\/-?)?)/i);
  if (worthMatch) seizedWorth = 'Rs. ' + worthMatch[1].trim();

  // === COUNTS ===
  let numAccused = 0;
  const accusedCountMatch = text.match(/(?:Apprehended|arrested)\s*\(?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\)?/i);
  if (accusedCountMatch) {
    const wordToNum: Record<string, number> = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
    const val = accusedCountMatch[1].toLowerCase();
    numAccused = wordToNum[val] || parseInt(val) || 0;
  }

  let numCases = 1;

  // === ABSCONDING ===
  let abscondingAccused = '';
  if (/absconding/i.test(text)) {
    const abscMatch = text.match(/[Aa]bsconding[\s\S]{0,300}?(?=\n\s*(?:Seized|On\s+\d|Hence)|$)/i);
    if (abscMatch) abscondingAccused = abscMatch[0].replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  // Skip non-case content
  if (!policeStation && !crNo) return null;

  const extractedLocations = extractLocations(text, policeStation);

  return {
    slNo,
    zone,
    crimeHead,
    policeStation,
    crNo,
    sections,
    dor,
    accusedDetails,
    briefFacts,
    seizedProperty,
    seizedWorth,
    numAccused: numAccused || 1,
    numCases: numCases || 1,
    abscondingAccused,
    extractedLocations,
  };
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

  // "at XXX" or "near XXX"
  const atMatches = text.matchAll(/(?:at|near)\s+([\w\s,]+?)(?:,\s*(?:Hyderabad|Hyd)|\band\b|\bwho\b|\.)/gi);
  for (const m of atMatches) {
    const loc = m[1].replace(/\s+/g, ' ').trim();
    if (loc.length > 3 && loc.length < 80) addLocation('incident_area', loc);
  }

  return locations;
}

function extractPSFromAddress(address: string): string | undefined {
  const areaMatch = address.match(/([\w]+(?:\s+[\w]+)?)\s*(?:,\s*(?:Hyderabad|Hyd))?$/i);
  if (areaMatch) return areaMatch[1].trim();
  return undefined;
}

// ── Police Station Matching ─────────────────────────────────────────────────

/**
 * Fuzzy-match a police station name from the DSR to our database.
 * Handles variations like "Hussaini Alam" vs "Hussainialam".
 */
export async function matchPoliceStation(rawName: string): Promise<string | null> {
  if (!rawName) return null;

  // Normalize input: lowercase, strip prefix noise words, remove "PS" suffix, collapse spaces
  const cleaned = cleanPSName(rawName);
  const normalized = cleaned.toLowerCase().replace(/\s*ps\s*$/i, '').replace(/\s+/g, '').trim();
  if (!normalized) return null;

  const stations = await PoliceStation.find({}).lean();

  // Normalize DB names: also strip "PS" suffix since many DB entries end with " PS"
  const normDb = (name: string) => name.toLowerCase().replace(/\s*ps\s*$/i, '').replace(/\s+/g, '');

  // Try exact match (normalized — no spaces, no "PS")
  for (const s of stations) {
    if (normDb(s.name) === normalized) return s._id.toString();
  }

  // Try contains match
  for (const s of stations) {
    const db = normDb(s.name);
    if (db.includes(normalized) || normalized.includes(db)) return s._id.toString();
  }

  // Try first-word prefix match (for 4+ char words)
  const firstWord = normalized.split(/(?=[A-Z])/)[0] || normalized.slice(0, Math.min(6, normalized.length));
  if (firstWord && firstWord.length >= 4) {
    for (const s of stations) {
      if (normDb(s.name).startsWith(firstWord)) return s._id.toString();
    }
  }

  return null;
}
