import mongoose, { Schema } from 'mongoose';

export enum MemoStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  ON_HOLD = 'ON_HOLD',
  REJECTED = 'REJECTED',
}

const memoSchema = new Schema(
  {
    // Link to DSR case
    dsrId: { type: Schema.Types.ObjectId, ref: 'DSR', required: true },
    caseId: { type: String, required: true }, // parsedCase _id within DSR

    // Memo fields
    memoNumber: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    subject: { type: String, default: '' },
    reference: { type: String, default: '' },
    content: { type: String, default: '' }, // Full HTML from rich text editor

    // Crime details (snapshot from DSR case)
    crimeNo: String,
    sections: String,
    policeStation: String,
    psId: { type: Schema.Types.ObjectId, ref: 'PoliceStation' },
    zone: String,
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    briefFacts: String,

    // Workflow status
    status: {
      type: String,
      enum: Object.values(MemoStatus),
      default: MemoStatus.DRAFT,
    },

    // Recipient (filled by CP Sir during review)
    recipientType: { type: String, enum: ['SI', 'SHO', ''], default: '' },
    recipientId: { type: Schema.Types.ObjectId, ref: 'Officer' },
    recipientName: String,
    recipientDesignation: String,
    recipientPS: String,

    // Copy recipients
    copyTo: [
      {
        designation: String,
        name: String,
        unit: String,
      },
    ],

    // Audit trail
    generatedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    generatedAt: Date,
    reviewedAt: Date,
    approvedAt: Date,

    remarks: String,
  },
  { timestamps: true }
);

memoSchema.index({ status: 1 });
memoSchema.index({ dsrId: 1 });
memoSchema.index({ generatedBy: 1 });
memoSchema.index({ status: 1, zoneId: 1, createdAt: -1 });
memoSchema.index({ status: 1, psId: 1, createdAt: -1 });
memoSchema.index({ status: 1, date: -1 });
memoSchema.index({ zoneId: 1, psId: 1, status: 1, createdAt: -1 });
memoSchema.index({ dsrId: 1, status: 1 });
memoSchema.index({ caseId: 1 });

export const Memo = mongoose.model('Memo', memoSchema);
