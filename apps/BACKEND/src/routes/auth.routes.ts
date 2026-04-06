import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { Officer } from '../models';
import { authenticate, generateTokens, AuthUser } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { createAuditLog } from '../middleware/audit';
import { config } from '../config';

const router = Router();

const loginSchema = Joi.object({
  badgeNumber: Joi.string().required(),
  password: Joi.string().required(),
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { badgeNumber, password } = req.body;
    const officer = await Officer.findOne({ badgeNumber, isActive: true });
    if (!officer) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    if (officer.lockedUntil && officer.lockedUntil > new Date()) {
      res.status(423).json({ error: 'Account locked. Try again later.' });
      return;
    }

    const valid = await bcrypt.compare(password, officer.passwordHash);
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

    const user: AuthUser = {
      id: officer._id.toString(),
      badgeNumber: officer.badgeNumber,
      name: officer.name,
      rank: officer.rank,
      email: officer.email,
    };

    const tokens = generateTokens(user);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true, secure: config.env === 'production', sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: config.env === 'production', sameSite: 'lax',
      path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await createAuditLog({
      officerId: officer._id.toString(), action: 'LOGIN_SUCCESS',
      entity: 'Officer', entityId: officer._id.toString(),
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });

    res.json({ data: { user } });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ data: { message: 'Logged out' } });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) { res.status(400).json({ error: 'Refresh token required' }); return; }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { id: string };
    const officer = await Officer.findById(decoded.id).select('badgeNumber name rank email isActive').lean();
    if (!officer || !officer.isActive) { res.status(401).json({ error: 'Invalid refresh token' }); return; }

    const user: AuthUser = {
      id: officer._id.toString(), badgeNumber: officer.badgeNumber,
      name: officer.name, rank: officer.rank, email: officer.email,
    };
    const tokens = generateTokens(user);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true, secure: config.env === 'production', sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: config.env === 'production', sameSite: 'lax',
      path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ data: { user } });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ data: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const officer = await Officer.findById(req.user!.id);
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }

    const valid = await bcrypt.compare(currentPassword, officer.passwordHash);
    if (!valid) { res.status(400).json({ error: 'Current password incorrect' }); return; }

    officer.passwordHash = await bcrypt.hash(newPassword, 12);
    await officer.save();
    res.json({ data: { message: 'Password changed' } });
  } catch {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
