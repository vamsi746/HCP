"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }
var _jsonwebtoken = require('jsonwebtoken'); var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);
var _config = require('../config');
var _models = require('../models');

















 const authenticate = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (_optionalChain([authHeader, 'optionalAccess', _ => _.startsWith, 'call', _2 => _2('Bearer ')])) {
      token = authHeader.substring(7);
    } else if (_optionalChain([req, 'access', _3 => _3.cookies, 'optionalAccess', _4 => _4.accessToken])) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = _jsonwebtoken2.default.verify(token, _config.config.jwt.secret) ;
    const officer = await _models.Officer.findById(decoded.id).select('badgeNumber name rank email systemRole isActive').lean();

    if (!officer || !officer.isActive) {
      res.status(401).json({ error: 'Invalid or inactive account' });
      return;
    }

    req.user = {
      id: officer._id.toString(),
      badgeNumber: officer.badgeNumber,
      name: officer.name,
      rank: officer.rank,
      email: officer.email,
      systemRole: officer.systemRole,
    };

    next();
  } catch (error) {
    if (error instanceof _jsonwebtoken2.default.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}; exports.authenticate = authenticate;

 const generateTokens = (user) => {
  const accessToken = _jsonwebtoken2.default.sign(
    { id: user.id, badgeNumber: user.badgeNumber, name: user.name, rank: user.rank, email: user.email, systemRole: user.systemRole },
    _config.config.jwt.secret,
    { expiresIn: _config.config.jwt.expiresIn } 
  );
  const refreshToken = _jsonwebtoken2.default.sign(
    { id: user.id },
    _config.config.jwt.refreshSecret,
    { expiresIn: _config.config.jwt.refreshExpiresIn } 
  );
  return { accessToken, refreshToken };
}; exports.generateTokens = generateTokens;
