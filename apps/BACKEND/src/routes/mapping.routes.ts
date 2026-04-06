import { Router, Request, Response } from 'express';
import { Zone, Division, Circle, PoliceStation, Sector, SectorOfficer, DisciplinaryAction } from '../models';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/mapping/hierarchy  – full hierarchy with officers
router.get('/hierarchy', authenticate, async (_req: Request, res: Response) => {
  try {
    const [zones, divisions, circles, stations, sectors, assignments] = await Promise.all([
      Zone.find().lean(),
      Division.find().lean(),
      Circle.find().lean(),
      PoliceStation.find().lean(),
      Sector.find().lean(),
      SectorOfficer.find({ isActive: true }).populate('officerId', 'name badgeNumber rank phone isActive recruitmentType batch remarks').lean(),
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
                        .map((a) => ({ ...(a.officerId as any), role: a.role })),
                    })),
                })),
            })),
        })),
    }));

    res.json({ data: hierarchy });
  } catch {
    res.status(500).json({ error: 'Failed to get mapping' });
  }
});

// GET /api/mapping/officer-warnings — warning count per officer
router.get('/officer-warnings', authenticate, async (_req: Request, res: Response) => {
  try {
    const warnings = await DisciplinaryAction.aggregate([
      { $group: { _id: '$officerId', warningCount: { $sum: 1 }, lastAction: { $max: '$issuedAt' } } },
      { $lookup: { from: 'officers', localField: '_id', foreignField: '_id', as: 'officer' } },
      { $unwind: '$officer' },
      { $project: { warningCount: 1, lastAction: 1, 'officer.name': 1, 'officer.badgeNumber': 1, 'officer.rank': 1 } },
      { $sort: { warningCount: -1 } },
    ]);
    res.json({ data: warnings });
  } catch {
    res.status(500).json({ error: 'Failed to get warnings' });
  }
});

// GET /api/mapping/gis  – stations with coordinates for map
router.get('/gis', authenticate, async (_req: Request, res: Response) => {
  try {
    const stations = await PoliceStation.find().lean();
    res.json({ data: stations });
  } catch {
    res.status(500).json({ error: 'Failed to get GIS data' });
  }
});

export default router;
