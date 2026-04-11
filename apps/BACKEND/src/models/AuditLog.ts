import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema(
  {
    officerId: String,
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 3600 });
auditLogSchema.index({ officerId: 1, timestamp: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
