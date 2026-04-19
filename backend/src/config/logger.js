"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _winston = require('winston'); var _winston2 = _interopRequireDefault(_winston);

const logger = _winston2.default.createLogger({
  level: 'info',
  format: _winston2.default.format.combine(
    _winston2.default.format.timestamp(),
    _winston2.default.format.json(),
  ),
  defaultMeta: { service: 'shield-api' },
  transports: [
    new _winston2.default.transports.Console({
      format: _winston2.default.format.combine(
        _winston2.default.format.colorize(),
        _winston2.default.format.simple(),
      ),
    }),
  ],
});

exports.logger = logger;
exports. default = logger;
