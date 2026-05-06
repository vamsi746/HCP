"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _express = require('express');
var _bcryptjs = require('bcryptjs'); var _bcryptjs2 = _interopRequireDefault(_bcryptjs);
var _jsonwebtoken = require('jsonwebtoken'); var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);
var _joi = require('joi'); var _joi2 = _interopRequireDefault(_joi);
var _models = require('../models');
var _auth = require('../middleware/auth');
var _rateLimiter = require('../middleware/rateLimiter');
var _validate = require('../middleware/validate');
var _audit = require('../middleware/audit');
var _config = require('../config');

const router = _express.Router.call(void 0, );

const loginSchema = _joi2.default.object({
  email: _joi2.default.string().email().required(),
  password: _joi2.default.string().required(),
});

// POST /api/auth/login
router.post('/login', _validate.validate.call(void 0, loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const officer = await _models.Officer.findOne({ email, isActive: true });
    if (!officer) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    if (officer.lockedUntil && officer.lockedUntil > new Date()) {
      res.status(423).json({ error: 'Account locked. Try again later.' });
      return;
    }

    const valid = await _bcryptjs2.default.compare(password, officer.passwordHash);
    if (!valid) {
      officer.failedLoginAttempts += 1;
      if (officer.failedLoginAttempts >= 5) {
        officer.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      await officer.save();
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    officer.failedLoginAttempts = 0;
    officer.lockedUntil = undefined;
    officer.lastLogin = new Date();
    await officer.save();

    const user = {
      id: officer._id.toString(),
      badgeNumber: officer.badgeNumber,
      name: officer.name,
      rank: officer.rank,
      email: officer.email,
      systemRole: officer.systemRole,
    };

    const tokens = _auth.generateTokens.call(void 0, user);

    const isProduction = _config.config.env === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none'  : 'lax' ,
    };

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOpts, maxAge: 8 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOpts, path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await _audit.createAuditLog.call(void 0, {
      officerId: officer._id.toString(), action: 'LOGIN_SUCCESS',
      entity: 'Officer', entityId: officer._id.toString(),
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });

    res.json({ data: { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  const isProduction = _config.config.env === 'production';
  const cookieOpts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none'  : 'lax' ,
  };
  res.clearCookie('accessToken', cookieOpts);
  res.clearCookie('refreshToken', { ...cookieOpts, path: '/api/auth' });
  res.json({ data: { message: 'Logged out' } });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = _optionalChain([req, 'access', _ => _.cookies, 'optionalAccess', _2 => _2.refreshToken]) || req.body.refreshToken;
    if (!refreshToken) { res.status(400).json({ error: 'Refresh token required' }); return; }

    const decoded = _jsonwebtoken2.default.verify(refreshToken, _config.config.jwt.refreshSecret) ;
    const officer = await _models.Officer.findById(decoded.id).select('badgeNumber name rank email systemRole isActive').lean();
    if (!officer || !officer.isActive) { res.status(401).json({ error: 'Invalid refresh token' }); return; }

    const user = {
      id: officer._id.toString(), badgeNumber: officer.badgeNumber,
      name: officer.name, rank: officer.rank, email: officer.email,
      systemRole: officer.systemRole,
    };
    const tokens = _auth.generateTokens.call(void 0, user);

    const isProduction = _config.config.env === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none'  : 'lax' ,
    };

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOpts, maxAge: 8 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOpts, path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ data: { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } });
  } catch (e2) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', _auth.authenticate, (req, res) => {
  res.json({ data: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', _auth.authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const officer = await _models.Officer.findById(req.user.id);
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }

    const valid = await _bcryptjs2.default.compare(currentPassword, officer.passwordHash);
    if (!valid) { res.status(400).json({ error: 'Current password incorrect' }); return; }

    officer.passwordHash = await _bcryptjs2.default.hash(newPassword, 12);
    await officer.save();
    res.json({ data: { message: 'Password changed' } });
  } catch (e3) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

exports. default = router;
