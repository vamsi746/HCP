import mongoose, { Schema } from 'mongoose';

export enum DSRStatus {
  PENDING = 'PENDING', PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED', FAILED = 'FAILED', MANUAL_REVIEW = 'MANUAL_REVIEW',
}

const dsrSchema = new Schema(
  {
    date: { type: Date, required: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    policeStationId: { type: Schema.Types.ObjectId, ref: 'PoliceStation' },
    fileName: String,
    fileType: String,
    rawText: String,
    parsedData: Schema.Types.Mixed,
    processingStatus: { type: String, enum: Object.values(DSRStatus), default: DSRStatus.PENDING },
    qualityScore: { type: Number, min: 0, max: 100 },
    missingFields: [String],
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    processedAt: Date,
  },
  { timestamps: true }
);

dsrSchema.index({ date: 1 });
dsrSchema.index({ processingStatus: 1 });
dsrSchema.index({ zoneId: 1, date: 1 });

export const DSR = mongoose.model('DSR', dsrSchema);
