import { Router, Request, Response } from 'express';
import path from 'path';
import { DSR, DSRStatus, ForceType } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import { OfficerRank, PoliceStation, SectorOfficer, Sector } from '../models';
import { upload } from '../middleware/upload';
import { extractTextFromDocx, parseTaskForceDSR, matchPoliceStation } from '../services/dsr-parser';

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
      .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank phone')
      .lean();
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
      res.status(400).json({ error: 'Invalid forceType. Must be TASK_FORCE, H_FAST, or H_NEW' });
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
      if (ext === '.docx') {
        rawText = await extractTextFromDocx(file.buffer);
      } else if (ext === '.txt') {
        rawText = file.buffer.toString('utf8');
      } else {
        dsr.processingStatus = DSRStatus.MANUAL_REVIEW;
        dsr.missingFields = ['Unsupported file format — only .docx and .txt are supported for auto-parsing'];
        await dsr.save();
        res.status(201).json({ data: dsr, message: 'File uploaded but format not supported for auto-parsing' });
        return;
      }

      // Parse based on force type
      let parseResult;
      if (forceType === ForceType.TASK_FORCE) {
        parseResult = parseTaskForceDSR(rawText);
      } else {
        // H_FAST and H_NEW parsers to be added later — for now save raw text
        dsr.rawText = rawText;
        dsr.processingStatus = DSRStatus.MANUAL_REVIEW;
        dsr.missingFields = [`Parser for ${forceType} not yet implemented`];
        await dsr.save();
        res.status(201).json({ data: dsr, message: `File uploaded. ${forceType} parser coming soon.` });
        return;
      }

      // Match police stations and officers for each parsed case
      const parsedCases = [];
      for (const c of parseResult.cases) {
        const matchedPSId = await matchPoliceStation(c.policeStation);

        // If PS matched, find the sector SI responsible
        let matchedOfficerId: string | null = null;
        let matchedZoneId: string | null = null;
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

          // Find sectors for this PS then the primary SI
          const sectors = await Sector.find({ policeStationId: matchedPSId }).lean();
          if (sectors.length > 0) {
            const sectorOfficer = await SectorOfficer.findOne({
              sectorId: { $in: sectors.map((s) => s._id) },
              role: 'PRIMARY_SI',
              isActive: true,
            }).lean();
            if (sectorOfficer) {
              matchedOfficerId = sectorOfficer.officerId.toString();
            }
          }
        }

        parsedCases.push({
          ...c,
          matchedPSId: matchedPSId || undefined,
          matchedZoneId: matchedZoneId || undefined,
          matchedOfficerId: matchedOfficerId || undefined,
        });
      }

      // Update DSR with parsed data
      dsr.rawText = parseResult.rawText;
      dsr.parsedCases = parsedCases as any;
      dsr.totalCases = parseResult.totalCases;
      dsr.processingStatus = DSRStatus.COMPLETED;
      dsr.processedAt = new Date();

      if (parseResult.reportDate) {
        const parts = parseResult.reportDate.split(/[-/.]/);
        if (parts.length === 3) {
          const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          if (!isNaN(d.getTime())) dsr.date = d;
        }
      }

      await dsr.save();

      // Re-fetch with populated fields
      const populated = await DSR.findById(dsr._id)
        .populate('parsedCases.matchedPSId', 'name code')
        .populate('parsedCases.matchedZoneId', 'name code')
        .populate('parsedCases.matchedOfficerId', 'name badgeNumber rank phone')
        .lean();

      res.status(201).json({ data: populated });
    } catch (parseErr: any) {
      dsr.processingStatus = DSRStatus.FAILED;
      dsr.missingFields = [parseErr.message || 'Parse error'];
      await dsr.save();
      res.status(201).json({ data: dsr, error: 'Upload succeeded but parsing failed', details: parseErr.message });
    }
  } catch {
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
