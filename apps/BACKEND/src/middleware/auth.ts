import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Officer, OfficerRank } from '../models';

export interface AuthUser {
  id: string;
  badgeNumber: string;
  name: string;
  rank: OfficerRank;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as AuthUser;
    const officer = await Officer.findById(decoded.id).select('badgeNumber name rank email isActive').lean();

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
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const generateTokens = (user: AuthUser) => {
  const accessToken = jwt.sign(
    { id: user.id, badgeNumber: user.badgeNumber, name: user.name, rank: user.rank, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as string }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn as string }
  );
  return { accessToken, refreshToken };
};
