import { Router, Request, Response } from 'express';
import { Officer, DSR, Case, Violation, DisciplinaryAction, Appeal } from '../models';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeOfficers, totalSIs, dsrsToday, activeViolations, pendingActions, totalCases, missedCases, totalWarnings, totalSuspensions, taskForceIncidents] = await Promise.all([
      Officer.countDocuments({ isActive: true }),
      Officer.countDocuments({ isActive: true, rank: 'SI' }),
      DSR.countDocuments({ date: { $gte: today } }),
      Violation.countDocuments({ isExempted: false }),
      DisciplinaryAction.countDocuments({ status: 'PENDING' }),
      Case.countDocuments(),
      Case.countDocuments({ isMissedBySI: true }),
      DisciplinaryAction.countDocuments({ actionType: 'WARNING' }),
      DisciplinaryAction.countDocuments({ actionType: 'SUSPENSION' }),
      Case.countDocuments({ handledBy: { $in: ['TASK_FORCE', 'SIT', 'SOT', 'ANTI_VICE'] } }),
    ]);

    res.json({
      data: { activeOfficers, totalSIs, dsrsToday, activeViolations, pendingActions, totalCases, missedCases, totalWarnings, totalSuspensions, taskForceIncidents },
    });
  } catch {
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// GET /api/reports/bottom-performers
router.get('/bottom-performers', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$officerId', violationCount: { $sum: 1 } } },
      { $sort: { violationCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { violationCount: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
    ]);
    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Failed to get performers' });
  }
});

// GET /api/reports/top-performers
router.get('/top-performers', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await DisciplinaryAction.aggregate([
      { $match: { actionType: 'COMMENDATION' } },
      { $group: { _id: '$officerId', commendations: { $sum: 1 } } },
      { $sort: { commendations: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { commendations: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
    ]);
    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Failed to get performers' });
  }
});

// GET /api/reports/zone-comparison
router.get('/zone-comparison', authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$violationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Failed to get comparison' });
  }
});

export default router;
