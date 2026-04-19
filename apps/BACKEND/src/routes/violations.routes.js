"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express');
var _models = require('../models');
var _auth = require('../middleware/auth');
var _rbac = require('../middleware/rbac');


const router = _express.Router.call(void 0, );

// GET /api/violations
router.get('/', _auth.authenticate, async (req, res) => {
  try {
    const { officerId, violationType, severity, isExempted, page = '1', limit = '20' } = req.query;
    const filter = {};
    if (officerId) filter.officerId = officerId;
    if (violationType) filter.violationType = violationType;
    if (severity) filter.severity = severity;
    if (isExempted !== undefined) filter.isExempted = isExempted === 'true';

    const skip = (parseInt(page ) - 1) * parseInt(limit );
    const [violations, total] = await Promise.all([
      _models.Violation.find(filter).populate('officerId', 'name badgeNumber rank').populate('caseId', 'crimeType firNumber')
        .skip(skip).limit(parseInt(limit )).sort({ date: -1 }).lean(),
      _models.Violation.countDocuments(filter),
    ]);

    res.json({ data: violations, pagination: { page: parseInt(page ), limit: parseInt(limit ), total } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch violations' });
  }
});

// POST /api/violations/:id/exempt
router.post('/:id/exempt', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const violation = await _models.Violation.findByIdAndUpdate(req.params.id, {
      isExempted: true,
      exemptionReason: req.body.reason,
      exemptedBy: req.user.id,
    }, { new: true });
    if (!violation) { res.status(404).json({ error: 'Violation not found' }); return; }
    res.json({ data: violation });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to exempt violation' });
  }
});

// GET /api/violations/stats/by-officer
router.get('/stats/by-officer', _auth.authenticate, async (_req, res) => {
  try {
    const stats = await _models.Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$officerId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { count: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
    ]);
    res.json({ data: stats });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// PUT /api/violations/:id
router.put('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const allowedFields = ['violationType', 'description', 'date', 'severity', 'remarks'];
    const safeUpdate = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) safeUpdate[key] = req.body[key]; }
    const violation = await _models.Violation.findByIdAndUpdate(req.params.id, safeUpdate, { new: true }).populate('officerId', 'name badgeNumber rank');
    if (!violation) { res.status(404).json({ error: 'Violation not found' }); return; }
    res.json({ data: violation });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to update violation' });
  }
});

// DELETE /api/violations/:id
router.delete('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const violation = await _models.Violation.findByIdAndDelete(req.params.id);
    if (!violation) { res.status(404).json({ error: 'Violation not found' }); return; }
    res.json({ success: true });
  } catch (e5) {
    res.status(500).json({ error: 'Failed to delete violation' });
  }
});

// GET /api/violations/stats/by-zone
router.get('/stats/by-zone', _auth.authenticate, async (_req, res) => {
  try {
    const stats = await _models.Violation.aggregate([
      { $match: { isExempted: false } },
      { $group: { _id: '$violationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data: stats });
  } catch (e6) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

exports. default = router;
