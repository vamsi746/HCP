"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _express = require('express');
var _models = require('../models');
var _auth = require('../middleware/auth');
var _rbac = require('../middleware/rbac');
var _documentgen = require('../services/document-gen');

const router = _express.Router.call(void 0, );

// GET /api/actions
router.get('/', _auth.authenticate, async (req, res) => {
  try {
    const { officerId, actionType, status, page = '1', limit = '20' } = req.query;
    const filter = {};
    if (officerId) filter.officerId = officerId;
    if (actionType) filter.actionType = actionType;
    if (status) filter.status = status;

    const skip = (parseInt(page ) - 1) * parseInt(limit );
    const [actions, total] = await Promise.all([
      _models.DisciplinaryAction.find(filter)
        .populate('officerId', 'name badgeNumber rank')
        .populate('violationId')
        .populate('issuedBy', 'name badgeNumber')
        .skip(skip).limit(parseInt(limit )).sort({ issuedAt: -1 }).lean(),
      _models.DisciplinaryAction.countDocuments(filter),
    ]);

    res.json({ data: actions, pagination: { page: parseInt(page ), limit: parseInt(limit ), total } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

// POST /api/actions
router.post('/', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const action = await _models.DisciplinaryAction.create({ ...req.body, issuedBy: req.user.id });
    const populated = await _models.DisciplinaryAction.findById(action._id)
      .populate('officerId', 'name badgeNumber rank')
      .populate('violationId');

    if (populated) {
      const docUrl = await _documentgen.generateDocument.call(void 0, populated);
      populated.documentUrl = docUrl;
      await populated.save();
    }

    res.status(201).json({ data: populated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/actions/:id/acknowledge
router.patch('/:id/acknowledge', _auth.authenticate, async (req, res) => {
  try {
    const action = await _models.DisciplinaryAction.findByIdAndUpdate(req.params.id, { status: 'ACKNOWLEDGED' }, { new: true });
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ data: action });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
});

// PATCH /api/actions/:id/respond
router.patch('/:id/respond', _auth.authenticate, async (req, res) => {
  try {
    const action = await _models.DisciplinaryAction.findByIdAndUpdate(req.params.id, {
      status: 'RESPONDED', responseReceived: req.body.response,
    }, { new: true });
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ data: action });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// PATCH /api/actions/:id/close
router.patch('/:id/close', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const action = await _models.DisciplinaryAction.findByIdAndUpdate(req.params.id, { status: 'CLOSED' }, { new: true });
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ data: action });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to close' });
  }
});

// PUT /api/actions/:id
router.put('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const allowedFields = ['actionType', 'reason', 'remarks', 'status'];
    const safeUpdate = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) safeUpdate[key] = req.body[key]; }
    const action = await _models.DisciplinaryAction.findByIdAndUpdate(req.params.id, safeUpdate, { new: true })
      .populate('officerId', 'name badgeNumber rank');
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ data: action });
  } catch (e5) {
    res.status(500).json({ error: 'Failed to update action' });
  }
});

// DELETE /api/actions/:id
router.delete('/:id', _auth.authenticate, _rbac.requireMinRank.call(void 0, _models.OfficerRank.CI), async (req, res) => {
  try {
    const action = await _models.DisciplinaryAction.findByIdAndDelete(req.params.id);
    if (!action) { res.status(404).json({ error: 'Action not found' }); return; }
    res.json({ success: true });
  } catch (e6) {
    res.status(500).json({ error: 'Failed to delete action' });
  }
});

exports. default = router;
