"use strict";Object.defineProperty(exports, "__esModule", {value: true});
var _models = require('../models');

const rankHierarchy = {
  [_models.OfficerRank.CONSTABLE]: 1,
  [_models.OfficerRank.HEAD_CONSTABLE]: 2,
  [_models.OfficerRank.ASI]: 3,
  [_models.OfficerRank.PSI]: 4,
  [_models.OfficerRank.SI]: 5,
  [_models.OfficerRank.WSI]: 6,
  [_models.OfficerRank.CI]: 7,
  [_models.OfficerRank.ACP]: 8,
  [_models.OfficerRank.DCP]: 9,
  [_models.OfficerRank.ADDL_CP]: 10,
  [_models.OfficerRank.COMMISSIONER]: 11,
};

exports.rankHierarchy = rankHierarchy;

 const requireMinRank = (minRank) => {
  return (req, res, next) => {
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
}; exports.requireMinRank = requireMinRank;
