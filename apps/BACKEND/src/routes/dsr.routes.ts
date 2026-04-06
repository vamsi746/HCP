import { Router, Request, Response } from 'express';
import { DSR, DSRStatus } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import { OfficerRank } from '../models';
import { upload } from '../middleware/upload';

const router = Router();

// GET /api/dsr
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, zoneId, startDate, endDate, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (status) filter.processingStatus = status;
    if (zoneId) filter.zoneId = zoneId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate as string);
      if (endDate) filter.date.$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [dsrs, total] = await Promise.all([
      DSR.find(filter).populate('zoneId uploadedBy', 'name code badgeNumber').skip(skip).limit(parseInt(limit as string)).sort({ date: -1 }).lean(),
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

// GET /api/dsr/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const dsr = await DSR.findById(req.params.id).populate('zoneId uploadedBy policeStationId').lean();
    if (!dsr) { res.status(404).json({ error: 'DSR not found' }); return; }
    res.json({ data: dsr });
  } catch {
    res.status(500).json({ error: 'Failed to fetch DSR' });
  }
});

// POST /api/dsr/upload
router.post('/upload', authenticate, requireMinRank(OfficerRank.SI), upload.array('files', 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) { res.status(400).json({ error: 'No files uploaded' }); return; }

    const dsrs = await Promise.all(
      files.map((file) =>
        DSR.create({
          date: req.body.date || new Date(),
          zoneId: req.body.zoneId || undefined,
          fileName: file.originalname,
          fileType: file.mimetype,
          processingStatus: DSRStatus.PENDING,
          uploadedBy: req.user!.id,
        })
      )
    );

    res.status(201).json({ data: dsrs });
  } catch {
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
