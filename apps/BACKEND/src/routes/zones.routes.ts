import { Router, Request, Response } from 'express';
import { Zone, Division, Circle, PoliceStation, Sector } from '../models';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/zones
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const zones = await Zone.find().lean();
    res.json({ data: zones });
  } catch {
    res.status(500).json({ error: 'Failed to get zones' });
  }
});

// GET /api/zones/hierarchy
router.get('/hierarchy', authenticate, async (_req: Request, res: Response) => {
  try {
    const zones = await Zone.find().lean();
    const divisions = await Division.find().lean();
    const circles = await Circle.find().lean();
    const stations = await PoliceStation.find().lean();
    const sectors = await Sector.find().lean();

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
  } catch {
    res.status(500).json({ error: 'Failed to get hierarchy' });
  }
});

// POST /api/zones
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const zone = await Zone.create(req.body);
    res.status(201).json({ data: zone });
  } catch {
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

// POST /api/zones/divisions
router.post('/divisions', authenticate, async (req: Request, res: Response) => {
  try {
    const division = await Division.create(req.body);
    res.status(201).json({ data: division });
  } catch {
    res.status(500).json({ error: 'Failed to create division' });
  }
});

// POST /api/zones/circles
router.post('/circles', authenticate, async (req: Request, res: Response) => {
  try {
    const circle = await Circle.create(req.body);
    res.status(201).json({ data: circle });
  } catch {
    res.status(500).json({ error: 'Failed to create circle' });
  }
});

// POST /api/zones/stations
router.post('/stations', authenticate, async (req: Request, res: Response) => {
  try {
    const station = await PoliceStation.create(req.body);
    res.status(201).json({ data: station });
  } catch {
    res.status(500).json({ error: 'Failed to create station' });
  }
});

// POST /api/zones/sectors
router.post('/sectors', authenticate, async (req: Request, res: Response) => {
  try {
    const sector = await Sector.create(req.body);
    res.status(201).json({ data: sector });
  } catch {
    res.status(500).json({ error: 'Failed to create sector' });
  }
});

// GET /api/zones/stations — flat list for dropdowns
router.get('/stations', authenticate, async (_req: Request, res: Response) => {
  try {
    const stations = await PoliceStation.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ data: stations });
  } catch {
    res.status(500).json({ error: 'Failed to get stations' });
  }
});

export default router;
