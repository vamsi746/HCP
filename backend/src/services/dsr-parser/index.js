"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _mammoth = require('mammoth'); var _mammoth2 = _interopRequireDefault(_mammoth);
// @ts-ignore — no type declarations for word-extractor
var _wordextractor = require('word-extractor'); var _wordextractor2 = _interopRequireDefault(_wordextractor);
var _models = require('../../models');
var _child_process = require('child_process');
var _util = require('util');
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _os = require('os'); var _os2 = _interopRequireDefault(_os);

const execFileAsync = _util.promisify.call(void 0, _child_process.execFile);

/**
 * Convert a .doc buffer to .docx buffer using local converter (Word COM or LibreOffice).
 * Returns the .docx buffer or null if conversion fails.
 */
 async function convertDocToDocx(docBuffer) {
  const tmpDir = _os2.default.tmpdir();
  const baseName = `hcp_convert_${Date.now()}`;
  const inputPath = _path2.default.join(tmpDir, `${baseName}.doc`);
  const outputPath = _path2.default.join(tmpDir, `${baseName}.docx`);

  try {
    _fs2.default.writeFileSync(inputPath, docBuffer);

    // Try MS Word COM via PowerShell (Windows)
    if (process.platform === 'win32') {
      try {
        const psScript = `
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open('${inputPath.replace(/\\/g, '\\\\')}')
  $doc.SaveAs2('${outputPath.replace(/\\/g, '\\\\')}', 16)
  $doc.Close()
} finally {
  $word.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
`;
        await execFileAsync('powershell', ['-NoProfile', '-Command', psScript], { timeout: 30000 });
        if (_fs2.default.existsSync(outputPath)) {
          const docxBuf = _fs2.default.readFileSync(outputPath);
          return docxBuf;
        }
      } catch (wordErr) {
        console.log('[DOC-CONVERT] MS Word conversion failed, trying LibreOffice:', wordErr.message);
      }
    }

    // Fallback: LibreOffice
    try {
      const libre = require('libreoffice-convert');
      const convertAsync = _util.promisify.call(void 0, libre.convert);
      const docxBuf = await convertAsync(docBuffer, '.docx', undefined);
      return docxBuf;
    } catch (libreErr) {
      console.log('[DOC-CONVERT] LibreOffice conversion failed:', libreErr.message);
    }

    return null;
  } finally {
    // Cleanup temp files
    try { if (_fs2.default.existsSync(inputPath)) _fs2.default.unlinkSync(inputPath); } catch (e) {}
    try { if (_fs2.default.existsSync(outputPath)) _fs2.default.unlinkSync(outputPath); } catch (e2) {}
  }
} exports.convertDocToDocx = convertDocToDocx;








































// ── Text extraction ──────────────────────────────────────────────────────────

 async function extractTextFromDocx(buffer) {
  const result = await _mammoth2.default.extractRawText({ buffer });
  return result.value;
} exports.extractTextFromDocx = extractTextFromDocx;

/** Full HTML conversion preserving document structure (tables, headings, lists, etc.) */
 async function extractFullHtmlFromDocx(buffer) {
  const result = await _mammoth2.default.convertToHtml({ buffer });
  return result.value;
} exports.extractFullHtmlFromDocx = extractFullHtmlFromDocx;

 async function extractTextFromDoc(buffer) {
  const extractor = new (0, _wordextractor2.default)();
  const doc = await extractor.extract(buffer);
  return doc.getBody();
} exports.extractTextFromDoc = extractTextFromDoc;

// ── HTML-based table extraction (preserves column structure) ─────────────────

 async function extractTableRowsFromDocx(buffer) {
  const result = await _mammoth2.default.convertToHtml({ buffer });
  const html = result.value;

  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells = [];
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
        .replace(/&apos;|&#39;/g, "'")
        .replace(/&mdash;|&#8212;/g, '\u2014')
        .replace(/&ndash;|&#8211;/g, '\u2013')
        .replace(/&lsquo;|&#8216;/g, '\u2018')
        .replace(/&rsquo;|&#8217;/g, '\u2019')
        .replace(/&ldquo;|&#8220;/g, '\u201C')
        .replace(/&rdquo;|&#8221;/g, '\u201D')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
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
} exports.extractTableRowsFromDocx = extractTableRowsFromDocx;

// ── Normalization helpers ────────────────────────────────────────────────────

/** Collapse multiple whitespace/newlines into single space, trim */
function norm(s) {
  return s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Check if a cell value is a placeholder (empty, dashes, NIL, NA, underscores) */
function isPlaceholderCell(s) {
  const t = (s || '').trim();
  return !t || /^(--|\u2014|\u2013|-|_+|NIL|NA|N\/A)$/i.test(t);
}

/** Normalize for comparison: lowercase, remove extra spaces, common substitutions */
function normCompare(s) {
  return s.toLowerCase().replace(/[\s\-_.]+/g, '').replace(/[''`]/g, '');
}

/** Convert Roman numeral string (I, II, III, IV, V, etc.) to Arabic number */
function romanToArabic(roman) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let result = 0;
  const upper = (roman || '').toUpperCase().trim();
  for (let i = 0; i < upper.length; i++) {
    const curr = map[upper[i]] || 0;
    const next = map[upper[i + 1]] || 0;
    result += curr < next ? -curr : curr;
  }
  return result || 0;
}

/** Extract sector from text, handling Roman numerals (III, I, IV), hyphens, mixed case */
function extractSector(text) {
  const m = text.match(/Sector\s*[-\u2013\u2014.]?\s*(\d+|[IVXivx]+)/i);
  if (!m) return '';
  const raw = m[1].trim();
  if (/^\d+$/.test(raw)) return `Sector ${parseInt(raw)}`;
  const num = romanToArabic(raw);
  return num > 0 ? `Sector ${num}` : '';
}

/** Strip zone name prefix from a PS match string */
function stripZonePrefix(psName) {
  let cleaned = psName;
  for (const zn of ZONE_NAMES) {
    const re = new RegExp(`^${zn.replace(/\s+/g, '\\s*')}\\s*(?:Zone)?\\s*,?\\s*`, 'i');
    cleaned = cleaned.replace(re, '').trim();
  }
  cleaned = cleaned.replace(/^Zone\s+/i, '').trim();
  // Also strip Sector suffix
  cleaned = cleaned.replace(/\s*,?\s*Sector\s*[-\u2013\u2014.]?\s*(\d+|[IVXivx]+)\s*$/i, '').trim();
  return cleaned;
}

// ── Zone names ───────────────────────────────────────────────────────────────

const ZONE_NAMES = [
  'Charminar', 'Golconda', 'Golkonda', 'Falaknuma',
  'Jubilee Hills', 'Khairtabad', 'Khairthabad',
  'Rajendranagar', 'Rajendra Nagar', 'Secunderabad', 'Secundrabad',
  'Shamshabad', 'North', 'South', 'East', 'West', 'Central',
];

const ZONE_RE = new RegExp(
  `(${ZONE_NAMES.map(z => z.replace(/\s+/g, '\\s*')).join('|')})\\s*Zone`,
  'i'
);

// ── Main parser ──────────────────────────────────────────────────────────────

 function parseTaskForceDSR(rawText) {
  // Extract report date (raid date)
  let reportDate = '';
  // Try "for the day DD-MM-YYYY" first (raid date), then "the day DD-MM-YYYY", then "Dated: DD-MM-YYYY"
  const datePatterns = [
    /for\s+the\s+day\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
    /the\s+day\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
    /Dated[:\s]+\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
  ];
  for (const pat of datePatterns) {
    const m = rawText.match(pat);
    if (m) { reportDate = m[1]; break; }
  }
  console.log('[PARSER] Extracted reportDate:', reportDate || '(none)');

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
} exports.parseTaskForceDSR = parseTaskForceDSR;

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
 function parseStructuredDSR(rows, rawText) {
  // Extract report date (raid date) from raw text
  let reportDate = '';
  const datePatterns = [
    /for\s+the\s+day\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
    /the\s+day\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
    /Dated?[:\s]+\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
    /dt\.?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
  ];
  for (const pat of datePatterns) {
    const m = rawText.match(pat);
    if (m) { reportDate = m[1]; break; }
  }
  console.log('[PARSER-STRUCTURED] Extracted reportDate:', reportDate || '(none)');

  let forceDescription = '';
  let zoneCoverage = '';
  const forceMatch = rawText.match(/Commissioner[''\u2019]?s\s+Task\s+Force[,\s]*([\w\s&]+Zone)/i);
  if (forceMatch) {
    forceDescription = "Commissioner's Task Force";
    zoneCoverage = forceMatch[1].trim();
  }

  // ── Find the ANNEXURE-I header row and dynamically map columns ──
  const isAnnexureIHeader = (row) => {
    const joined = row.map(c => c.toLowerCase()).join('|');
    // Must have serial number indicator AND (zone or PS reference) AND nature/case/accused keywords
    const hasSerial = /\bs[il]\.?\s*n|serial/i.test(joined);
    const hasZonePS = joined.includes('zone') || /p\.?\s*s\.?/i.test(joined);
    const hasStructural = /nature|accused|seiz|crime|action\s*taken/i.test(joined);
    // Must NOT be ANNEXURE-II (which has "brief facts")
    const isBriefFacts = joined.includes('brief');
    // Check that multiple cells contain header-like short text (not long data narratives)
    const shortCells = row.filter(c => c.trim().length > 0 && c.trim().length < 60).length;
    return hasSerial && hasZonePS && hasStructural && !isBriefFacts && shortCells >= 5;
  };

  let headerIdx = -1;
  let expectedCols = 0;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map(c => c.toLowerCase()).join('|');
    if (isAnnexureIHeader(rows[i])) {
      headerIdx = i;
      expectedCols = rows[i].length;
      console.log('[PARSER-STRUCTURED] Header row at index', i, 'with', expectedCols, 'columns:', rows[i].map(c => c.slice(0, 30)));
      break;
    }
  }

  const cases = [];
  if (headerIdx < 0) {
    console.log('[PARSER-STRUCTURED] No header row found, returning empty');
    return { reportDate, forceDescription, zoneCoverage, cases, rawText, totalCases: 0 };
  }

  // ── Dynamic column mapping from header text ──
  const header = rows[headerIdx];
  const colMap = {};
  for (let ci = 0; ci < header.length; ci++) {
    const h = header[ci].toLowerCase().replace(/[\r\n]+/g, ' ');
    if (/s[il]\.?\s*n|serial/i.test(h) && colMap['slNo'] === undefined) colMap['slNo'] = ci;
    else if (/zone/i.test(h) && /p\.?\s*s|name/i.test(h) && colMap['zonePS'] === undefined) colMap['zonePS'] = ci;
    else if (/zone/i.test(h) && colMap['zonePS'] === undefined) colMap['zonePS'] = ci;
    else if (/vice/i.test(h) && colMap['vice'] === undefined) colMap['vice'] = ci;
    else if (/action/i.test(h) && colMap['action'] === undefined) colMap['action'] = ci;
    else if (/nature/i.test(h) && colMap['nature'] === undefined) colMap['nature'] = ci;
    else if ((/cr\.?\s*n/i.test(h) || /p\.?\s*s.*cr/i.test(h) || /u\/s/i.test(h)) && colMap['crDetails'] === undefined) colMap['crDetails'] = ci;
    else if (/accused\s*particular|type\s*of\s*work|work.*accused/i.test(h) && colMap['accused'] === undefined) colMap['accused'] = ci;
    else if (/seiz|worth/i.test(h) && colMap['seized'] === undefined) colMap['seized'] = ci;
    else if (/no\.?\s*(?:of\s*)?accused/i.test(h) && colMap['numAccused'] === undefined) colMap['numAccused'] = ci;
    else if (/no\.?\s*(?:of\s*)?case/i.test(h) && colMap['numCases'] === undefined) colMap['numCases'] = ci;
    else if (/abscon/i.test(h) && colMap['absconding'] === undefined) colMap['absconding'] = ci;
  }

  console.log('[PARSER-STRUCTURED] ANNEXURE-I column map:', colMap);

  // Helper to safely get a cell value by mapped column name
  const cell = (row, key) => {
    const idx = colMap[key];
    return (idx !== undefined && idx < row.length) ? (row[idx] || '') : '';
  };

  // ── Find end boundary of ANNEXURE-I data (= start of ANNEXURE-II) ──
  // Instead of heuristic break conditions, find the exact row where ANNEXURE-II starts
  let annexIIStartRow = rows.length;
  for (let ri = headerIdx + 1; ri < rows.length; ri++) {
    if (rows[ri].some(c => /ANNEXURE\s*[-\u2013\u2014]?\s*(II|III|IV|V|2|3|4|5)\b/i.test(c || ''))) {
      annexIIStartRow = ri; break;
    }
    const rjText = rows[ri].map(c => (c || '').toLowerCase()).join(' ');
    if (rjText.includes('brief') && (rjText.includes('fact') || rjText.includes('description')) &&
        /s[il]\.?\s*n/i.test(rjText) && rows[ri].length >= 6) {
      annexIIStartRow = ri; break;
    }
  }
  console.log('[PARSER-STRUCTURED] ANNEXURE-I boundary: header at', headerIdx, ', ANNEXURE-II at', annexIIStartRow);

  // Process ALL ANNEXURE-I data rows within the boundary — no heuristic breaks
  for (let i = headerIdx + 1; i < annexIIStartRow; i++) {
    const row = rows[i];

    // Skip rows with very different column count (merged summary rows) instead of stopping
    if (Math.abs(row.length - expectedCols) > 5) {
      console.log(`[PARSER-STRUCTURED] Row ${i}: col count ${row.length} vs expected ${expectedCols}, skipping`);
      continue;
    }

    // Skip "Total" summary rows — ONLY check first cell / slNo cell to avoid
    // false positives when mammoth merges data rows with TOTAL rows at page breaks
    const slNoCell = (colMap['slNo'] !== undefined ? row[colMap['slNo']] : row[0]) || '';
    if (/^\s*total\b/i.test(slNoCell.trim()) || /^\s*total\b/i.test((row[0] || '').trim())) {
      console.log(`[PARSER-STRUCTURED] Row ${i}: TOTAL row, skipping`);
      continue;
    }

    // Skip repeated ANNEXURE-I headers (table continuation on new page)
    if (isAnnexureIHeader(row)) continue;

    // Skip rows where ALL data cells are placeholders (empty, --, —, –, NIL)
    if (!row.some((c, idx) => idx > 0 && !isPlaceholderCell(c))) continue;

    // Skip H-NEW / H-FAST NIL rows — check zone+PS column specifically, not all cells
    const zonePSForCheck = cell(row, 'zonePS') || (row[1] || '');
    const viceForCheck = cell(row, 'vice') || (row[2] || '');
    if (/^\s*H[-\s]*(NEW|FAST)\s*$/i.test(zonePSForCheck.trim()) ||
        (/\bH[-\s]*(NEW|FAST)\b/i.test(zonePSForCheck) && /\bNIL\b/i.test(viceForCheck))) {
      console.log(`[PARSER-STRUCTURED] Row ${i}: H-NEW/H-FAST NIL row, skipping`);
      continue;
    }

    // Extract cell values using dynamic column map
    const colSlNo      = cell(row, 'slNo');
    const colZonePS    = cell(row, 'zonePS') || cell(row, 'slNo'); // fallback if zone merged with slNo
    const colVice      = cell(row, 'vice');
    const colAction    = cell(row, 'action');
    const colNature    = cell(row, 'nature');
    const colCrDetails = cell(row, 'crDetails');
    const colAccused   = cell(row, 'accused');
    const colSeized    = cell(row, 'seized');
    const colNumAcc    = cell(row, 'numAccused');
    const colNumCases  = cell(row, 'numCases');
    const colAbsconding = cell(row, 'absconding');

    // ── Sl. No ──
    const slMatch = colSlNo.match(/^(\d+)/);
    const slNo = slMatch ? parseInt(slMatch[1]) : cases.length + 1;

    // ── Zone, PS, Sector (from the zone+PS column) ──
    let zone = '';
    const zoneMatch = colZonePS.match(ZONE_RE);
    if (zoneMatch) zone = zoneMatch[0].replace(/\s+/g, ' ').trim();
    // Fallback: check if any zone name appears without "Zone" suffix
    if (!zone) {
      for (const zn of ZONE_NAMES) {
        if (new RegExp(zn.replace(/\s+/g, '\\s*'), 'i').test(colZonePS)) {
          zone = zn;
          break;
        }
      }
    }

    let policeStation = '';
    // Method 1: "XXX PS" pattern (including hyphens, digits in PS names)
    const psMatches = colZonePS.match(/\b([A-Za-z][A-Za-z0-9 .\-]{1,30}?)\s+PS\b/g);
    if (psMatches) {
      for (const psm of psMatches) {
        let cleaned = psm.replace(/\s+PS\s*$/i, '').trim();
        if (/^(SHO|the|of|to|from|Name|SI|DOR|Cr|U|IPC|BNS|Inspector|Head|Sub)$/i.test(cleaned)) continue;
        // Strip zone name prefix (e.g. "Rajendranagar Zone Mailardevpally" → "Mailardevpally")
        cleaned = stripZonePrefix(cleaned);
        if (!cleaned || cleaned.length < 2) continue;
        if (ZONE_NAMES.some(z => normCompare(cleaned) === normCompare(z))) continue;
        if (/^Zone$/i.test(cleaned)) continue;
        if (cleaned.length > 1 && cleaned.length < 35) {
          policeStation = cleaned;
          break;
        }
      }
    }
    // Method 2: Find lines in the zone+PS cell that are PS names (not zone names, "Zone", "Sector")
    if (!policeStation) {
      const lines = colZonePS.split(/[,\n]+/).map(l => l.replace(/\s*PS\s*$/i, '').trim()).filter(Boolean);
      for (const line of lines) {
        if (/^zone$/i.test(line)) continue;
        if (ZONE_NAMES.some(z => normCompare(line) === normCompare(z))) continue;
        if (/zone/i.test(line) && line.length < 20) continue; // skip short zone lines
        if (/^Sector/i.test(line)) continue;
        // Strip zone prefix from line too
        const stripped = stripZonePrefix(line);
        if (stripped.length > 1 && stripped.length < 40) {
          policeStation = stripped;
          break;
        }
      }
    }
    // Method 3: First line of the Cr details column often starts with the PS name
    if (!policeStation && colCrDetails) {
      const firstLine = (colCrDetails.split('\n')[0] || '').replace(/\s*PS\s*$/i, '').trim();
      if (firstLine.length > 1 && firstLine.length < 40 && !/Cr\.?\s*No/i.test(firstLine) && !/U\/s/i.test(firstLine)) {
        policeStation = firstLine;
      }
    }

    // ── Sector (Roman numeral aware: Sector-III, Sector-1, Sector-I) ──
    let sector = extractSector(colZonePS);

    // ── Social Vice Type ──
    const socialViceType = norm(colVice) || 'None';

    // ── Action Taken By ──
    const actionTakenBy = norm(colAction) || 'Task Force';

    // ── Nature of Case (Crime Head) ──
    const natureOfCase = norm(colNature);

    // ── PS + Cr.No + U/Sec + DOR ──
    let crNo = '';
    // Accept digits, underscores, blanks, and / in Cr.No (underscores/blanks are placeholders)
    const crMatch = colCrDetails.match(/Cr(?:ime)?\.?\s*No\.?\s*[:.\-]?\s*([\d_\s/]+\/\s*\d{2,4})/i);
    if (crMatch) {
      crNo = crMatch[1].replace(/\s/g, '').replace(/_+/g, '_').trim();
    } else {
      // Fallback: any digits/underscores after Cr.No, stop before U/s
      const crFallback = colCrDetails.match(/Cr(?:ime)?\.?\s*No\.?\s*[:.\-]?\s*([\d_\s/]+)/i);
      if (crFallback) {
        let val = crFallback[1].replace(/\s/g, '').trim();
        // Don't include section numbers
        if (val.length <= 20) crNo = val;
      }
    }

    let sections = '';
    const secMatch = colCrDetails.match(/U\/[sS](?:ec)?\.?\s+([\s\S]+?)(?:[,\s]+(?:DOR|D\.O\.R|dated)\b|\n\s*\n|$)/i);
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
    const abscondingAccused = isPlaceholderCell(colAbsconding) ? 0 : parseInt(colAbsconding) || 0;

    if (!policeStation && !crNo) continue;
    // Skip if vice is literally NIL (H-NEW/H-FAST summary row with no real case)
    if (/^\s*NIL\s*$/i.test(colVice) && !crNo) continue;

    // De-duplicate: only for real (non-placeholder) Cr.No matches
    // Placeholder Cr.No cases at the same PS ARE allowed (e.g. two Gaming Act cases at Gandhi Nagar PS)
    if (crNo && !/^_+\/?/.test(crNo)) {
      const dupeKey = `${crNo.toLowerCase()}|${(policeStation || '').toLowerCase()}`;
      if (cases.some(c => c.crNo && !/^_+\/?/.test(c.crNo) &&
        `${c.crNo.toLowerCase()}|${(c.policeStation || '').toLowerCase()}` === dupeKey)) continue;
    }

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

  // Enrich with Annexure II (brief facts, detailed accused) — use structured rows
  // This also RECOVERS any cases missed from ANNEXURE-I (page breaks, merged rows, etc.)
  enrichFromAnnexureIIRows(rows, cases);

  // Sort by slNo so recovered cases appear in correct order
  cases.sort((a, b) => (a.slNo || 0) - (b.slNo || 0));

  console.log('[PARSER-STRUCTURED] Total cases parsed:', cases.length);

  return {
    reportDate,
    forceDescription,
    zoneCoverage,
    cases,
    rawText,
    totalCases: cases.length,
  };
} exports.parseStructuredDSR = parseStructuredDSR;

// ── Table-based case parsing ─────────────────────────────────────────────────

/**
 * The DSR document is a Word table. Mammoth extracts raw text where cells become
 * text blocks separated by newlines. Each case starts with a zone name (e.g.
 * "Charminar\n\nZone") followed by PS, Sector, then case details, ending with
 * count columns like "01\n\n01\n\n--".
 *
 * The document also has a narrative section after "Total Cases:" which we must skip.
 */
function parseTableCases(rawText) {
  const cases = [];

  // Find start of data: after the last header keyword "Absconding Accused"
  const headerEndMatch = rawText.match(/Absconding\s+Accused/i);
  if (!headerEndMatch) {
    const annIdx = rawText.search(/ANNEXURE[\s-]*I\b/i);
    if (annIdx < 0) return cases;
  }
  const startIdx = headerEndMatch
    ? headerEndMatch.index + headerEndMatch[0].length
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
  const caseBlocks = [];
  const countSplitter = /\n\s*(\d{1,2}|--)\s*\n\s*(\d{1,2}|--)\s*\n\s*(\d{1,2}|--)\s*\n/g;

  let lastEnd = 0;
  let cm;
  const splits = [];

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

      // De-duplicate: only skip if same real (non-placeholder) crNo + PS already exists
      if (parsed.crNo && !/^_+\/?/.test(parsed.crNo)) {
        const dupeKey = `${parsed.crNo.toLowerCase()}|${(parsed.policeStation || '').toLowerCase()}`;
        if (cases.some(c => c.crNo && `${c.crNo.toLowerCase()}|${(c.policeStation || '').toLowerCase()}` === dupeKey)) {
          continue;
        }
      }

      console.log(`[PARSER] Case ${parsed.slNo}: zone=${parsed.zone}, PS=${parsed.policeStation}, sector=${parsed.sector}, crNo=${parsed.crNo}`);
      cases.push(parsed);
    }
  }

  return cases;
}

function parseCaseBlock(block, slNo) {
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
      // Strip zone name prefix (e.g. "Rajendranagar Zone Mailardevpally" → "Mailardevpally")
      cleaned = stripZonePrefix(cleaned);
      if (!cleaned || cleaned.length < 2) continue;
      // Skip zone names that got concatenated
      if (ZONE_NAMES.some(z => normCompare(cleaned) === normCompare(z))) continue;
      if (/^Zone$/i.test(cleaned)) continue;
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

  // Sector: "Sector 1", "Sector-III", "Sector-I", etc. (Roman numeral aware)
  sector = extractSector(block);

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
        const ci = crimeM.index;
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
      const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
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

// ── ANNEXURE-II Enrichment (structured rows) ────────────────────────────────

/**
 * Enrich parsed cases (from Annexure I) with detailed data from ANNEXURE-II
 * using the structured table rows extracted by mammoth HTML parsing.
 *
 * The ANNEXURE-II header is detected dynamically by finding a row that contains
 * "BRIEF FACTS" (or "Brief Facts") in one of its cells.  Column positions are
 * mapped from the header text so the parser is resilient to column reordering or
 * extra/missing columns across different DSR templates.
 *
 * Matching ANNEXURE-II rows to ANNEXURE-I cases is done by PS name (normalized)
 * plus optionally nature-of-case, since Cr.No is often a placeholder (___/2026).
 */
function enrichFromAnnexureIIRows(rows, cases) {
  if (!rows.length) return;

  // ── 1. Find the ANNEXURE-II header row ──
  // Look for rows containing "brief facts", "brief description", or structural
  // ANNEXURE-II keywords (accused details + property seized + zone/PS)
  let annHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map(c => c.toLowerCase()).join('|');
    // Primary: "brief facts" or "brief description"
    if (joined.includes('brief') && (joined.includes('fact') || joined.includes('description'))) {
      annHeaderIdx = i;
      break;
    }
    // Fallback: structural detection — must have accused details + property/seized + zone/PS + serial
    if (/accused.*detail|detail.*accused/i.test(joined) &&
        /property|seiz/i.test(joined) &&
        /zone|p\.?\s*s/i.test(joined) &&
        /s[il]\.?\s*n|serial/i.test(joined)) {
      annHeaderIdx = i;
      break;
    }
  }
  if (annHeaderIdx < 0) {
    console.log('[PARSER-ANNII-ROWS] No ANNEXURE-II header with "BRIEF FACTS" found');
    return;
  }

  const header = rows[annHeaderIdx];
  console.log('[PARSER-ANNII-ROWS] Header at row', annHeaderIdx, 'cols:', header.length,
    header.map(c => c.slice(0, 30)));

  // ── 2. Map column indices dynamically from header text ──
  const colMap = {};
  for (let ci = 0; ci < header.length; ci++) {
    const h = header[ci].toLowerCase().replace(/[\r\n]+/g, ' ');
    if (/s[il]\.?\s*no/i.test(h)) colMap['slNo'] = ci;
    else if (/zone/i.test(h) && !colMap['zone']) colMap['zone'] = ci;
    else if (/vice/i.test(h)) colMap['vice'] = ci;
    else if (/action/i.test(h)) colMap['action'] = ci;
    else if (/nature/i.test(h)) colMap['nature'] = ci;
    else if (/p\.?\s*s\.?.*cr/i.test(h) || /cr.*no/i.test(h)) colMap['crDetails'] = ci;
    else if (/detail.*accused/i.test(h) || /accused.*detail/i.test(h)) colMap['accusedDetails'] = ci;
    else if (/brief/i.test(h)) colMap['briefFacts'] = ci;
    else if (/absconding/i.test(h)) colMap['absconding'] = ci;
    else if (/property.*seize/i.test(h) || /seize.*property/i.test(h)) colMap['propertySeized'] = ci;
    else if (/worth/i.test(h)) colMap['worth'] = ci;
    else if (/no\.?\s*of\s*case/i.test(h)) colMap['numCases'] = ci;
    else if (/\bI\.?\s*R\.?\b/i.test(h)) colMap['ir'] = ci;
  }

  console.log('[PARSER-ANNII-ROWS] Column map:', colMap);

  const briefCol = colMap['briefFacts'];
  const accusedCol = colMap['accusedDetails'];
  const crCol = colMap['crDetails'];
  const zoneCol = colMap['zone'];
  const propCol = colMap['propertySeized'];
  const worthCol = colMap['worth'];
  const absCol = colMap['absconding'];

  if (briefCol === undefined) {
    console.log('[PARSER-ANNII-ROWS] Could not map BRIEF FACTS column');
    return;
  }

  // ── 3. Iterate data rows ──
  const expectedCols = header.length;
  let enriched = 0;

  for (let i = annHeaderIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip rows with very different column count (different table)
    if (Math.abs(row.length - expectedCols) > 5) continue;
    // Stop at "Total" summary row — check first cell only, not entire row
    if (/^\s*total\b/i.test(row[0] || '')) continue;
    // Skip re-encountering the header row itself
    const joined = row.map(c => c.toLowerCase()).join('|');
    if (joined.includes('brief') && joined.includes('fact') && /s[il]\.?\s*n/i.test(joined)) continue;
    // Stop at a different table header (e.g. ANNEXURE-I header appearing after ANNEXURE-II)
    const headerLikeCells = row.filter(c => {
      const t = c.trim().toLowerCase().replace(/[\r\n]+/g, ' ');
      return t.length > 2 && t.length < 60 &&
        /^(s[il]\.?\s*n|zone|nature|accused|action|seiz|abscon|no\.?\s*of|worth|property|crime|vice|i\.?\s*r\.?)/i.test(t);
    });
    if (headerLikeCells.length >= 6) break;

    // Skip placeholder/empty rows (handles --, —, –, NIL, etc.)
    if (!row.some((c, idx) => idx > 0 && !isPlaceholderCell(c))) continue;
    // Skip H-NEW/H-FAST summary rows
    const annZoneCellCheck = (zoneCol !== undefined && row[zoneCol]) ? row[zoneCol] : '';
    const annViceCellCheck = (colMap['vice'] !== undefined && row[colMap['vice']]) ? row[colMap['vice']] : '';
    if (/\bH[-\s]*(NEW|FAST)\b/i.test(annZoneCellCheck) || /^\s*NIL\s*$/i.test(annViceCellCheck)) continue;

    // ── Extract candidate PS names from this ANNEXURE-II row ──
    const candidatePS = [];

    // Method A: First line of crDetails column (e.g. "Mirchowk\nCr.No. ___/2026 ...")
    if (crCol !== undefined && row[crCol]) {
      const firstLine = (row[crCol].split('\n')[0] || '').replace(/\s*PS\s*$/i, '').trim();
      if (firstLine.length > 1 && firstLine.length < 50 && !/Cr\.?\s*No/i.test(firstLine)) {
        candidatePS.push(firstLine);
      }
    }
    // Method B: Zone column may contain PS name (e.g. "Charminar\nZone\nChaderghat" or "Jubilee Hills Zone, Borabanda PS, Sector-I")
    if (zoneCol !== undefined && row[zoneCol]) {
      const lines = row[zoneCol].split(/[,\n]+/).map(l => l.replace(/\s*PS\s*$/i, '').trim()).filter(Boolean);
      // PS name is the line that is NOT a zone name, NOT just "Zone", NOT a sector
      for (const line of lines) {
        if (/^zone$/i.test(line)) continue;
        if (ZONE_NAMES.some(z => normCompare(line) === normCompare(z))) continue;
        if (/zone/i.test(line) && line.length < 20) continue;
        if (/^Sector/i.test(line)) continue;
        const stripped = stripZonePrefix(line);
        if (stripped.length > 1 && stripped.length < 50) {
          if (!candidatePS.some(p => normCompare(p) === normCompare(stripped))) {
            candidatePS.push(stripped);
          }
          break;
        }
      }
    }

    if (!candidatePS.length) {
      console.log(`[PARSER-ANNII-ROWS] Row ${i}: could not extract PS name, skipping`);
      continue;
    }

    // ── Extract nature of case for disambiguation ──
    let annNature = '';
    if (colMap['nature'] !== undefined && row[colMap['nature']]) {
      annNature = norm(row[colMap['nature']]);
    }

    // ── Extract Cr.No from ANNEXURE-II for precise matching ──
    let annCrNo = '';
    if (crCol !== undefined && row[crCol]) {
      const crMatch = row[crCol].match(/Cr(?:ime)?\.?\s*No\.?\s*[:.\-]?\s*([\d_\s/]+\/\s*\d{2,4})/i);
      if (crMatch) annCrNo = crMatch[1].replace(/\s/g, '').replace(/_+/g, '_').trim();
    }

    // ── Match to an ANNEXURE-I parsed case ──
    let matched;

    // Highest priority: Cr.No match (most precise)
    if (annCrNo && !/^_+\/?/.test(annCrNo)) {
      matched = cases.find(c =>
        !c.briefFacts && c.crNo &&
        c.crNo.replace(/\s/g, '') === annCrNo
      );
    }

    if (!matched) {
      for (const annPS of candidatePS) {
        if (matched) break;
        const normAnnPS = normCompare(annPS);

        // First try: PS name + nature of case
        if (annNature) {
          matched = cases.find(c =>
            !c.briefFacts &&
            normCompare(c.policeStation) === normAnnPS &&
            normCompare(c.natureOfCase) === normCompare(annNature)
          );
        }
        // Second try: PS name only (first un-enriched case with same PS)
        if (!matched) {
          matched = cases.find(c =>
            !c.briefFacts &&
            normCompare(c.policeStation) === normAnnPS
          );
        }
        // Third try: fuzzy PS match (substring)
        if (!matched) {
          matched = cases.find(c =>
            !c.briefFacts &&
            (normCompare(c.policeStation).includes(normAnnPS) || normAnnPS.includes(normCompare(c.policeStation)))
          );
        }
      }
    }

    if (!matched) {
      // ── RECOVERY: Create missing case from ANNEXURE-II data ──
      // If ANNEXURE-I parsing missed a case (page breaks, merged rows, etc.),
      // recover it from ANNEXURE-II which has the same data + brief facts.
      const annZonePS = (zoneCol !== undefined && row[zoneCol]) ? row[zoneCol] : '';
      const annVice = (colMap['vice'] !== undefined && row[colMap['vice']]) ? norm(row[colMap['vice']]) : '';
      const annAction = (colMap['action'] !== undefined && row[colMap['action']]) ? norm(row[colMap['action']]) : '';
      const annNatureRaw = (colMap['nature'] !== undefined && row[colMap['nature']]) ? norm(row[colMap['nature']]) : '';
      const annCrDetailsRaw = (crCol !== undefined && row[crCol]) ? row[crCol] : '';
      const annAccused = (accusedCol !== undefined && row[accusedCol]) ? norm(row[accusedCol]) : '';
      const annBrief = (briefCol !== undefined && row[briefCol]) ? norm(row[briefCol]) : '';
      const annAbsRaw = (absCol !== undefined && row[absCol]) ? norm(row[absCol]) : '';
      const annProp = (propCol !== undefined && row[propCol]) ? norm(row[propCol]) : '';
      const annWorthRaw = (worthCol !== undefined && row[worthCol]) ? norm(row[worthCol]) : '';

      // Extract zone
      let newZone = '';
      const zoneM = annZonePS.match(ZONE_RE);
      if (zoneM) newZone = zoneM[0].replace(/\s+/g, ' ').trim();
      if (!newZone) {
        for (const zn of ZONE_NAMES) {
          if (new RegExp(zn.replace(/\s+/g, '\\s*'), 'i').test(annZonePS)) { newZone = zn; break; }
        }
      }

      // Extract PS (use candidatePS from above, or re-extract)
      let newPS = candidatePS[0] || '';
      if (!newPS) {
        const psM = annZonePS.match(/\b([A-Za-z][A-Za-z0-9 .\-]{1,30}?)\s+PS\b/g);
        if (psM) {
          for (const p of psM) {
            let cl = p.replace(/\s+PS\s*$/i, '').trim();
            cl = stripZonePrefix(cl);
            if (cl && cl.length > 1 && !ZONE_NAMES.some(z => normCompare(cl) === normCompare(z))) {
              newPS = cl; break;
            }
          }
        }
      }

      // Extract sector
      const newSector = extractSector(annZonePS);

      // Extract Cr.No, sections, DOR
      let newCrNo = annCrNo || '';
      if (!newCrNo) {
        const crM2 = annCrDetailsRaw.match(/Cr(?:ime)?\.?\s*No\.?\s*[:.\-]?\s*([\d_\s/]+\/\s*\d{2,4})/i);
        if (crM2) newCrNo = crM2[1].replace(/\s/g, '').replace(/_+/g, '_').trim();
      }
      let newSections = '';
      const secM = annCrDetailsRaw.match(/U\/[sS](?:ec)?\.?\s+([\s\S]+?)(?:[,\s]+(?:DOR|D\.O\.R|dated)\b|\n\s*\n|$)/i);
      if (secM) newSections = norm(secM[1]).replace(/[,\s]+$/, '');
      let newDor = '';
      const dorM = annCrDetailsRaw.match(/(?:D\.?O\.?R\.?|dated)\s*[.:\s]\s*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
      if (dorM) newDor = dorM[1];

      // Sl.No
      const slM = (colMap['slNo'] !== undefined && row[colMap['slNo']]) ? row[colMap['slNo']].match(/^(\d+)/) : null;
      const newSlNo = slM ? parseInt(slM[1]) : cases.length + 1;

      // Don't recover if PS is a noise/placeholder word
      if (newPS && /^(H[-\s]*(NEW|FAST)|NIL|TOTAL|--|\u2014|\u2013)$/i.test(newPS.trim())) newPS = '';

      if (newPS || newCrNo) {
        // Check not already recovered (de-dup against existing cases)
        const isDupe = newCrNo && !/^_+\/?/.test(newCrNo) &&
          cases.some(c => c.crNo && c.crNo.replace(/\s/g, '') === newCrNo);
        if (!isDupe) {
          const newCase = {
            slNo: newSlNo,
            zone: newZone,
            policeStation: newPS,
            sector: newSector,
            socialViceType: annVice || 'None',
            actionTakenBy: annAction || 'Task Force',
            natureOfCase: annNatureRaw,
            crNo: newCrNo,
            sections: newSections,
            dor: newDor,
            psWithCrDetails: norm(annCrDetailsRaw),
            accusedParticulars: annAccused,
            seizedProperty: annProp,
            seizedWorth: annWorthRaw,
            numAccused: 1,
            numCases: 1,
            abscondingAccused: (annAbsRaw && annAbsRaw !== '--') ? parseInt(annAbsRaw) || 0 : 0,
            crimeHead: annNatureRaw,
            accusedDetails: annAccused,
            briefFacts: annBrief,
            extractedLocations: extractLocations(annZonePS + ' ' + annAccused, newPS),
          };
          cases.push(newCase);
          enriched++;
          console.log(`[PARSER-ANNII-ROWS] Row ${i}: RECOVERED missing case #${newSlNo}: PS="${newPS}" zone="${newZone}" sector="${newSector}" crNo="${newCrNo}"`);
        } else {
          console.log(`[PARSER-ANNII-ROWS] Row ${i}: PS [${candidatePS.join(', ')}] already exists (dupe crNo=${newCrNo}), skipping`);
        }
      } else {
        console.log(`[PARSER-ANNII-ROWS] Row ${i}: PS [${candidatePS.join(', ')}] not matched and no PS/crNo for recovery`);
      }
      continue;
    }

    // ── Extract and assign fields ──
    // Brief Facts — take the full cell content directly
    if (briefCol !== undefined && row[briefCol]) {
      const facts = norm(row[briefCol]);
      if (facts && facts !== '--') {
        matched.briefFacts = facts;
      }
    }

    // Detailed accused
    if (accusedCol !== undefined && row[accusedCol]) {
      const accused = norm(row[accusedCol]);
      if (accused && accused !== '--' && accused.length > matched.accusedDetails.length) {
        matched.accusedParticulars = accused;
        matched.accusedDetails = accused;
      }
    }

    // Enriched PS + Cr details
    if (crCol !== undefined && row[crCol]) {
      const crDetails = norm(row[crCol]);
      if (crDetails && crDetails.length > (matched.psWithCrDetails || '').length) {
        matched.psWithCrDetails = crDetails;
      }
    }

    // Property seized
    if (propCol !== undefined && row[propCol]) {
      const prop = norm(row[propCol]);
      if (prop && prop !== '--') {
        matched.seizedProperty = prop;
      }
    }

    // Worth
    if (worthCol !== undefined && row[worthCol]) {
      const worth = norm(row[worthCol]);
      if (worth && worth !== '--') {
        matched.seizedWorth = worth;
      }
    }

    // Absconding accused (update if present)
    if (absCol !== undefined && row[absCol]) {
      const abs = norm(row[absCol]);
      if (abs && abs !== '--') {
        matched.abscondingAccused = parseInt(abs) || 0;
      }
    }

    enriched++;
    console.log(`[PARSER-ANNII-ROWS] Row ${i}: enriched case PS="${matched.policeStation}" with briefFacts (${(matched.briefFacts || '').length} chars)`);
  }

  console.log(`[PARSER-ANNII-ROWS] Enriched ${enriched}/${cases.length} cases`);
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
function enrichFromAnnexureII(rawText, cases) {
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
    // Build flexible regex for this case's Cr.No (allow whitespace around /)
    const isPlaceholderCrNo = !c.crNo || /^_+\/?\d*$/.test(c.crNo) || c.crNo === '_/2026';

    let crM = null;
    if (!isPlaceholderCrNo) {
      const crEsc = c.crNo
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\//g, '\\s*/\\s*');
      const crRe = new RegExp('Cr\\.?\\s*No\\.?\\s*[:.]?\\s*' + crEsc, 'i');
      crM = crRe.exec(annBody);
    }

    // Fallback: match by PS name when Cr.No is a placeholder
    if (!crM && c.policeStation) {
      const psEsc = c.policeStation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const psRe = new RegExp(psEsc + '\\s*(?:PS)?\\s*\\n\\s*Cr\\.?\\s*No\\.?', 'i');
      crM = psRe.exec(annBody);
    }

    if (!crM) {
      console.log(`[PARSER] AnnII: crNo ${c.crNo} / PS ${c.policeStation} not found`);
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
    let briefEnd;

    // Primary: find "Hence" sentence ending with "for further action." or "handed over...action."
    // Stop at the period (.) after the action/over keyword — don't grab leaked column data
    const henceM = factsText.match(/Hence[^\n]*?(?:for\s+further|handed?\s+over|handing\s+over)[^.\n]*\./i);
    if (henceM) {
      briefEnd = henceM.index + henceM[0].length;
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

function extractLocations(text, primaryPS) {
  const locations = [];
  const seen = new Set();

  const addLocation = (type, rawText, psName) => {
    const key = `${type}:${rawText.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push({ type, rawText: rawText.trim(), psName: _optionalChain([psName, 'optionalAccess', _2 => _2.trim, 'call', _3 => _3()]) });
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

function extractPSFromAddress(address) {
  const areaMatch = address.match(/([\w]+(?:\s+[\w]+)?)\s*(?:,\s*(?:Hyderabad|Hyd))?$/i);
  if (areaMatch) return areaMatch[1].trim();
  return undefined;
}

// ── Police Station Matching ─────────────────────────────────────────────────

function cleanPSName(name) {
  return name.replace(/^\s*(?:of|the|from|to|at|near|and|over|under)\s+/i, '').trim();
}

// Simple Levenshtein edit distance
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
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
function consonantSkeleton(s) {
  return s.replace(/[aeiou]/gi, '');
}

// Collapse repeated consonants: "shhlbnd" → "shlbnd"
function collapsedSkeleton(s) {
  return consonantSkeleton(s).replace(/(.)\1+/g, '$1');
}

 async function matchPoliceStation(rawName) {
  if (!rawName) return null;

  const cleaned = cleanPSName(rawName);
  const normalized = cleaned.toLowerCase().replace(/\s*ps\s*$/i, '').replace(/\s+/g, '').trim();
  if (!normalized) return null;

  const stations = await _models.PoliceStation.find({}).lean();

  const normDb = (name) => (name || '').toLowerCase().replace(/\s*ps\s*$/i, '').replace(/\s+/g, '');

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
    let bestId = null;
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
} exports.matchPoliceStation = matchPoliceStation;
