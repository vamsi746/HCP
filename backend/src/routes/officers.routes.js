"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _express = require('express');
var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
var _models = require('../models');
var _auth = require('../middleware/auth');
var _rbac = require('../middleware/rbac');
var _bcryptjs = require('bcryptjs'); var _bcryptjs2 = _interopRequireDefault(_bcryptjs);

const router = _express.Router.call(void 0, );

// GET /api/officers
router.get('/', _auth.authenticate, async (req, res) => {
  try {
    const { search, rank, isActive, page = '1', limit = '20' } = req.query;
    const filter = {};
    if (rank) filter.rank = rank;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { badgeNumber: { $regex: escaped, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page ) - 1) * parseInt(limit );
    const [officers, total] = await Promise.all([
      _models.Officer.find(filter).select('-passwordHash').skip(skip).limit(parseInt(limit )).sort({ rank: 1, name: 1 }).lean(),
      _models.Officer.countDocuments(filter),
    ]);

    res.json({ data: officers, pagination: { page: parseInt(page ), limit: parseInt(limit ), total } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
});

// GET /api/officers/memo-tracker — officers with zone/PS/sector + memo warning counts (paginated)
router.get('/memo-tracker', _auth.authenticate, async (req, res) => {
  try {
    const { zoneId, psId, sector, search, viewMode = 'with-memos', page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page ) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit ) || 50));

    // 1. Get active sector assignments with officer + sector + station data
    const assignments = await _models.SectorOfficer.find({ isActive: true })
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
    const zones = await _models.Zone.find().select('_id name').lean();
    const { Division, Circle } = require('../models');
    const divisions = await Division.find().select('_id zoneId').lean();
    const circles = await Circle.find().select('_id divisionId').lean();

    const circleToDiv = {};
    for (const c of circles) circleToDiv[String(c._id)] = String(c.divisionId);
    const divToZone = {};
    for (const d of divisions) divToZone[String(d._id)] = String(d.zoneId);
    const zoneMap = {};
    for (const z of zones) zoneMap[String(z._id)] = z;

    const stationToZoneId = (station) => {
      if (!_optionalChain([station, 'optionalAccess', _ => _.circleId])) return null;
      const divId = circleToDiv[String(station.circleId)];
      if (!divId) return null;
      return divToZone[divId] || null;
    };

    // 3. Get memo counts per officer, using cycle logic
    const allMemos = await _models.Memo.find({ recipientId: { $ne: null } })
      .select('recipientId memoType status date createdAt')
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const memoCountMap = {};
    const chargeCountMap = {};
    const totalMemoCountMap = {};
    for (const m of allMemos) {
      const rid = String(m.recipientId);
      if (!memoCountMap[rid]) memoCountMap[rid] = 0;
      if (!chargeCountMap[rid]) chargeCountMap[rid] = 0;
      if (!totalMemoCountMap[rid]) totalMemoCountMap[rid] = 0;

      if (m.memoType === 'CHARGE') {
        if (m.status !== 'REJECTED') {
          chargeCountMap[rid]++;
          memoCountMap[rid] = 0; // reset warnings on charge memo
        }
      } else {
        if (m.status === 'APPROVED' || m.status === 'SENT') {
          memoCountMap[rid]++;
          totalMemoCountMap[rid]++;
        }
      }
    }

    // 4. Build all officer rows
    
















    const rows = [];
    const seen = new Set();
    const assignedOfficerIds = new Set();

    for (const a of assignments) {
      const officer = a.officerId ;
      const sec = a.sectorId ;
      if (!officer || !sec || !officer.isActive) continue;

      const station = sec.policeStationId ;
      if (!station) continue;

      const zId = stationToZoneId(station);
      if (!zId) continue;
      const zone = zoneMap[zId];
      if (!zone) continue;

      const key = String(officer._id);
      if (seen.has(key)) continue;
      seen.add(key);
      assignedOfficerIds.add(String(officer._id));

      // Apply filters
      if (zoneId && String(zId) !== String(zoneId)) continue;
      if (psId && String(station._id) !== String(psId)) continue;
      if (sector && sec.name !== sector) continue;
      if (search) {
        const s = (search ).toLowerCase();
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
        chargeCount: chargeCountMap[String(officer._id)] || 0,
        totalMemoCount: totalMemoCountMap[String(officer._id)] || 0,
      });
    }

    // 5. Include officers without sector assignments
    if (!psId && !sector) {
      const allOfficers = await _models.Officer.find({ isActive: true }).select('name badgeNumber rank phone remarks').lean();
      for (const off of allOfficers) {
        if (assignedOfficerIds.has(String(off._id))) continue;
        if (search) {
          const s = (search ).toLowerCase();
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
          chargeCount: chargeCountMap[String(off._id)] || 0,
          totalMemoCount: totalMemoCountMap[String(off._id)] || 0,
        });
      }
    }

    // 6. Sort by memoCount desc, then zone → PS → sector → rank
    const rankOrder = { COMMISSIONER: 0, ADDL_CP: 1, DCP: 2, ACP: 3, CI: 4, SI: 5, WSI: 6, PSI: 7, ASI: 8, HEAD_CONSTABLE: 9, CONSTABLE: 10 };
    rows.sort((a, b) =>
      (b.memoCount - a.memoCount) ||
      a.zone.localeCompare(b.zone) ||
      a.policeStation.localeCompare(b.policeStation) ||
      a.sector.localeCompare(b.sector, undefined, { numeric: true }) ||
      (_nullishCoalesce(rankOrder[a.rank], () => ( 99))) - (_nullishCoalesce(rankOrder[b.rank], () => ( 99)))
    );

    // 7. Apply viewMode filter
    let filtered = rows;
    if (viewMode === 'with-memos') filtered = rows.filter((r) => r.memoCount > 0);
    else if (viewMode === 'action-required') filtered = rows.filter((r) => r.memoCount >= 3);
    else if (viewMode === 'charge-issued') filtered = rows.filter((r) => r.chargeCount > 0);

    // 8. Compute stats from full rows (pre-filter)
    const stats = {
      totalOfficers: rows.length,
      officersWithMemos: rows.filter((r) => r.memoCount > 0).length,
      totalMemos: rows.reduce((s, r) => s + r.memoCount, 0),
      actionRequired: rows.filter((r) => r.memoCount >= 3).length,
      chargeIssued: rows.filter((r) => r.chargeCount > 0).length,
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
router.get('/memo-tracker/:officerId/memos', _auth.authenticate, async (req, res) => {
  try {
    const officerOid = new _mongoose2.default.Types.ObjectId(req.params.officerId);
    const memos = await _models.Memo.find({
      recipientId: officerOid,
      $or: [
        // Warning memos: only show approved/sent
        { memoType: { $ne: 'CHARGE' }, status: { $in: ['APPROVED', 'SENT'] } },
        // Charge memos: show in any status so UI can track existence
        { memoType: 'CHARGE' },
      ],
    })
      .select('memoType memoNumber crimeNo policeStation zone sections date status recipientDesignation subject complianceStatus compliedAt complianceDocumentName complianceDocumentPath complianceRemarks approvedAt')
      .sort({ date: 1, createdAt: 1 })
      .lean();

    res.json({ data: memos });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to fetch officer memos' });
  }
});

// GET /api/officers/:id
router.get('/:id', _auth.authenticate, async (req, res) => {
  try {
    const officer = await _models.Officer.findById(req.params.id).select('-passwordHash').lean();
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }

    const [violations, assignments] = await Promise.all([
      _models.Violation.find({ officerId: officer._id }).sort({ date: -1 }).limit(20).lean(),
      _models.SectorOfficer.find({ officerId: officer._id, isActive: true }).populate('sectorId').lean(),
    ]);

    res.json({ data: { ...officer, violations, sectorAssignments: assignments } });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to fetch officer' });
  }
});

// POST /api/officers
router.post('/', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.ACP), async (req, res) => {
  try {
    const { password, ...data } = req.body;
    if (!password || password.length < 8) {
      res.status(400).json({ error: 'Password is required and must be at least 8 characters' });
      return;
    }
    const allowedFields = ['badgeNumber', 'name', 'rank', 'email', 'phone', 'isActive', 'recruitmentType', 'batch', 'remarks', 'joiningDate'];
    const safeData = {};
    for (const key of allowedFields) { if (data[key] !== undefined) safeData[key] = data[key]; }
    const passwordHash = await _bcryptjs2.default.hash(password, 12);
    const officer = await _models.Officer.create({ ...safeData, passwordHash });
    res.status(201).json({ data: officer });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/officers/:id
router.put('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.ACP), async (req, res) => {
  try {
    const allowedFields = ['name', 'rank', 'email', 'phone', 'isActive', 'recruitmentType', 'batch', 'remarks', 'joiningDate'];
    const safeUpdate = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) safeUpdate[key] = req.body[key]; }
    const officer = await _models.Officer.findByIdAndUpdate(req.params.id, safeUpdate, { new: true }).select('-passwordHash');
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }
    res.json({ data: officer });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/officers/:id/assign-sector
router.post('/:id/assign-sector', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const { sectorId, role } = req.body;
    const assignment = await _models.SectorOfficer.create({ sectorId, officerId: req.params.id, role });
    res.status(201).json({ data: assignment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/officers/:id/reassign-sector
router.put('/:id/reassign-sector', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const { sectorId, role } = req.body;
    // Deactivate current assignments
    await _models.SectorOfficer.updateMany({ officerId: req.params.id, isActive: true }, { isActive: false });
    // Create new assignment
    const assignment = await _models.SectorOfficer.create({ sectorId, officerId: req.params.id, role: role || 'PRIMARY_SI' });
    res.json({ data: assignment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/officers/:id
router.delete('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.ACP), async (req, res) => {
  try {
    const officer = await _models.Officer.findByIdAndDelete(req.params.id);
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }
    await _models.SectorOfficer.deleteMany({ officerId: req.params.id });
    res.json({ data: { message: 'Officer deleted' } });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to delete officer' });
  }
});

// GET /api/officers/:id/performance
router.get('/:id/performance', _auth.authenticate, async (req, res) => {
  try {
    const violations = await _models.Violation.aggregate([
      { $match: { officerId: req.params.id } },
      { $group: { _id: '$violationType', count: { $sum: 1 } } },
    ]);
    res.json({ data: violations });
  } catch (e5) {
    res.status(500).json({ error: 'Failed to get performance' });
  }
});

exports. default = router;
