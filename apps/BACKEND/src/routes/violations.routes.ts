import { Router, Request, Response } from 'express';
import { Violation, OfficerRank } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import mongoose from 'mongoose';

const router = Router();

// GET /api/violations
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { officerId, violationType, severity, isExempted, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (officerId) filter.officerId = officerId;
    if (violationType) filter.violationType = violationType;
    if (severity) filter.severity = severity;
    if (isExempted !== undefined) filter.isExempted = isExempted === 'true';

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [violations, total] = await Promise.all([
      Violation.find(filter).populate('officerId', 'name badgeNumber rank').populate('caseId', 'crimeType firNumber')
        .skip(skip).limit(parseInt(limit as string)).sort({ date: -1 }).lean(),
      Violation.countDocuments(filter),
    ]);

    res.json({ data: violations, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch violations' });
  }
});

// POST /api/violations/:id/exempt
router.post('/:id/exempt', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const violation = await Violation.findByIdAndUpdate(req.params.id, {
      isExempted: true,
      exemptionReason: req.body.reason,
      exemptedBy: req.user!.id,
    }, { new: true });
    if (!violation) { res.status(404).json({ error: 'Violation not found' }); return; }
    res.json({ data: violation });
  } catch {
    res.status(500).json({ error: 'Failed to exempt violation' });
  }
});

// GET /api/violations/stats/by-officer
router.get('/stats/by-officer', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$officerId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { count: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
    ]);
    res.json({ data: stats });
  } catch {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// PUT /api/violations/:id
router.put('/:id', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const violation = await Violation.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('officerId', 'name badgeNumber rank');
    if (!violation) { res.status(404).json({ error: 'Violation not found' }); return; }
    res.json({ data: violation });
  } catch {
    res.status(500).json({ error: 'Failed to update violation' });
  }
});

// DELETE /api/violations/:id
router.delete('/:id', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const violation = await Violation.findByIdAndDelete(req.params.id);
    if (!violation) { res.status(404).json({ error: 'Violation not found' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete violation' });
  }
});

// GET /api/violations/stats/by-zone
router.get('/stats/by-zone', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$violationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data: stats });
  } catch {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
