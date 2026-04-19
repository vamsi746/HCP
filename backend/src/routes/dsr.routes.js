"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _express = require('express');
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _models = require('../models');
var _auth = require('../middleware/auth');
var _rbac = require('../middleware/rbac');

var _upload = require('../middleware/upload');
var _dsrparser = require('../services/dsr-parser');

const router = _express.Router.call(void 0, );

// GET /api/dsr — list DSRs
router.get('/', _auth.authenticate, async (req, res) => {
  try {
    const { status, forceType, dsrCategory, zoneId, startDate, endDate, page = '1', limit = '20' } = req.query;
    const filter = {};
    if (status) filter.processingStatus = status;
    if (forceType) filter.forceType = forceType;
    if (dsrCategory) filter.dsrCategory = dsrCategory;
    if (zoneId) filter.zoneId = zoneId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate );
      if (endDate) filter.date.$lte = new Date(endDate );
    }

    const skip = (parseInt(page ) - 1) * parseInt(limit );
    const [dsrs, total] = await Promise.all([
      _models.DSR.find(filter)
        .populate('zoneId uploadedBy', 'name code badgeNumber')
        .skip(skip)
        .limit(parseInt(limit ))
        .sort({ date: -1 })
        .lean(),
      _models.DSR.countDocuments(filter),
    ]);

    // Attach memo counts per DSR
    const dsrIds = dsrs.map((d) => d._id);
    const memoCounts = await _models.Memo.aggregate([
      { $match: { dsrId: { $in: dsrIds } } },
      { $group: { _id: '$dsrId', count: { $sum: 1 } } },
    ]);
    const memoCountMap = {};
    for (const mc of memoCounts) memoCountMap[mc._id.toString()] = mc.count;
    const dsrsWithMemo = dsrs.map((d) => ({
      ...d,
      memoGeneratedCount: memoCountMap[d._id.toString()] || 0,
    }));

    res.json({ data: dsrsWithMemo, pagination: { page: parseInt(page ), limit: parseInt(limit ), total } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch DSRs' });
  }
});

// GET /api/dsr/stats/summary
router.get('/stats/summary', _auth.authenticate, async (_req, res) => {
  try {
    const stats = await _models.DSR.aggregate([
      { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
    ]);
    res.json({ data: stats });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/dsr/:id — full DSR with parsed cases
router.get('/:id', _auth.authenticate, async (req, res) => {
  try {
    const dsr = await _models.DSR.findById(req.params.id)
      .populate('zoneId uploadedBy policeStationId')
      .populate('parsedCases.matchedPSId', 'name code')
      .populate('parsedCases.matchedZoneId', 'name code')
      .populate('parsedCases.matchedSectorId', 'name')
      .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank phone')        .populate('parsedCases.matchedSHOId', 'name badgeNumber rank phone')      .lean();
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }

    // Attach memo info per parsed case
    const memos = await _models.Memo.find({ dsrId: dsr._id }).select('caseId status _id').lean();
    const memoMap = {};
    for (const m of memos) memoMap[m.caseId.toString()] = { memoId: m._id.toString(), memoStatus: m.status };
    const dsrObj = dsr;
    if (dsrObj.parsedCases) {
      dsrObj.parsedCases = dsrObj.parsedCases.map((c) => ({
        ...c,
        memoId: _optionalChain([memoMap, 'access', _ => _[c._id.toString()], 'optionalAccess', _2 => _2.memoId]) || null,
        memoStatus: _optionalChain([memoMap, 'access', _3 => _3[c._id.toString()], 'optionalAccess', _4 => _4.memoStatus]) || null,
      }));
    }

    res.json({ data: dsrObj });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to fetch DSR' });
  }
});

// POST /api/dsr/upload — upload + parse DSR document
router.post('/upload', _auth.authenticate, _upload.upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const { forceType, dsrCategory: rawCategory } = req.body;
    const dsrCategory = rawCategory || _models.DSRCategory.SPECIAL_WINGS;

    if (dsrCategory === _models.DSRCategory.SPECIAL_WINGS) {
      if (!forceType || !Object.values(_models.ForceType).includes(forceType)) {
        res.status(400).json({ error: 'Invalid forceType. Must be CHARMINAR_GOLCONDA, RAJENDRANAGAR_SHAMSHABAD, or KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS' });
        return;
      }
    }

    const ext = _path2.default.extname(file.originalname).toLowerCase();

    // Save uploaded file to disk for later retrieval
    const uploadsDir = _path2.default.join(__dirname, '..', '..', 'uploads', 'dsr');
    if (!_fs2.default.existsSync(uploadsDir)) _fs2.default.mkdirSync(uploadsDir, { recursive: true });
    const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = _path2.default.join(uploadsDir, safeFileName);
    _fs2.default.writeFileSync(filePath, file.buffer);

    // Create DSR record
    const dsr = await _models.DSR.create({
      date: req.body.date || new Date(),
      dsrCategory,
      forceType: dsrCategory === _models.DSRCategory.SPECIAL_WINGS ? forceType : undefined,
      fileName: file.originalname,
      fileType: file.mimetype,
      filePath: `uploads/dsr/${safeFileName}`,
      processingStatus: dsrCategory === _models.DSRCategory.NORMAL ? _models.DSRStatus.COMPLETED : _models.DSRStatus.PROCESSING,
      uploadedBy: req.user.id,
    });

    // For NORMAL category: store document HTML only, skip parsing (no template yet)
    if (dsrCategory === _models.DSRCategory.NORMAL) {
      try {
        let documentHtml = '';
        if (ext === '.docx') {
          documentHtml = await _dsrparser.extractFullHtmlFromDocx.call(void 0, file.buffer);
        } else if (ext === '.doc') {
          const docxBuffer = await _dsrparser.convertDocToDocx.call(void 0, file.buffer);
          if (docxBuffer) {
            documentHtml = await _dsrparser.extractFullHtmlFromDocx.call(void 0, docxBuffer);
            const docxFileName = safeFileName.replace(/\\.doc$/i, '.docx');
            const docxPath = _path2.default.join(uploadsDir, docxFileName);
            _fs2.default.writeFileSync(docxPath, docxBuffer);
            dsr.filePath = `uploads/dsr/${docxFileName}`;
            dsr.fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else {
            const rawText = await _dsrparser.extractTextFromDoc.call(void 0, file.buffer);
            documentHtml = `<pre style="white-space:pre-wrap;font-family:serif;font-size:12pt;line-height:1.6">${rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
          }
        } else if (ext === '.txt') {
          const rawText = file.buffer.toString('utf8');
          documentHtml = `<pre style="white-space:pre-wrap;font-family:serif;font-size:12pt;line-height:1.6">${rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
        }
        dsr.documentHtml = documentHtml;
        await dsr.save();
        res.status(201).json({ data: dsr, message: 'Normal DSR uploaded successfully. Parsing will be available once templates are configured.' });
      } catch (err) {
        console.error('[UPLOAD] Normal DSR HTML extraction error:', err);
        await dsr.save();
        res.status(201).json({ data: dsr, message: 'Normal DSR uploaded. Document preview may not be available.' });
      }
      return;
    }

    // Parse the document (Special Wings only)
    try {
      let rawText = '';
      let tableRows = [];
      let documentHtml = '';

      if (ext === '.docx') {
        rawText = await _dsrparser.extractTextFromDocx.call(void 0, file.buffer);
        tableRows = await _dsrparser.extractTableRowsFromDocx.call(void 0, file.buffer);
        documentHtml = await _dsrparser.extractFullHtmlFromDocx.call(void 0, file.buffer);
      } else if (ext === '.doc') {
        // Convert .doc → .docx for full table structure + document preview
        console.log('[ROUTE] Converting .doc to .docx...');
        const docxBuffer = await _dsrparser.convertDocToDocx.call(void 0, file.buffer);
        if (docxBuffer) {
          console.log('[ROUTE] .doc → .docx conversion succeeded');
          rawText = await _dsrparser.extractTextFromDocx.call(void 0, docxBuffer);
          tableRows = await _dsrparser.extractTableRowsFromDocx.call(void 0, docxBuffer);
          documentHtml = await _dsrparser.extractFullHtmlFromDocx.call(void 0, docxBuffer);
          // Save the converted .docx alongside original for docx-preview rendering
          const docxFileName = safeFileName.replace(/\.doc$/i, '.docx');
          const docxPath = _path2.default.join(uploadsDir, docxFileName);
          _fs2.default.writeFileSync(docxPath, docxBuffer);
          dsr.filePath = `uploads/dsr/${docxFileName}`;
          dsr.fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          await dsr.save();
        } else {
          console.log('[ROUTE] .doc → .docx conversion failed, falling back to text extraction');
          rawText = await _dsrparser.extractTextFromDoc.call(void 0, file.buffer);
          documentHtml = `<pre style="white-space:pre-wrap;font-family:serif;font-size:12pt;line-height:1.6">${rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
        }
      } else if (ext === '.txt') {
        rawText = file.buffer.toString('utf8');
        documentHtml = `<pre style="white-space:pre-wrap;font-family:serif;font-size:12pt;line-height:1.6">${rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
      } else {
        dsr.processingStatus = _models.DSRStatus.MANUAL_REVIEW;
        dsr.missingFields = ['Unsupported file format — only .doc, .docx and .txt are supported for auto-parsing'];
        await dsr.save();
        res.status(201).json({ data: dsr, message: 'File uploaded but format not supported for auto-parsing' });
        return;
      }

      // DEBUG: Log raw text to diagnose parsing issues
      console.log('=== RAW EXTRACTED TEXT (first 3000 chars) ===');
      console.log(rawText.slice(0, 3000));
      console.log('=== END RAW TEXT ===');

      // Parse: use structured HTML table parser for .docx, fallback to text-based parser
      let parseResult;
      if (tableRows.length > 0) {
        console.log('[ROUTE] Using structured HTML table parser with', tableRows.length, 'rows');
        parseResult = _dsrparser.parseStructuredDSR.call(void 0, tableRows, rawText);
      } else {
        console.log('[ROUTE] Using text-based parser (no HTML table rows)');
        parseResult = _dsrparser.parseTaskForceDSR.call(void 0, rawText);
      }

      // Derive raidedBy from parsed cases' actionTakenBy
      const uniqueForces = [...new Set(parseResult.cases.map(c => c.actionTakenBy).filter(Boolean))];
      dsr.raidedBy = uniqueForces.join(', ') || "Commissioner's Task Force";

      // Match police stations, sectors, and officers for each parsed case
      const parsedCases = [];
      for (const c of parseResult.cases) {
        const matchedPSId = await _dsrparser.matchPoliceStation.call(void 0, c.policeStation);

        let matchedOfficerId = null;
        let matchedZoneId = null;
        let matchedSectorId = null;
        let matchedSHOId = null;

        if (matchedPSId) {
          const ps = await _models.PoliceStation.findById(matchedPSId).populate('circleId').lean() ;
          if (ps) {
            // Walk up: PS → Circle → Division → Zone
            if (_optionalChain([ps, 'access', _5 => _5.circleId, 'optionalAccess', _6 => _6.divisionId])) {
              const Division = require('../models').Division;
              const div = await Division.findById(ps.circleId.divisionId).lean() ;
              if (_optionalChain([div, 'optionalAccess', _7 => _7.zoneId])) matchedZoneId = div.zoneId.toString();
            }
          }

          // Find the specific sector from the parsed sector name (e.g. "Sector 1")
          const sectors = await _models.Sector.find({ policeStationId: matchedPSId }).lean();
          if (sectors.length > 0 && c.sector) {
            // Match by sector name/number
            const sectorNum = _optionalChain([c, 'access', _8 => _8.sector, 'access', _9 => _9.match, 'call', _10 => _10(/\d+/), 'optionalAccess', _11 => _11[0]]);
            if (sectorNum) {
              const matched = sectors.find(s => {
                const dbNum = _optionalChain([s, 'access', _12 => _12.name, 'access', _13 => _13.match, 'call', _14 => _14(/\d+/), 'optionalAccess', _15 => _15[0]]);
                return dbNum === sectorNum;
              });
              if (matched) {
                matchedSectorId = matched._id.toString();
                // Find the best SI for this sector:
                // 1st priority: officer whose remarks mention this sector number
                // 2nd priority: any officer not purely admin/dsi/non-sector
                // 3rd priority: anyone
                const sectorOfficers = await _models.SectorOfficer.find({
                  sectorId: matched._id,
                  role: 'PRIMARY_SI',
                  isActive: true,
                }).lean();

                // 1st: officer whose remarks explicitly mention "Sector N" for the target sector
                for (const so of sectorOfficers) {
                  const off = await _models.Officer.findById(so.officerId).select('remarks').lean();
                  const remarks = (_optionalChain([off, 'optionalAccess', _16 => _16.remarks]) || '');
                  // Check if remarks contain "Sector N" or "Sec N" or "sector N"
                  const mentionsSector = new RegExp(`(?:sec(?:tor)?)[\\s\\-–]*${sectorNum}\\b`, 'i').test(remarks);
                  if (mentionsSector) {
                    matchedOfficerId = so.officerId.toString();
                    break;
                  }
                }
                // 2nd: skip pure admin/dsi/non-sector roles (no digit in remarks)
                if (!matchedOfficerId) {
                  for (const so of sectorOfficers) {
                    const off = await _models.Officer.findById(so.officerId).select('remarks').lean();
                    const remarks = (_optionalChain([off, 'optionalAccess', _17 => _17.remarks]) || '').toLowerCase();
                    const hasDigit = /\d/.test(remarks);
                    const isPureNonSector = !hasDigit && (remarks.includes('admin') || remarks.includes('dsi') || remarks.includes('crime') || remarks.includes('general') || remarks.includes('maternity'));
                    if (!isPureNonSector) {
                      matchedOfficerId = so.officerId.toString();
                      break;
                    }
                  }
                }
                // 3rd: anyone
                if (!matchedOfficerId && sectorOfficers.length > 0) {
                  matchedOfficerId = sectorOfficers[0].officerId.toString();
                }
              }
            }
          }

          // Find SHO: first officer whose remarks include "admin" for this PS
          // Same logic as mapping page: iterate all sectors, first admin match = SHO
          if (sectors.length > 0) {
            const allSOForSHO = await _models.SectorOfficer.find({
              sectorId: { $in: sectors.map((s) => s._id) },
              role: 'PRIMARY_SI',
              isActive: true,
            }).lean();
            for (const so of allSOForSHO) {
              const off = await _models.Officer.findById(so.officerId).select('remarks').lean();
              const remarks = (_optionalChain([off, 'optionalAccess', _18 => _18.remarks]) || '').toLowerCase();
              if (remarks.includes('admin')) {
                matchedSHOId = so.officerId.toString();
                break;
              }
            }
          }

          // Fallback: if no sector-specific match, try any sector SI for this PS
          if (!matchedOfficerId && sectors.length > 0) {
            const allSectorOfficers = await _models.SectorOfficer.find({
              sectorId: { $in: sectors.map((s) => s._id) },
              role: 'PRIMARY_SI',
              isActive: true,
            }).lean();
            for (const so of allSectorOfficers) {
              const off = await _models.Officer.findById(so.officerId).select('remarks').lean();
              const remarks = (_optionalChain([off, 'optionalAccess', _19 => _19.remarks]) || '').toLowerCase();
              const hasDigit = /\d/.test(remarks);
              const isPureNonSector = !hasDigit && (remarks.includes('admin') || remarks.includes('dsi') || remarks.includes('crime') || remarks.includes('general') || remarks.includes('maternity'));
              if (!isPureNonSector) {
                matchedOfficerId = so.officerId.toString();
                if (!matchedSectorId) {
                  matchedSectorId = so.sectorId.toString();
                }
                break;
              }
            }
            // Fallback: anyone
            if (!matchedOfficerId && allSectorOfficers.length > 0) {
              matchedOfficerId = allSectorOfficers[0].officerId.toString();
              if (!matchedSectorId) {
                matchedSectorId = allSectorOfficers[0].sectorId.toString();
              }
            }
          }
        }

        parsedCases.push({
          ...c,
          matchedPSId: matchedPSId || undefined,
          matchedZoneId: matchedZoneId || undefined,
          matchedSectorId: matchedSectorId || undefined,
          matchedOfficerId: matchedOfficerId || undefined,
          matchedSHOId: matchedSHOId || undefined,
        });
      }

      // Update DSR with parsed data
      dsr.rawText = parseResult.rawText;
      dsr.documentHtml = documentHtml || undefined;
      dsr.parsedCases = parsedCases ;
      dsr.totalCases = parsedCases.length;
      dsr.processingStatus = _models.DSRStatus.COMPLETED;
      dsr.processedAt = new Date();

      console.log('[ROUTE] parsedCases count:', parsedCases.length, 'totalCases:', parsedCases.length);
      if (parsedCases.length > 0) {
        console.log('[ROUTE] first case sample:', JSON.stringify(parsedCases[0]).slice(0, 300));
      }

      if (parseResult.reportDate) {
        console.log('[ROUTE] reportDate from parser:', parseResult.reportDate);
        const parts = parseResult.reportDate.split(/[-/.]/);
        if (parts.length === 3) {
          const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          if (!isNaN(d.getTime())) {
            dsr.date = d;
            console.log('[ROUTE] Updated DSR date to raid date:', d.toISOString());
          }
        }
      } else {
        console.log('[ROUTE] No reportDate extracted from document');
      }

      await dsr.save();
      console.log('[ROUTE] saved successfully, parsedCases in DB:', _optionalChain([dsr, 'access', _20 => _20.parsedCases, 'optionalAccess', _21 => _21.length]));

      // Re-fetch with populated fields
      const populated = await _models.DSR.findById(dsr._id)
        .populate('parsedCases.matchedPSId', 'name code')
        .populate('parsedCases.matchedZoneId', 'name code')
        .populate('parsedCases.matchedSectorId', 'name')
        .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank phone')
        .populate('parsedCases.matchedSHOId', 'name badgeNumber rank phone')
        .lean();

      res.status(201).json({ data: populated });
    } catch (parseErr) {
      console.error('[ROUTE] PARSE/MATCH ERROR:', parseErr.message, parseErr.stack);
      dsr.processingStatus = _models.DSRStatus.FAILED;
      dsr.missingFields = [parseErr.message || 'Parse error'];
      await dsr.save();
      res.status(201).json({ data: dsr, error: 'Upload succeeded but parsing failed', details: parseErr.message });
    }
  } catch (outerErr) {
    console.error('[ROUTE] OUTER ERROR:', outerErr.message, outerErr.stack);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/dsr/:id/document — full document HTML for rendering
router.get('/:id/document', _auth.authenticate, async (req, res) => {
  try {
    const dsr = await _models.DSR.findById(req.params.id).select('documentHtml fileName').lean();
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    res.json({ data: { documentHtml: dsr.documentHtml || '', fileName: dsr.fileName } });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// GET /api/dsr/:dsrId/case-rows/:caseId — extract only case-specific rows from ANNEXURE-I and ANNEXURE-II
router.get('/:dsrId/case-rows/:caseId', _auth.authenticate, async (req, res) => {
  try {
    const dsr = await _models.DSR.findById(req.params.dsrId).select('documentHtml parsedCases').lean();
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }

    const parsedCase = (dsr.parsedCases || []).find((c) => c._id.toString() === req.params.caseId);
    if (!parsedCase) { res.status(404).json({ error: 'Case not found in DSR' }); return; }

    const html = dsr.documentHtml || '';
    if (!html) { res.json({ data: { html: '<p style="padding:20px;color:#666">No document HTML available.</p>' } }); return; }

    const slNo = parsedCase.slNo;
    const psName = (parsedCase.policeStation || '').trim().toLowerCase();
    const crNo = (parsedCase.crNo || '').trim();

    // Extract all <table> blocks from documentHtml
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const tables = [];
    let tm;
    while ((tm = tableRegex.exec(html)) !== null) {
      tables.push({ full: tm[0], inner: tm[1], startIdx: tm.index });
    }

    // Classify tables by looking at text BEFORE the table (for ANNEXURE-I label)
    // and by header row content (brief facts = ANNEXURE-II type)
    const classifyTable = (table) => {
      const low = table.inner.toLowerCase().replace(/\s+/g, ' ');
      const hasBriefFacts = low.includes('brief fact');
      const hasAccused = low.includes('accused');
      const hasZone = low.includes('zone');
      const hasCrNo = low.includes('cr.') || low.includes('cr no') || low.includes('u/s');
      
      // Check the text before this table for ANNEXURE labels
      const before = html.substring(Math.max(0, table.startIdx - 600), table.startIdx).toLowerCase();
      const isAfterAnnexI = before.includes('annexure-i') || before.includes('annexure- i') || before.includes('annexure -i') || before.includes('annexure i');
      const isAfterAnnexII = before.includes('annexure-ii') || before.includes('annexure- ii') || before.includes('annexure -ii') || before.includes('annexure ii');

      if (hasBriefFacts) return 'ANNEX_II';
      if (isAfterAnnexII) return 'ANNEX_II';
      if (hasAccused && hasZone && hasCrNo && !hasBriefFacts) return 'ANNEX_I';
      if (isAfterAnnexI && hasZone) return 'ANNEX_I';
      // Continuation tables of ANNEXURE-I (same column structure, no header label)
      if (hasZone && hasCrNo && hasAccused && !hasBriefFacts) return 'ANNEX_I';
      return 'OTHER';
    };

    // Helper: extract all row texts, find the one matching our case
    const extractRowHtml = (rows) => rows.map(r => r);
    
    const getRowCells = (rowHtml) => {
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells = [];
      let cm;
      while ((cm = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
      }
      return cells;
    };

    const findMatchingRow = (tableHtml, isFirstTable) => {
      const trRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      const allRows = [];
      let rm;
      while ((rm = trRegex.exec(tableHtml)) !== null) allRows.push(rm[0]);
      if (allRows.length === 0) return null;

      // Determine header vs data rows
      // Header row: first row if it contains column header keywords
      const headerRows = [];
      let dataStartIdx = 0;

      // Check if first row looks like a header (contains header keywords)
      const firstRowText = allRows[0].replace(/<[^>]+>/g, ' ').toLowerCase();
      if (firstRowText.includes('zone') || firstRowText.includes('si.') || firstRowText.includes('sl') || firstRowText.includes('name of')) {
        headerRows.push(allRows[0]);
        dataStartIdx = 1;
        // Check if second row is also a sub-header
        if (allRows.length > 1) {
          const secText = allRows[1].replace(/<[^>]+>/g, ' ').toLowerCase();
          if (secText.includes('zone') && secText.includes('name') && secText.length < 200) {
            headerRows.push(allRows[1]);
            dataStartIdx = 2;
          }
        }
      }

      // Search data rows for a match using policeStation name
      for (let i = dataStartIdx; i < allRows.length; i++) {
        const rowText = allRows[i].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

        // Match by police station name (primary strategy)
        if (psName && rowText.includes(psName)) {
          return { headerRows, dataRow: allRows[i] };
        }

        // Match by slNo: count data rows from start (row index = slNo)
        if (slNo && !isFirstTable) continue; // slNo only meaningful for first table chunk
        if (slNo && isFirstTable && (i - dataStartIdx + 1) === slNo) {
          return { headerRows, dataRow: allRows[i] };
        }
      }

      return null;
    };

    const fragments = [];
    let annexIFound = false;
    let annexIIFound = false;

    for (const table of tables) {
      const type = classifyTable(table);

      if (type === 'ANNEX_I') {
        const result = findMatchingRow(table.full, !annexIFound);
        if (result) {
          if (!annexIFound) {
            fragments.push('<div style="text-align:center;margin-bottom:8px;font-weight:bold;font-family:serif;font-size:12pt">ANNEXURE-I (ABSTRACT)</div>');
          }
          const tbl = '<table style="border-collapse:collapse;width:100%;font-size:10pt;font-family:serif;" border="1" cellpadding="4" cellspacing="0">' +
            (result.headerRows.length > 0 ? result.headerRows.join('') : '') +
            result.dataRow + '</table>';
          fragments.push(tbl);
          annexIFound = true;
        }
      }

      if (type === 'ANNEX_II') {
        const result = findMatchingRow(table.full, false);
        if (result) {
          if (!annexIIFound) {
            fragments.push('<div style="text-align:center;margin:20px 0 8px;font-weight:bold;font-family:serif;font-size:12pt">ANNEXURE-II</div>');
          }
          const tbl = '<table style="border-collapse:collapse;width:100%;font-size:10pt;font-family:serif;" border="1" cellpadding="4" cellspacing="0">' +
            (result.headerRows.length > 0 ? result.headerRows.join('') : '') +
            result.dataRow + '</table>';
          fragments.push(tbl);
          annexIIFound = true;
        }
      }
    }

    if (fragments.length === 0) {
      res.json({ data: { html: '<p style="padding:20px;color:#888;font-family:serif">Could not extract matching case rows from the DSR document.</p>' } });
      return;
    }

    const caseHtml = `<div style="padding:16px;font-family:serif">${fragments.join('')}</div>`;
    res.json({ data: { html: caseHtml } });
  } catch (err) {
    console.error('[CASE-ROWS]', err);
    res.status(500).json({ error: 'Failed to extract case rows' });
  }
});

// GET /api/dsr/:id/download — download original uploaded file
router.get('/:id/download', _auth.authenticate, async (req, res) => {
  try {
    const dsr = await _models.DSR.findById(req.params.id).select('filePath fileName fileType').lean();
    if (!dsr || !dsr.filePath) { res.status(404).json({ error: 'File not found' }); return; }
    const absPath = _path2.default.join(__dirname, '..', '..', dsr.filePath);
    if (!_fs2.default.existsSync(absPath)) { res.status(404).json({ error: 'File not found on disk' }); return; }
    res.setHeader('Content-Disposition', `attachment; filename="${dsr.fileName || 'document'}"`);
    if (dsr.fileType) res.setHeader('Content-Type', dsr.fileType);
    _fs2.default.createReadStream(absPath).pipe(res);
  } catch (e5) {
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// POST /api/dsr/:id/reparse — re-parse an already-uploaded DSR document
router.post('/:id/reparse', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const dsr = await _models.DSR.findById(req.params.id);
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    if (!dsr.filePath) { res.status(400).json({ error: 'No file associated with this DSR' }); return; }

    const absPath = _path2.default.join(__dirname, '..', '..', dsr.filePath);
    if (!_fs2.default.existsSync(absPath)) { res.status(404).json({ error: 'File not found on disk' }); return; }

    const fileBuffer = _fs2.default.readFileSync(absPath);
    const ext = _path2.default.extname(dsr.filePath).toLowerCase();

    let rawText = '';
    let tableRows = [];
    let documentHtml = '';

    if (ext === '.docx') {
      rawText = await _dsrparser.extractTextFromDocx.call(void 0, fileBuffer);
      tableRows = await _dsrparser.extractTableRowsFromDocx.call(void 0, fileBuffer);
      documentHtml = await _dsrparser.extractFullHtmlFromDocx.call(void 0, fileBuffer);
    } else if (ext === '.doc') {
      const docxBuffer = await _dsrparser.convertDocToDocx.call(void 0, fileBuffer);
      if (docxBuffer) {
        rawText = await _dsrparser.extractTextFromDocx.call(void 0, docxBuffer);
        tableRows = await _dsrparser.extractTableRowsFromDocx.call(void 0, docxBuffer);
        documentHtml = await _dsrparser.extractFullHtmlFromDocx.call(void 0, docxBuffer);
      } else {
        rawText = await _dsrparser.extractTextFromDoc.call(void 0, fileBuffer);
        documentHtml = `<pre style="white-space:pre-wrap;font-family:serif;font-size:12pt;line-height:1.6">${rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
      }
    } else {
      rawText = fileBuffer.toString('utf8');
      documentHtml = `<pre style="white-space:pre-wrap;font-family:serif;font-size:12pt;line-height:1.6">${rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
    }

    let parseResult;
    if (tableRows.length > 0) {
      parseResult = _dsrparser.parseStructuredDSR.call(void 0, tableRows, rawText);
    } else {
      parseResult = _dsrparser.parseTaskForceDSR.call(void 0, rawText);
    }

    // Match police stations, sectors, and officers
    const parsedCases = [];
    for (const c of parseResult.cases) {
      const matchedPSId = await _dsrparser.matchPoliceStation.call(void 0, c.policeStation);
      let matchedOfficerId = null;
      let matchedZoneId = null;
      let matchedSectorId = null;
      let matchedSHOId = null;

      if (matchedPSId) {
        const ps = await _models.PoliceStation.findById(matchedPSId).populate('circleId').lean() ;
        if (_optionalChain([ps, 'optionalAccess', _22 => _22.circleId, 'optionalAccess', _23 => _23.divisionId])) {
          const Division = require('../models').Division;
          const div = await Division.findById(ps.circleId.divisionId).lean() ;
          if (_optionalChain([div, 'optionalAccess', _24 => _24.zoneId])) matchedZoneId = div.zoneId.toString();
        }
        const sectors = await _models.Sector.find({ policeStationId: matchedPSId }).lean();
        if (sectors.length > 0 && c.sector) {
          const sectorNum = _optionalChain([c, 'access', _25 => _25.sector, 'access', _26 => _26.match, 'call', _27 => _27(/\d+/), 'optionalAccess', _28 => _28[0]]);
          if (sectorNum) {
            const matched = sectors.find(s => _optionalChain([s, 'access', _29 => _29.name, 'access', _30 => _30.match, 'call', _31 => _31(/\d+/), 'optionalAccess', _32 => _32[0]]) === sectorNum);
            if (matched) {
              matchedSectorId = matched._id.toString();
              const sectorOfficers = await _models.SectorOfficer.find({ sectorId: matched._id, role: 'PRIMARY_SI', isActive: true }).lean();
              for (const so of sectorOfficers) {
                const off = await _models.Officer.findById(so.officerId).select('remarks').lean();
                if (new RegExp(`(?:sec(?:tor)?)[\\s\\-–]*${sectorNum}\\b`, 'i').test(_optionalChain([off, 'optionalAccess', _33 => _33.remarks]) || '')) {
                  matchedOfficerId = so.officerId.toString();
                  break;
                }
              }
              if (!matchedOfficerId && sectorOfficers.length > 0) {
                matchedOfficerId = sectorOfficers[0].officerId.toString();
              }
            }
          }
        }
        // SHO
        if (sectors.length > 0) {
          const allSO = await _models.SectorOfficer.find({ sectorId: { $in: sectors.map(s => s._id) }, role: 'PRIMARY_SI', isActive: true }).lean();
          for (const so of allSO) {
            const off = await _models.Officer.findById(so.officerId).select('remarks').lean();
            if ((_optionalChain([off, 'optionalAccess', _34 => _34.remarks]) || '').toLowerCase().includes('admin')) {
              matchedSHOId = so.officerId.toString();
              break;
            }
          }
        }
      }

      parsedCases.push({
        ...c,
        matchedPSId: matchedPSId || undefined,
        matchedZoneId: matchedZoneId || undefined,
        matchedSectorId: matchedSectorId || undefined,
        matchedOfficerId: matchedOfficerId || undefined,
        matchedSHOId: matchedSHOId || undefined,
      });
    }

    dsr.rawText = parseResult.rawText;
    dsr.documentHtml = documentHtml || undefined;
    dsr.parsedCases = parsedCases ;
    dsr.totalCases = parsedCases.length;
    dsr.processingStatus = _models.DSRStatus.COMPLETED;
    dsr.processedAt = new Date();

    if (parseResult.reportDate) {
      const parts = parseResult.reportDate.split(/[-/.]/);
      if (parts.length === 3) {
        const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        if (!isNaN(d.getTime())) dsr.date = d;
      }
    }

    await dsr.save();
    console.log('[ROUTE] Re-parsed DSR', req.params.id, '→', parsedCases.length, 'cases');

    const populated = await _models.DSR.findById(dsr._id)
      .populate('parsedCases.matchedPSId', 'name code')
      .populate('parsedCases.matchedZoneId', 'name code')
      .populate('parsedCases.matchedSectorId', 'name')
      .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank phone')
      .populate('parsedCases.matchedSHOId', 'name badgeNumber rank phone')
      .lean();

    res.json({ data: populated });
  } catch (err) {
    console.error('[ROUTE] REPARSE ERROR:', err.message, err.stack);
    res.status(500).json({ error: 'Re-parse failed', details: err.message });
  }
});

// PUT /api/dsr/:id
router.put('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const dsr = await _models.DSR.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    res.json({ data: dsr });
  } catch (e6) {
    res.status(500).json({ error: 'Failed to update DSR' });
  }
});

// DELETE /api/dsr/:id
router.delete('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const dsr = await _models.DSR.findByIdAndDelete(req.params.id);
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    res.json({ success: true });
  } catch (e7) {
    res.status(500).json({ error: 'Failed to delete DSR' });
  }
});

exports. default = router;
