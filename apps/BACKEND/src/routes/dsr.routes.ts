import { Router, Request, Response } from 'express';
import path from 'path';
import { DSR, DSRStatus, ForceType } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import { OfficerRank, Officer, PoliceStation, SectorOfficer, Sector } from '../models';
import { upload } from '../middleware/upload';
import { extractTextFromDocx, extractTextFromDoc, extractTableRowsFromDocx, parseTaskForceDSR, parseStructuredDSR, matchPoliceStation } from '../services/dsr-parser';

const router = Router();

// GET /api/dsr — list DSRs
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, forceType, zoneId, startDate, endDate, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (status) filter.processingStatus = status;
    if (forceType) filter.forceType = forceType;
    if (zoneId) filter.zoneId = zoneId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate as string);
      if (endDate) filter.date.$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [dsrs, total] = await Promise.all([
      DSR.find(filter)
        .populate('zoneId uploadedBy', 'name code badgeNumber')
        .skip(skip)
        .limit(parseInt(limit as string))
        .sort({ date: -1 })
        .lean(),
      DSR.countDocuments(filter),
    ]);

    res.json({ data: dsrs, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch DSRs' });
  }
});

// GET /api/dsr/stats/summary
router.get('/stats/summary', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await DSR.aggregate([
      { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
    ]);
    res.json({ data: stats });
  } catch {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/dsr/:id — full DSR with parsed cases
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const dsr = await DSR.findById(req.params.id)
      .populate('zoneId uploadedBy policeStationId')
      .populate('parsedCases.matchedPSId', 'name code')
      .populate('parsedCases.matchedZoneId', 'name code')
      .populate('parsedCases.matchedSectorId', 'name')
      .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank phone')        .populate('parsedCases.matchedSHOId', 'name badgeNumber rank phone')      .lean();
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    res.json({ data: dsr });
  } catch {
    res.status(500).json({ error: 'Failed to fetch DSR' });
  }
});

// POST /api/dsr/upload — upload + parse DSR document
router.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const { forceType } = req.body;
    if (!forceType || !Object.values(ForceType).includes(forceType)) {
      res.status(400).json({ error: 'Invalid forceType. Must be CHARMINAR_GOLCONDA, RAJENDRANAGAR_SHAMSHABAD, or KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS' });
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();

    // Create DSR record
    const dsr = await DSR.create({
      date: req.body.date || new Date(),
      forceType,
      fileName: file.originalname,
      fileType: file.mimetype,
      processingStatus: DSRStatus.PROCESSING,
      uploadedBy: req.user!.id,
    });

    // Parse the document from memory buffer (no file stored on disk)
    try {
      let rawText = '';
      let tableRows: string[][] = [];

      if (ext === '.docx') {
        rawText = await extractTextFromDocx(file.buffer);
        tableRows = await extractTableRowsFromDocx(file.buffer);
      } else if (ext === '.doc') {
        rawText = await extractTextFromDoc(file.buffer);
      } else if (ext === '.txt') {
        rawText = file.buffer.toString('utf8');
      } else {
        dsr.processingStatus = DSRStatus.MANUAL_REVIEW;
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
        parseResult = parseStructuredDSR(tableRows, rawText);
      } else {
        console.log('[ROUTE] Using text-based parser (no HTML table rows)');
        parseResult = parseTaskForceDSR(rawText);
      }

      // Derive raidedBy from parsed cases' actionTakenBy
      const uniqueForces = [...new Set(parseResult.cases.map(c => c.actionTakenBy).filter(Boolean))];
      dsr.raidedBy = uniqueForces.join(', ') || "Commissioner's Task Force";

      // Match police stations, sectors, and officers for each parsed case
      const parsedCases = [];
      for (const c of parseResult.cases) {
        const matchedPSId = await matchPoliceStation(c.policeStation);

        let matchedOfficerId: string | null = null;
        let matchedZoneId: string | null = null;
        let matchedSectorId: string | null = null;
        let matchedSHOId: string | null = null;

        if (matchedPSId) {
          const ps = await PoliceStation.findById(matchedPSId).populate('circleId').lean() as any;
          if (ps) {
            // Walk up: PS → Circle → Division → Zone
            if (ps.circleId?.divisionId) {
              const Division = require('../models').Division;
              const div = await Division.findById(ps.circleId.divisionId).lean() as any;
              if (div?.zoneId) matchedZoneId = div.zoneId.toString();
            }
          }

          // Find the specific sector from the parsed sector name (e.g. "Sector 1")
          const sectors = await Sector.find({ policeStationId: matchedPSId }).lean();
          if (sectors.length > 0 && c.sector) {
            // Match by sector name/number
            const sectorNum = c.sector.match(/\d+/)?.[0];
            if (sectorNum) {
              const matched = sectors.find(s => {
                const dbNum = s.name.match(/\d+/)?.[0];
                return dbNum === sectorNum;
              });
              if (matched) {
                matchedSectorId = matched._id.toString();
                // Find the best SI for this sector:
                // 1st priority: officer whose remarks mention this sector number
                // 2nd priority: any officer not purely admin/dsi/non-sector
                // 3rd priority: anyone
                const sectorOfficers = await SectorOfficer.find({
                  sectorId: matched._id,
                  role: 'PRIMARY_SI',
                  isActive: true,
                }).lean();

                // 1st: officer whose remarks explicitly mention "Sector N" for the target sector
                for (const so of sectorOfficers) {
                  const off = await Officer.findById(so.officerId).select('remarks').lean();
                  const remarks = (off?.remarks || '');
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
                    const off = await Officer.findById(so.officerId).select('remarks').lean();
                    const remarks = (off?.remarks || '').toLowerCase();
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
            const allSOForSHO = await SectorOfficer.find({
              sectorId: { $in: sectors.map((s) => s._id) },
              role: 'PRIMARY_SI',
              isActive: true,
            }).lean();
            for (const so of allSOForSHO) {
              const off = await Officer.findById(so.officerId).select('remarks').lean();
              const remarks = (off?.remarks || '').toLowerCase();
              if (remarks.includes('admin')) {
                matchedSHOId = so.officerId.toString();
                break;
              }
            }
          }

          // Fallback: if no sector-specific match, try any sector SI for this PS
          if (!matchedOfficerId && sectors.length > 0) {
            const allSectorOfficers = await SectorOfficer.find({
              sectorId: { $in: sectors.map((s) => s._id) },
              role: 'PRIMARY_SI',
              isActive: true,
            }).lean();
            for (const so of allSectorOfficers) {
              const off = await Officer.findById(so.officerId).select('remarks').lean();
              const remarks = (off?.remarks || '').toLowerCase();
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
      dsr.parsedCases = parsedCases as any;
      dsr.totalCases = parsedCases.length;
      dsr.processingStatus = DSRStatus.COMPLETED;
      dsr.processedAt = new Date();

      console.log('[ROUTE] parsedCases count:', parsedCases.length, 'totalCases:', parsedCases.length);
      if (parsedCases.length > 0) {
        console.log('[ROUTE] first case sample:', JSON.stringify(parsedCases[0]).slice(0, 300));
      }

      if (parseResult.reportDate) {
        const parts = parseResult.reportDate.split(/[-/.]/);
        if (parts.length === 3) {
          const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          if (!isNaN(d.getTime())) dsr.date = d;
        }
      }

      await dsr.save();
      console.log('[ROUTE] saved successfully, parsedCases in DB:', dsr.parsedCases?.length);

      // Re-fetch with populated fields
      const populated = await DSR.findById(dsr._id)
        .populate('parsedCases.matchedPSId', 'name code')
        .populate('parsedCases.matchedZoneId', 'name code')
        .populate('parsedCases.matchedSectorId', 'name')
        .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank phone')
        .populate('parsedCases.matchedSHOId', 'name badgeNumber rank phone')
        .lean();

      res.status(201).json({ data: populated });
    } catch (parseErr: any) {
      console.error('[ROUTE] PARSE/MATCH ERROR:', parseErr.message, parseErr.stack);
      dsr.processingStatus = DSRStatus.FAILED;
      dsr.missingFields = [parseErr.message || 'Parse error'];
      await dsr.save();
      res.status(201).json({ data: dsr, error: 'Upload succeeded but parsing failed', details: parseErr.message });
    }
  } catch (outerErr: any) {
    console.error('[ROUTE] OUTER ERROR:', outerErr.message, outerErr.stack);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// PUT /api/dsr/:id
router.put('/:id', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const dsr = await DSR.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    res.json({ data: dsr });
  } catch {
    res.status(500).json({ error: 'Failed to update DSR' });
  }
});

// DELETE /api/dsr/:id
router.delete('/:id', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const dsr = await DSR.findByIdAndDelete(req.params.id);
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete DSR' });
  }
});

export default router;
