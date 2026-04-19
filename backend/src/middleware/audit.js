"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _models = require('../models');

 async function createAuditLog(data








) {
  try {
    await _models.AuditLog.create(data);
  } catch (e) {
    // Audit log failure should not block operations
  }
} exports.createAuditLog = createAuditLog;
