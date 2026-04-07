import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shield_hcp',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  rateLimit: {
    windowMs: 60 * 1000,
    max: 100,
  },

  coolingPeriodDays: 180,
  appealSlaDays: 14,
};
