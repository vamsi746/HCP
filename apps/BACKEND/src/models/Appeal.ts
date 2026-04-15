import mongoose, { Schema } from 'mongoose';

export enum AppealStatus {
  SUBMITTED = 'SUBMITTED', UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED', REJECTED = 'REJECTED', ESCALATED = 'ESCALATED',
}

const appealSchema = new Schema(
  {
    officerId: { type: Schema.Types.ObjectId, ref: 'Officer', required: true },
    violationId: { type: Schema.Types.ObjectId, ref: 'Violation', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: Object.values(AppealStatus), default: AppealStatus.SUBMITTED },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    reviewComment: String,
    escalationLevel: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    slaDeadline: Date,
  },
  { timestamps: true }
);

appealSchema.index({ officerId: 1 });
appealSchema.index({ status: 1 });
appealSchema.index({ slaDeadline: 1 });
appealSchema.index({ status: 1, slaDeadline: 1 });

export const Appeal = mongoose.model('Appeal', appealSchema);
