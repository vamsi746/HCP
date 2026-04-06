import mongoose, { Schema } from 'mongoose';

export enum ViolationType {
  MISSED_ACTION = 'MISSED_ACTION',
  INACTIVE_SI = 'INACTIVE_SI',
  DEFECTIVE_REGISTRATION = 'DEFECTIVE_REGISTRATION',
  SUPERVISION_FAILURE = 'SUPERVISION_FAILURE',
  INSUBORDINATION = 'INSUBORDINATION',
}

export enum Severity {
  LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL',
}

const violationSchema = new Schema(
  {
    officerId: { type: Schema.Types.ObjectId, ref: 'Officer', required: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case' },
    violationType: { type: String, enum: Object.values(ViolationType), required: true },
    severity: { type: String, enum: Object.values(Severity), required: true },
    date: { type: Date, required: true },
    description: String,
    isExempted: { type: Boolean, default: false },
    exemptionReason: String,
    exemptedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    coolingResetDate: Date,
  },
  { timestamps: true }
);

violationSchema.index({ officerId: 1, date: 1 });
violationSchema.index({ violationType: 1 });
violationSchema.index({ date: 1 });

export const Violation = mongoose.model('Violation', violationSchema);
