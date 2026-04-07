import { Router, Request, Response } from 'express';
import { Officer, OfficerRank, SectorOfficer, Violation } from '../models';
import { authenticate } from '../middleware/auth';
import { requireMinRank } from '../middleware/rbac';
import bcrypt from 'bcryptjs';

const router = Router();

// GET /api/officers
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { search, rank, isActive, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (rank) filter.rank = rank;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { badgeNumber: { $regex: search, $options: 'i' } },
    ];

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [officers, total] = await Promise.all([
      Officer.find(filter).select('-passwordHash').skip(skip).limit(parseInt(limit as string)).sort({ rank: 1, name: 1 }).lean(),
      Officer.countDocuments(filter),
    ]);

    res.json({ data: officers, pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
});

// GET /api/officers/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const officer = await Officer.findById(req.params.id).select('-passwordHash').lean();
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }

    const [violations, assignments] = await Promise.all([
      Violation.find({ officerId: officer._id }).sort({ date: -1 }).limit(20).lean(),
      SectorOfficer.find({ officerId: officer._id, isActive: true }).populate('sectorId').lean(),
    ]);

    res.json({ data: { ...officer, violations, sectorAssignments: assignments } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch officer' });
  }
});

// POST /api/officers
router.post('/', authenticate, requireMinRank(OfficerRank.ACP), async (req: Request, res: Response) => {
  try {
    const { password, ...data } = req.body;
    const passwordHash = await bcrypt.hash(password || 'Shield@123', 12);
    const officer = await Officer.create({ ...data, passwordHash });
    res.status(201).json({ data: officer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/officers/:id
router.put('/:id', authenticate, requireMinRank(OfficerRank.ACP), async (req: Request, res: Response) => {
  try {
    const officer = await Officer.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-passwordHash');
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }
    res.json({ data: officer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/officers/:id/assign-sector
router.post('/:id/assign-sector', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const { sectorId, role } = req.body;
    const assignment = await SectorOfficer.create({ sectorId, officerId: req.params.id, role });
    res.status(201).json({ data: assignment });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/officers/:id/reassign-sector
router.put('/:id/reassign-sector', authenticate, requireMinRank(OfficerRank.CI), async (req: Request, res: Response) => {
  try {
    const { sectorId, role } = req.body;
    // Deactivate current assignments
    await SectorOfficer.updateMany({ officerId: req.params.id, isActive: true }, { isActive: false });
    // Create new assignment
    const assignment = await SectorOfficer.create({ sectorId, officerId: req.params.id, role: role || 'PRIMARY_SI' });
    res.json({ data: assignment });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/officers/:id
router.delete('/:id', authenticate, requireMinRank(OfficerRank.ACP), async (req: Request, res: Response) => {
  try {
    const officer = await Officer.findByIdAndDelete(req.params.id);
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }
    await SectorOfficer.deleteMany({ officerId: req.params.id });
    res.json({ data: { message: 'Officer deleted' } });
  } catch {
    res.status(500).json({ error: 'Failed to delete officer' });
  }
});

// GET /api/officers/:id/performance
router.get('/:id/performance', authenticate, async (req: Request, res: Response) => {
  try {
    const violations = await Violation.aggregate([
      { $match: { officerId: req.params.id } },
      { $group: { _id: '$violationType', count: { $sum: 1 } } },
    ]);
    res.json({ data: violations });
  } catch {
    res.status(500).json({ error: 'Failed to get performance' });
  }
});

export default router;
