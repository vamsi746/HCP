import { Router, Request, Response } from 'express';
import { Case, OfficerRank } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import { checkMissedAction } from '../services/escalation';

const router = Router();

// GET /api/cases
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { policeStationId, crimeType, handledBy, isMissedBySI, startDate, endDate, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (policeStationId) filter.policeStationId = policeStationId;
    if (crimeType) filter.crimeType = crimeType;
    if (handledBy) filter.handledBy = handledBy;
    if (isMissedBySI !== undefined) filter.isMissedBySI = isMissedBySI === 'true';
    if (startDate || endDate) {
      filter.caseDate = {};
      if (startDate) filter.caseDate.$gte = new Date(startDate as string);
      if (endDate) filter.caseDate.$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [cases, total] = await Promise.all([
      Case.find(filter).populate('policeStationId', 'name code').skip(skip).limit(parseInt(limit as string)).sort({ caseDate: -1 }).lean(),
      Case.countDocuments(filter),
    ]);

    res.json({ data: cases, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// GET /api/cases/stats/by-crime-type
router.get('/stats/by-crime-type', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await Case.aggregate([
      { $group: { _id: '$crimeType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data: stats });
  } catch {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/cases/stats/by-handler
router.get('/stats/by-handler', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await Case.aggregate([
      { $group: { _id: '$handledBy', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data: stats });
  } catch {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/cases/stats/daily-trend
router.get('/stats/daily-trend', authenticate, async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || '30');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stats = await Case.aggregate([
      { $match: { caseDate: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$caseDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ data: stats });
  } catch {
    res.status(500).json({ error: 'Failed to get trend' });
  }
});

// GET /api/cases/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const c = await Case.findById(req.params.id).populate('policeStationId dsrId').lean();
    if (!c) { res.status(404).json({ error: 'Case not found' }); return; }
    res.json({ data: c });
  } catch {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// POST /api/cases — log a new incident (task force detection triggers auto-escalation)
router.post('/', authenticate, requireMinRank(OfficerRank.SI), async (req: Request, res: Response) => {
  try {
    const caseDoc = await Case.create({
      ...req.body,
      caseDate: req.body.caseDate || new Date(),
    });

    // If handled by task force → auto-trigger violation & warning for responsible SIs
    if (['TASK_FORCE', 'SIT', 'SOT', 'ANTI_VICE'].includes(caseDoc.handledBy)) {
      await checkMissedAction(caseDoc);
    }

    const populated = await Case.findById(caseDoc._id).populate('policeStationId', 'name code').lean();
    res.status(201).json({ data: populated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/cases/:id
router.put('/:id', authenticate, requireMinRank(OfficerRank.SI), async (req: Request, res: Response) => {
  try {
    const c = await Case.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('policeStationId', 'name code');
    if (!c) { res.status(404).json({ error: 'Case not found' }); return; }
    res.json({ data: c });
  } catch {
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// DELETE /api/cases/:id
router.delete('/:id', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const c = await Case.findByIdAndDelete(req.params.id);
    if (!c) { res.status(404).json({ error: 'Case not found' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

export default router;
