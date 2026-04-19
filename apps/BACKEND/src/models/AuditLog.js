"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

const auditLogSchema = new (0, _mongoose.Schema)(
  {
    officerId: String,
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    oldValue: _mongoose.Schema.Types.Mixed,
    newValue: _mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 3600 });
auditLogSchema.index({ officerId: 1, timestamp: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

 const AuditLog = _mongoose2.default.model('AuditLog', auditLogSchema); exports.AuditLog = AuditLog;
