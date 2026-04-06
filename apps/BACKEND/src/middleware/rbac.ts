import { Request, Response, NextFunction } from 'express';
import { OfficerRank } from '../models';

const rankHierarchy: Record<string, number> = {
  [OfficerRank.CONSTABLE]: 1,
  [OfficerRank.HEAD_CONSTABLE]: 2,
  [OfficerRank.ASI]: 3,
  [OfficerRank.SI]: 4,
  [OfficerRank.CI]: 5,
  [OfficerRank.ACP]: 6,
  [OfficerRank.DCP]: 7,
  [OfficerRank.ADDL_CP]: 8,
  [OfficerRank.COMMISSIONER]: 9,
};

export { rankHierarchy };

export const requireMinRank = (minRank: OfficerRank) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const userLevel = rankHierarchy[req.user.rank] || 0;
    const requiredLevel = rankHierarchy[minRank] || 0;
    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Insufficient rank' });
      return;
    }
    next();
  };
};
