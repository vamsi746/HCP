import { Router, Request, Response } from 'express';
import { Appeal, AppealStatus, OfficerRank } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import { config } from '../config';

const router = Router();

// GET /api/appeals
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [appeals, total] = await Promise.all([
      Appeal.find(filter)
        .populate('officerId', 'name badgeNumber rank')
        .populate('violationId')
        .populate('reviewedBy', 'name badgeNumber')
        .skip(skip).limit(parseInt(limit as string)).sort({ submittedAt: -1 }).lean(),
      Appeal.countDocuments(filter),
    ]);

    res.json({ data: appeals, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch appeals' });
  }
});

// POST /api/appeals
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const slaDeadline = new Date(Date.now() + config.appealSlaDays * 24 * 60 * 60 * 1000);
    const appeal = await Appeal.create({
      ...req.body,
      officerId: req.user!.id,
      slaDeadline,
    });
    res.status(201).json({ data: appeal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/appeals/:id/review
router.patch('/:id/review', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const { status, reviewComment } = req.body;
    const appeal = await Appeal.findByIdAndUpdate(req.params.id, {
      status, reviewComment,
      reviewedBy: req.user!.id,
      resolvedAt: [AppealStatus.APPROVED, AppealStatus.REJECTED].includes(status) ? new Date() : undefined,
    }, { new: true });
    if (!appeal) { res.status(404).json({ error: 'Appeal not found' }); return; }
    res.json({ data: appeal });
  } catch {
    res.status(500).json({ error: 'Failed to review appeal' });
  }
});

// PUT /api/appeals/:id
router.put('/:id', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const appeal = await Appeal.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('officerId', 'name badgeNumber rank');
    if (!appeal) { res.status(404).json({ error: 'Appeal not found' }); return; }
    res.json({ data: appeal });
  } catch {
    res.status(500).json({ error: 'Failed to update appeal' });
  }
});

// DELETE /api/appeals/:id
router.delete('/:id', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const appeal = await Appeal.findByIdAndDelete(req.params.id);
    if (!appeal) { res.status(404).json({ error: 'Appeal not found' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete appeal' });
  }
});

export default router;
