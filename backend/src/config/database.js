"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
var _logger = require('./logger'); var _logger2 = _interopRequireDefault(_logger);
var _index = require('./index');

 async function connectDB() {
  try {
    await _mongoose2.default.connect(_index.config.mongodb.uri);
    _logger2.default.info('MongoDB connected successfully');
  } catch (error) {
    _logger2.default.error('MongoDB connection error:', error);
    process.exit(1);
  }
} exports.connectDB = connectDB;
