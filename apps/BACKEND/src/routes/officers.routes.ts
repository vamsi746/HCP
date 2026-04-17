import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Officer, OfficerRank, SectorOfficer, Violation, Memo, Zone, PoliceStation, Sector } from '../models';
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

// GET /api/officers/memo-tracker — officers with zone/PS/sector + memo warning counts (paginated)
router.get('/memo-tracker', authenticate, async (req: Request, res: Response) => {
  try {
    const { zoneId, psId, sector, search, viewMode = 'with-memos', page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));

    // 1. Get active sector assignments with officer + sector + station data
    const assignments = await SectorOfficer.find({ isActive: true })
      .populate('officerId', 'name badgeNumber rank phone isActive remarks')
      .populate({
        path: 'sectorId',
        select: 'name policeStationId',
        populate: {
          path: 'policeStationId',
          select: 'name code circleId',
        },
      })
      .lean();

    // 2. Build zone lookup: station → zone
    const zones = await Zone.find().select('_id name').lean();
    const { Division, Circle } = require('../models');
    const divisions = await Division.find().select('_id zoneId').lean();
    const circles = await Circle.find().select('_id divisionId').lean();

    const circleToDiv: Record<string, string> = {};
    for (const c of circles) circleToDiv[String(c._id)] = String(c.divisionId);
    const divToZone: Record<string, string> = {};
    for (const d of divisions) divToZone[String(d._id)] = String(d.zoneId);
    const zoneMap: Record<string, any> = {};
    for (const z of zones) zoneMap[String(z._id)] = z;

    const stationToZoneId = (station: any): string | null => {
      if (!station?.circleId) return null;
      const divId = circleToDiv[String(station.circleId)];
      if (!divId) return null;
      return divToZone[divId] || null;
    };

    // 3. Get memo counts per officer (only APPROVED/SENT memos where officer is recipient)
    const memoCounts = await Memo.aggregate([
      { $match: { recipientId: { $exists: true, $ne: null }, status: { $in: ['APPROVED', 'SENT'] } } },
      { $group: { _id: '$recipientId', count: { $sum: 1 } } },
    ]);
    const memoCountMap: Record<string, number> = {};
    for (const m of memoCounts) memoCountMap[String(m._id)] = m.count;

    // 4. Build all officer rows
    type OfficerRow = {
      officerId: string;
      name: string;
      badgeNumber: string;
      rank: string;
      phone: string;
      remarks: string;
      sector: string;
      sectorId: string;
      policeStation: string;
      psId: string;
      zone: string;
      zoneId: string;
      role: string;
      memoCount: number;
    };

    const rows: OfficerRow[] = [];
    const seen = new Set<string>();
    const assignedOfficerIds = new Set<string>();

    for (const a of assignments) {
      const officer = a.officerId as any;
      const sec = a.sectorId as any;
      if (!officer || !sec || !officer.isActive) continue;

      const station = sec.policeStationId as any;
      if (!station) continue;

      const zId = stationToZoneId(station);
      if (!zId) continue;
      const zone = zoneMap[zId];
      if (!zone) continue;

      const key = `${officer._id}-${sec._id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      assignedOfficerIds.add(String(officer._id));

      // Apply filters
      if (zoneId && String(zId) !== String(zoneId)) continue;
      if (psId && String(station._id) !== String(psId)) continue;
      if (sector && sec.name !== sector) continue;
      if (search) {
        const s = (search as string).toLowerCase();
        if (!officer.name.toLowerCase().includes(s) && !officer.badgeNumber.toLowerCase().includes(s)) continue;
      }

      rows.push({
        officerId: String(officer._id),
        name: officer.name,
        badgeNumber: officer.badgeNumber,
        rank: officer.rank,
        phone: officer.phone || '',
        remarks: officer.remarks || '',
        sector: sec.name,
        sectorId: String(sec._id),
        policeStation: station.name,
        psId: String(station._id),
        zone: zone.name,
        zoneId: String(zone._id),
        role: a.role,
        memoCount: memoCountMap[String(officer._id)] || 0,
      });
    }

    // 5. Include officers without sector assignments
    if (!psId && !sector) {
      const allOfficers = await Officer.find({ isActive: true }).select('name badgeNumber rank phone remarks').lean();
      for (const off of allOfficers) {
        if (assignedOfficerIds.has(String(off._id))) continue;
        if (search) {
          const s = (search as string).toLowerCase();
          if (!off.name.toLowerCase().includes(s) && !off.badgeNumber.toLowerCase().includes(s)) continue;
        }
        rows.push({
          officerId: String(off._id),
          name: off.name,
          badgeNumber: off.badgeNumber,
          rank: off.rank,
          phone: off.phone || '',
          remarks: off.remarks || '',
          sector: '—',
          sectorId: '',
          policeStation: '—',
          psId: '',
          zone: 'HQ',
          zoneId: '',
          role: '—',
          memoCount: memoCountMap[String(off._id)] || 0,
        });
      }
    }

    // 6. Sort by memoCount desc, then zone → PS → sector → rank
    const rankOrder: Record<string, number> = { COMMISSIONER: 0, ADDL_CP: 1, DCP: 2, ACP: 3, CI: 4, SI: 5, WSI: 6, PSI: 7, ASI: 8, HEAD_CONSTABLE: 9, CONSTABLE: 10 };
    rows.sort((a, b) =>
      (b.memoCount - a.memoCount) ||
      a.zone.localeCompare(b.zone) ||
      a.policeStation.localeCompare(b.policeStation) ||
      a.sector.localeCompare(b.sector, undefined, { numeric: true }) ||
      (rankOrder[a.rank] ?? 99) - (rankOrder[b.rank] ?? 99)
    );

    // 7. Apply viewMode filter
    let filtered = rows;
    if (viewMode === 'with-memos') filtered = rows.filter((r) => r.memoCount > 0);
    else if (viewMode === 'action-required') filtered = rows.filter((r) => r.memoCount >= 3);

    // 8. Compute stats from full rows (pre-filter)
    const stats = {
      totalOfficers: rows.length,
      officersWithMemos: rows.filter((r) => r.memoCount > 0).length,
      totalMemos: rows.reduce((s, r) => s + r.memoCount, 0),
      actionRequired: rows.filter((r) => r.memoCount >= 3).length,
    };

    // 9. Paginate
    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum);
    const skip = (pageNum - 1) * limitNum;
    const paged = filtered.slice(skip, skip + limitNum);

    res.json({
      data: paged,
      stats,
      pagination: { page: pageNum, limit: limitNum, total, totalPages },
    });
  } catch (err) {
    console.error('memo-tracker error:', err);
    res.status(500).json({ error: 'Failed to fetch officer tracking data' });
  }
});

// GET /api/officers/memo-tracker/:officerId/memos — memos issued to a specific officer
router.get('/memo-tracker/:officerId/memos', authenticate, async (req: Request, res: Response) => {
  try {
    const memos = await Memo.find({
      recipientId: new mongoose.Types.ObjectId(req.params.officerId),
      status: { $in: ['APPROVED', 'SENT'] },
    })
      .select('memoNumber crimeNo policeStation zone sections date status recipientDesignation subject complianceStatus compliedAt complianceDocumentName complianceDocumentPath complianceRemarks approvedAt')
      .sort({ date: 1 })
      .lean();

    res.json({ data: memos });
  } catch {
    res.status(500).json({ error: 'Failed to fetch officer memos' });
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
