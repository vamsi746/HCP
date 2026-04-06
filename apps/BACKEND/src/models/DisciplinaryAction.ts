import mongoose, { Schema } from 'mongoose';

export enum ActionType {
  COUNSELING = 'COUNSELING', WARNING = 'WARNING', SHOW_CAUSE = 'SHOW_CAUSE',
  ENQUIRY = 'ENQUIRY', SUSPENSION = 'SUSPENSION',
  COMMENDATION = 'COMMENDATION', TRANSFER_RECOMMENDATION = 'TRANSFER_RECOMMENDATION',
}

export enum ActionStatus {
  PENDING = 'PENDING', ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESPONDED = 'RESPONDED', CLOSED = 'CLOSED', APPEALED = 'APPEALED',
}

const disciplinaryActionSchema = new Schema(
  {
    officerId: { type: Schema.Types.ObjectId, ref: 'Officer', required: true },
    violationId: { type: Schema.Types.ObjectId, ref: 'Violation' },
    actionType: { type: String, enum: Object.values(ActionType), required: true },
    actionNumber: { type: Number, default: 1 },
    documentUrl: String,
    issuedBy: { type: Schema.Types.ObjectId, ref: 'Officer', required: true },
    issuedAt: { type: Date, default: Date.now },
    responseDeadline: Date,
    responseReceived: String,
    status: { type: String, enum: Object.values(ActionStatus), default: ActionStatus.PENDING },
  },
  { timestamps: true }
);

disciplinaryActionSchema.index({ officerId: 1, issuedAt: 1 });
disciplinaryActionSchema.index({ actionType: 1 });
disciplinaryActionSchema.index({ status: 1 });

export const DisciplinaryAction = mongoose.model('DisciplinaryAction', disciplinaryActionSchema);
