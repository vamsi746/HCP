"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _logger = require('../config/logger'); var _logger2 = _interopRequireDefault(_logger);

 class AppError extends Error {
  
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
} exports.AppError = AppError;

 const errorHandler = (err, _req, res, _next) => {
  _logger2.default.error(err.message, { stack: err.stack });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message });
    return;
  }

  if ((err ).code === 11000) {
    res.status(409).json({ error: 'Duplicate entry' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}; exports.errorHandler = errorHandler;
