"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _express = require('express');
var _models = require('../models');
var _auth = require('../middleware/auth');
var _rbac = require('../middleware/rbac');
var _config = require('../config');

const router = _express.Router.call(void 0, );

// GET /api/appeals
router.get('/', _auth.authenticate, async (req, res) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page ) - 1) * parseInt(limit );
    const [appeals, total] = await Promise.all([
      _models.Appeal.find(filter)
        .populate('officerId', 'name badgeNumber rank')
        .populate('violationId')
        .populate('reviewedBy', 'name badgeNumber')
        .skip(skip).limit(parseInt(limit )).sort({ submittedAt: -1 }).lean(),
      _models.Appeal.countDocuments(filter),
    ]);

    res.json({ data: appeals, pagination: { page: parseInt(page ), limit: parseInt(limit ), total } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch appeals' });
  }
});

// POST /api/appeals
router.post('/', _auth.authenticate, async (req, res) => {
  try {
    const slaDeadline = new Date(Date.now() + _config.config.appealSlaDays * 24 * 60 * 60 * 1000);
    const appeal = await _models.Appeal.create({
      ...req.body,
      officerId: req.user.id,
      slaDeadline,
    });
    res.status(201).json({ data: appeal });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/appeals/:id/review
router.patch('/:id/review', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const { status, reviewComment } = req.body;
    const appeal = await _models.Appeal.findByIdAndUpdate(req.params.id, {
      status, reviewComment,
      reviewedBy: req.user.id,
      resolvedAt: [_models.AppealStatus.APPROVED, _models.AppealStatus.REJECTED].includes(status) ? new Date() : undefined,
    }, { new: true });
    if (!appeal) { res.status(404).json({ error: 'Appeal not found' }); return; }
    res.json({ data: appeal });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to review appeal' });
  }
});

// PUT /api/appeals/:id
router.put('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const allowedFields = ['reason', 'status', 'reviewComment'];
    const safeUpdate = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) safeUpdate[key] = req.body[key]; }
    const appeal = await _models.Appeal.findByIdAndUpdate(req.params.id, safeUpdate, { new: true })
      .populate('officerId', 'name badgeNumber rank');
    if (!appeal) { res.status(404).json({ error: 'Appeal not found' }); return; }
    res.json({ data: appeal });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to update appeal' });
  }
});

// DELETE /api/appeals/:id
router.delete('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const appeal = await _models.Appeal.findByIdAndDelete(req.params.id);
    if (!appeal) { res.status(404).json({ error: 'Appeal not found' }); return; }
    res.json({ success: true });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to delete appeal' });
  }
});

exports. default = router;
