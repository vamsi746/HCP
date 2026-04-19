"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _express = require('express');
var _models = require('../models');
var _auth = require('../middleware/auth');
var _rbac = require('../middleware/rbac');
var _escalation = require('../services/escalation');

const router = _express.Router.call(void 0, );

// GET /api/cases
router.get('/', _auth.authenticate, async (req, res) => {
  try {
    const { policeStationId, crimeType, handledBy, isMissedBySI, startDate, endDate, page = '1', limit = '20' } = req.query;
    const filter = {};
    if (policeStationId) filter.policeStationId = policeStationId;
    if (crimeType) filter.crimeType = crimeType;
    if (handledBy) filter.handledBy = handledBy;
    if (isMissedBySI !== undefined) filter.isMissedBySI = isMissedBySI === 'true';
    if (startDate || endDate) {
      filter.caseDate = {};
      if (startDate) filter.caseDate.$gte = new Date(startDate );
      if (endDate) filter.caseDate.$lte = new Date(endDate );
    }

    const skip = (parseInt(page ) - 1) * parseInt(limit );
    const [cases, total] = await Promise.all([
      _models.Case.find(filter).populate('policeStationId', 'name code').skip(skip).limit(parseInt(limit )).sort({ caseDate: -1 }).lean(),
      _models.Case.countDocuments(filter),
    ]);

    res.json({ data: cases, pagination: { page: parseInt(page ), limit: parseInt(limit ), total } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// GET /api/cases/stats/by-crime-type
router.get('/stats/by-crime-type', _auth.authenticate, async (_req, res) => {
  try {
    const stats = await _models.Case.aggregate([
      { $group: { _id: '$crimeType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data: stats });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/cases/stats/by-handler
router.get('/stats/by-handler', _auth.authenticate, async (_req, res) => {
  try {
    const stats = await _models.Case.aggregate([
      { $group: { _id: '$handledBy', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ data: stats });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/cases/stats/daily-trend
router.get('/stats/daily-trend', _auth.authenticate, async (req, res) => {
  try {
    const days = parseInt((req.query.days ) || '30');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stats = await _models.Case.aggregate([
      { $match: { caseDate: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$caseDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ data: stats });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to get trend' });
  }
});

// GET /api/cases/:id
router.get('/:id', _auth.authenticate, async (req, res) => {
  try {
    const c = await _models.Case.findById(req.params.id).populate('policeStationId dsrId').lean();
    if (!c) { res.status(404).json({ error: 'Case not found' }); return; }
    res.json({ data: c });
  } catch (e5) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// POST /api/cases — log a new incident (task force detection triggers auto-escalation)
router.post('/', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.SI), async (req, res) => {
  try {
    const caseDoc = await _models.Case.create({
      ...req.body,
      caseDate: req.body.caseDate || new Date(),
    });

    // If handled by task force → auto-trigger violation & warning for responsible SIs
    if (['TASK_FORCE', 'SIT', 'SOT', 'ANTI_VICE'].includes(caseDoc.handledBy)) {
      await _escalation.checkMissedAction.call(void 0, caseDoc);
    }

    const populated = await _models.Case.findById(caseDoc._id).populate('policeStationId', 'name code').lean();
    res.status(201).json({ data: populated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/cases/:id
router.put('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.SI), async (req, res) => {
  try {
    const allowedFields = ['crimeType', 'crimeNo', 'policeStationId', 'caseDate', 'description', 'handledBy', 'isMissedBySI', 'status'];
    const safeUpdate = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) safeUpdate[key] = req.body[key]; }
    const c = await _models.Case.findByIdAndUpdate(req.params.id, safeUpdate, { new: true }).populate('policeStationId', 'name code');
    if (!c) { res.status(404).json({ error: 'Case not found' }); return; }
    res.json({ data: c });
  } catch (e6) {
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// DELETE /api/cases/:id
router.delete('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const c = await _models.Case.findByIdAndDelete(req.params.id);
    if (!c) { res.status(404).json({ error: 'Case not found' }); return; }
    res.json({ success: true });
  } catch (e7) {
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

exports. default = router;
