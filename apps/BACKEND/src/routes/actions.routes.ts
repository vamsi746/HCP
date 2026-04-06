import { Router, Request, Response } from 'express';
import { DisciplinaryAction, OfficerRank } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import { generateDocument } from '../services/document-gen';

const router = Router();

// GET /api/actions
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { officerId, actionType, status, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (officerId) filter.officerId = officerId;
    if (actionType) filter.actionType = actionType;
    if (status) filter.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [actions, total] = await Promise.all([
      DisciplinaryAction.find(filter)
        .populate('officerId', 'name badgeNumber rank')
        .populate('violationId')
        .populate('issuedBy', 'name badgeNumber')
        .skip(skip).limit(parseInt(limit as string)).sort({ issuedAt: -1 }).lean(),
      DisciplinaryAction.countDocuments(filter),
    ]);

    res.json({ data: actions, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

// POST /api/actions
router.post('/', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const action = await DisciplinaryAction.create({ ...req.body, issuedBy: req.user!.id });
    const populated = await DisciplinaryAction.findById(action._id)
      .populate('officerId', 'name badgeNumber rank')
      .populate('violationId');

    if (populated) {
      const docUrl = await generateDocument(populated);
      populated.documentUrl = docUrl;
      await populated.save();
    }

    res.status(201).json({ data: populated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/actions/:id/acknowledge
router.patch('/:id/acknowledge', authenticate, async (req: Request, res: Response) => {
  try {
    const action = await DisciplinaryAction.findByIdAndUpdate(req.params.id, { status: 'ACKNOWLEDGED' }, { new: true });
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ data: action });
  } catch {
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
});

// PATCH /api/actions/:id/respond
router.patch('/:id/respond', authenticate, async (req: Request, res: Response) => {
  try {
    const action = await DisciplinaryAction.findByIdAndUpdate(req.params.id, {
      status: 'RESPONDED', responseReceived: req.body.response,
    }, { new: true });
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ data: action });
  } catch {
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// PATCH /api/actions/:id/close
router.patch('/:id/close', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const action = await DisciplinaryAction.findByIdAndUpdate(req.params.id, { status: 'CLOSED' }, { new: true });
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ data: action });
  } catch {
    res.status(500).json({ error: 'Failed to close' });
  }
});

export default router;
