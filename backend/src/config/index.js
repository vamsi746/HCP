"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _dotenv = require('dotenv'); var _dotenv2 = _interopRequireDefault(_dotenv);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
_dotenv2.default.config({ path: _path2.default.resolve(__dirname, '../../.env') });

 const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3001',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shield_hcp',
  },

  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'dev-jwt-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_REFRESH_SECRET must be set in production'); })() : 'dev-refresh-secret'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  rateLimit: {
    windowMs: 60 * 1000,
    max: 100,
  },

  coolingPeriodDays: 180,
  appealSlaDays: 14,
}; exports.config = config;
