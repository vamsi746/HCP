"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _express = require('express');
var _models = require('../models');
var _auth = require('../middleware/auth');

const router = _express.Router.call(void 0, );

// GET /api/zones
router.get('/', _auth.authenticate, async (_req, res) => {
  try {
    const zones = await _models.Zone.find().lean();
    res.json({ data: zones });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get zones' });
  }
});

// GET /api/zones/hierarchy
router.get('/hierarchy', _auth.authenticate, async (_req, res) => {
  try {
    const zones = await _models.Zone.find().lean();
    const divisions = await _models.Division.find().lean();
    const circles = await _models.Circle.find().lean();
    const stations = await _models.PoliceStation.find().lean();
    const sectors = await _models.Sector.find().lean();

    const hierarchy = zones.map((zone) => ({
      ...zone,
      divisions: divisions
        .filter((d) => String(d.zoneId) === String(zone._id))
        .map((div) => ({
          ...div,
          circles: circles
            .filter((c) => String(c.divisionId) === String(div._id))
            .map((circle) => ({
              ...circle,
              stations: stations
                .filter((s) => String(s.circleId) === String(circle._id))
                .map((station) => ({
                  ...station,
                  sectors: sectors.filter((sec) => String(sec.policeStationId) === String(station._id)),
                })),
            })),
        })),
    }));

    res.json({ data: hierarchy });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to get hierarchy' });
  }
});

// POST /api/zones
router.post('/', _auth.authenticate, async (req, res) => {
  try {
    const zone = await _models.Zone.create(req.body);
    res.status(201).json({ data: zone });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

// POST /api/zones/divisions
router.post('/divisions', _auth.authenticate, async (req, res) => {
  try {
    const division = await _models.Division.create(req.body);
    res.status(201).json({ data: division });
  } catch (e4) {
    res.status(500).json({ error: 'Failed to create division' });
  }
});

// POST /api/zones/circles
router.post('/circles', _auth.authenticate, async (req, res) => {
  try {
    const circle = await _models.Circle.create(req.body);
    res.status(201).json({ data: circle });
  } catch (e5) {
    res.status(500).json({ error: 'Failed to create circle' });
  }
});

// POST /api/zones/stations
router.post('/stations', _auth.authenticate, async (req, res) => {
  try {
    const station = await _models.PoliceStation.create(req.body);
    res.status(201).json({ data: station });
  } catch (e6) {
    res.status(500).json({ error: 'Failed to create station' });
  }
});

// POST /api/zones/sectors
router.post('/sectors', _auth.authenticate, async (req, res) => {
  try {
    const sector = await _models.Sector.create(req.body);
    res.status(201).json({ data: sector });
  } catch (e7) {
    res.status(500).json({ error: 'Failed to create sector' });
  }
});

// GET /api/zones/stations — flat list for dropdowns
router.get('/stations', _auth.authenticate, async (_req, res) => {
  try {
    const stations = await _models.PoliceStation.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ data: stations });
  } catch (e8) {
    res.status(500).json({ error: 'Failed to get stations' });
  }
});

exports. default = router;
