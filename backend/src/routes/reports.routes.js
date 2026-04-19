"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _express = require('express');
var _models = require('../models');
var _auth = require('../middleware/auth');

const router = _express.Router.call(void 0, );

// GET /api/reports/dashboard
router.get('/dashboard', _auth.authenticate, async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeOfficers, totalSIs, dsrsToday, activeViolations, pendingActions, totalCases, missedCases, totalWarnings, totalSuspensions, taskForceIncidents] = await Promise.all([
      _models.Officer.countDocuments({ isActive: true }),
      _models.Officer.countDocuments({ isActive: true, rank: 'SI' }),
      _models.DSR.countDocuments({ date: { $gte: today } }),
      _models.Violation.countDocuments({ isExempted: false }),
      _models.DisciplinaryAction.countDocuments({ status: 'PENDING' }),
      _models.Case.countDocuments(),
      _models.Case.countDocuments({ isMissedBySI: true }),
      _models.DisciplinaryAction.countDocuments({ actionType: 'WARNING' }),
      _models.DisciplinaryAction.countDocuments({ actionType: 'SUSPENSION' }),
      _models.Case.countDocuments({ handledBy: { $in: ['TASK_FORCE', 'SIT', 'SOT', 'ANTI_VICE'] } }),
    ]);

    res.json({
      data: { activeOfficers, totalSIs, dsrsToday, activeViolations, pendingActions, totalCases, missedCases, totalWarnings, totalSuspensions, taskForceIncidents },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// GET /api/reports/bottom-performers
router.get('/bottom-performers', _auth.authenticate, async (_req, res) => {
  try {
    const data = await _models.Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$officerId', violationCount: { $sum: 1 } } },
      { $sort: { violationCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { violationCount: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
    ]);
    res.json({ data });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to get performers' });
  }
});

// GET /api/reports/top-performers
router.get('/top-performers', _auth.authenticate, async (_req, res) => {
  try {
    const data = await _models.DisciplinaryAction.aggregate([
      { $match: { actionType: 'COMMENDATION' } },
      { $group: { _id: '$officerId', commendations: { $sum: 1 } } },
      { $sort: { commendations: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { commendations: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
    ]);
    res.json({ data });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to get performers' });
  }
});

// GET /api/reports/zone-comparison
router.get('/zone-comparison', _auth.authenticate, async (_req, res) => {
  try {
    const data = await _models.Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$violationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to get comparison' });
  }
});

// GET /api/reports/dashboard-analytics — Full analytics dashboard data
// Returns KPIs, zone breakdown, social vice breakdown, role breakdown,
// compliance trend, and charge-memo officers.
router.get('/dashboard-analytics', _auth.authenticate, async (req, res) => {
  try {
    const { dateFrom, dateTo, zoneId } = req.query ;

    const baseFilter = {};
    if (zoneId) baseFilter.zoneId = zoneId;
    if (dateFrom || dateTo) {
      baseFilter.date = {};
      if (dateFrom) baseFilter.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        baseFilter.date.$lte = end;
      }
    }

    // ─── 1. Status counts (KPIs) ────────────────────────────────────
    const statusAgg = await _models.Memo.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusCounts = {};
    for (const r of statusAgg) statusCounts[r._id] = r.count;

    const totalMemos = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const pendingReview =
      (statusCounts.PENDING_REVIEW || 0) +
      (statusCounts.REVIEWED || 0) +
      (statusCounts.ON_HOLD || 0);
    const approved = (statusCounts.APPROVED || 0) + (statusCounts.SENT || 0);
    const drafts = statusCounts.DRAFT || 0;
    const rejected = statusCounts.REJECTED || 0;

    // ─── 2. Compliance counts (only APPROVED/SENT memos) ────────────
    const issuedFilter = { ...baseFilter, status: { $in: ['APPROVED', 'SENT'] } };
    const complianceAgg = await _models.Memo.aggregate([
      { $match: issuedFilter },
      { $group: { _id: { $ifNull: ['$complianceStatus', 'AWAITING_REPLY'] }, count: { $sum: 1 } } },
    ]);
    let complied = 0;
    let awaiting = 0;
    for (const r of complianceAgg) {
      if (r._id === 'COMPLIED') complied = r.count;
      else awaiting += r.count;
    }

    // ─── 3. Zone-wise breakdown ─────────────────────────────────────
    const zoneAgg = await _models.Memo.aggregate([
      { $match: issuedFilter },
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ['$zone', null] }, { $eq: ['$zone', ''] }] },
              'Unknown',
              { $concat: ['$zone', ' Zone'] },
            ],
          },
          memos: { $sum: 1 },
          complied: {
            $sum: { $cond: [{ $eq: ['$complianceStatus', 'COMPLIED'] }, 1, 0] },
          },
          awaiting: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ['$complianceStatus', 'AWAITING_REPLY'] }, { $eq: ['$complianceStatus', null] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { memos: -1 } },
    ]);
    const ALL_ZONES = (await _models.Zone.find().select('name').lean()).map((z) => z.name + ' Zone');
    const zoneMap = new Map();
    ALL_ZONES.forEach((z) => zoneMap.set(z, { memos: 0, complied: 0, awaiting: 0 }));
    zoneAgg.forEach((z) => {
      const name = z._id || 'Unknown';
      const existing = zoneMap.get(name);
      if (existing) {
        zoneMap.set(name, { memos: z.memos, complied: z.complied, awaiting: z.awaiting });
      } else {
        zoneMap.set(name, { memos: z.memos, complied: z.complied, awaiting: z.awaiting });
      }
    });
    const zoneBreakdown = Array.from(zoneMap.entries()).map(([zone, stats]) => ({
      zone,
      memos: stats.memos,
      complied: stats.complied,
      awaiting: stats.awaiting,
    }));

    // ─── 4. Officer role breakdown (SI vs SHO) ──────────────────────
    const roleAgg = await _models.Memo.aggregate([
      { $match: issuedFilter },
      {
        $group: {
          _id: { $ifNull: ['$recipientType', 'UNASSIGNED'] },
          count: { $sum: 1 },
        },
      },
    ]);
    const roleBreakdown = roleAgg.map((r) => ({
      role: r._id || 'UNASSIGNED',
      count: r.count,
    }));

    // ─── 5. Social vice breakdown (via DSR.parsedCases join) ────────
    const viceAgg = await _models.Memo.aggregate([
      { $match: issuedFilter },
      {
        $lookup: {
          from: 'dsrs',
          let: { dsrId: '$dsrId', caseId: '$caseId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$dsrId'] } } },
            { $unwind: '$parsedCases' },
            { $match: { $expr: { $eq: [{ $toString: '$parsedCases._id' }, '$$caseId'] } } },
            {
              $project: {
                socialViceType: '$parsedCases.socialViceType',
                natureOfCase: '$parsedCases.natureOfCase',
              },
            },
          ],
          as: 'caseMatch',
        },
      },
      { $unwind: { path: '$caseMatch', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          category: {
            $let: {
              vars: {
                raw: {
                  $toLower: {
                    $ifNull: [
                      '$caseMatch.socialViceType',
                      { $ifNull: ['$caseMatch.natureOfCase', 'Other'] },
                    ],
                  },
                },
              },
              in: {
                $switch: {
                  branches: [
                    { case: { $regexMatch: { input: '$$raw', regex: 'peta|animal|cruelty' } }, then: 'Peta' },
                    { case: { $regexMatch: { input: '$$raw', regex: 'gambl|betting|matka' } }, then: 'Gambling' },
                    { case: { $regexMatch: { input: '$$raw', regex: 'food|adulterat|edible|oil' } }, then: 'Food Adulteration' },
                    { case: { $regexMatch: { input: '$$raw', regex: 'cross.*mess|pamphlet|poster|propag' } }, then: 'Cross Message' },
                    { case: { $regexMatch: { input: '$$raw', regex: 'hookah|shisha|hukka' } }, then: 'Hookah Centers' },
                    { case: { $regexMatch: { input: '$$raw', regex: 'ndps|ganja|drug|narcotic' } }, then: 'Narcotics' },
                  ],
                  default: 'Other',
                },
              },
            },
          },
        },
      },
      { $group: { _id: '$category', memos: { $sum: 1 } } },
      { $sort: { memos: -1 } },
    ]);
    const socialViceBreakdown = (() => {
      const ALL_CATEGORIES = ['Peta', 'Gambling', 'Food Adulteration', 'Cross Message', 'Hookah Centers', 'Narcotics'];
      const map = new Map();
      ALL_CATEGORIES.forEach((c) => map.set(c, 0));
      viceAgg.forEach((v) => {
        const existing = map.get(v._id);
        if (existing !== undefined) map.set(v._id, existing + v.memos);
        else map.set(v._id, v.memos); // 'Other' or unexpected
      });
      return Array.from(map.entries()).map(([category, memos]) => ({ category, memos }));
    })();

    // ─── 6. Compliance trend (last 30 days) ─────────────────────────
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 29);
    trendStart.setHours(0, 0, 0, 0);

    const trendAgg = await _models.Memo.aggregate([
      {
        $match: {
          ...(zoneId ? { zoneId } : {}),
          status: { $in: ['APPROVED', 'SENT'] },
          approvedAt: { $gte: trendStart },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$approvedAt' } },
          issued: { $sum: 1 },
          complied: {
            $sum: { $cond: [{ $eq: ['$complianceStatus', 'COMPLIED'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing days with zeros
    const trendMap = new Map();
    for (const r of trendAgg) trendMap.set(r._id, { issued: r.issued, complied: r.complied });
    const complianceTrend = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(trendStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const v = trendMap.get(key) || { issued: 0, complied: 0 };
      complianceTrend.push({ date: key, issued: v.issued, complied: v.complied });
    }

    // ─── 7. Charge memo officers (memoCount >= 3) ───────────────────
    const chargeAgg = await _models.Memo.aggregate([
      { $match: { ...issuedFilter, recipientId: { $ne: null } } },
      {
        $group: {
          _id: '$recipientId',
          memoCount: { $sum: 1 },
          latestMemoAt: { $max: '$approvedAt' },
          zone: { $last: '$zone' },
          policeStation: { $last: '$policeStation' },
        },
      },
      { $match: { memoCount: { $gte: 3 } } },
      { $sort: { memoCount: -1, latestMemoAt: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'officers',
          localField: '_id',
          foreignField: '_id',
          as: 'officer',
        },
      },
      { $unwind: { path: '$officer', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          officerId: '$_id',
          _id: 0,
          memoCount: 1,
          latestMemoAt: 1,
          zone: 1,
          policeStation: 1,
          name: '$officer.name',
          badgeNumber: '$officer.badgeNumber',
          rank: '$officer.rank',
        },
      },
    ]);
    const chargeMemoOfficers = chargeAgg;
    const chargeMemoDue = chargeAgg.length;

    res.json({
      data: {
        kpi: {
          totalMemos,
          pendingReview,
          approved,
          complied,
          awaiting,
          chargeMemoDue,
          drafts,
          rejected,
        },
        statusCounts,
        zoneBreakdown,
        roleBreakdown,
        socialViceBreakdown,
        complianceTrend,
        chargeMemoOfficers,
      },
    });
  } catch (err) {
    console.error('[REPORTS] dashboard-analytics failed:', _optionalChain([err, 'optionalAccess', _ => _.message]) || err);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

exports. default = router;
