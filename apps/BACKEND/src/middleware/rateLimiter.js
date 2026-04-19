"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _expressratelimit = require('express-rate-limit'); var _expressratelimit2 = _interopRequireDefault(_expressratelimit);

 const apiLimiter = _expressratelimit2.default.call(void 0, { windowMs: 60 * 1000, max: 100 }); exports.apiLimiter = apiLimiter;
 const authLimiter = _expressratelimit2.default.call(void 0, { windowMs: 15 * 60 * 1000, max: 10 }); exports.authLimiter = authLimiter;
