"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _express = require('express');
var _models = require('../models');
var _auth = require('../middleware/auth');

const router = _express.Router.call(void 0, );

// GET /api/mapping/hierarchy  – full hierarchy with officers
router.get('/hierarchy', _auth.authenticate, async (_req, res) => {
  try {
    const [zones, divisions, circles, stations, sectors, assignments] = await Promise.all([
      _models.Zone.find().lean(),
      _models.Division.find().lean(),
      _models.Circle.find().lean(),
      _models.PoliceStation.find().lean(),
      _models.Sector.find().lean(),
      _models.SectorOfficer.find({ isActive: true }).populate('officerId', 'name badgeNumber rank phone isActive recruitmentType batch remarks').lean(),
    ]);

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
                  sectors: sectors
                    .filter((sec) => String(sec.policeStationId) === String(station._id))
                    .map((sec) => ({
                      ...sec,
                      officers: assignments
                        .filter((a) => String(a.sectorId) === String(sec._id))
                        .map((a) => ({ ...(a.officerId ), role: a.role })),
                    })),
                })),
            })),
        })),
    }));

    res.json({ data: hierarchy });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get mapping' });
  }
});

// GET /api/mapping/officer-warnings — warning count per officer
router.get('/officer-warnings', _auth.authenticate, async (_req, res) => {
  try {
    const warnings = await _models.DisciplinaryAction.aggregate([
      { $group: { _id: '$officerId', warningCount: { $sum: 1 }, lastAction: { $max: '$issuedAt' } } },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { warningCount: 1, lastAction: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
      { $sort: { warningCount: -1 } },
    ]);
    res.json({ data: warnings });
  } catch (e2) {
    res.status(500).json({ error: 'Failed to get warnings' });
  }
});

// GET /api/mapping/gis  – stations with coordinates for map
router.get('/gis', _auth.authenticate, async (_req, res) => {
  try {
    const stations = await _models.PoliceStation.find().lean();
    res.json({ data: stations });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to get GIS data' });
  }
});

exports. default = router;
