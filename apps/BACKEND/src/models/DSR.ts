import mongoose, { Schema } from 'mongoose';

export enum DSRStatus {
  PENDING = 'PENDING', PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED', FAILED = 'FAILED', MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum ForceType {
  TASK_FORCE = 'TASK_FORCE',
  H_FAST = 'H_FAST',
  H_NEW = 'H_NEW',
}

// A single extracted location from case text
const extractedLocationSchema = new Schema(
  {
    type: { type: String, enum: ['ps_reference', 'residential', 'incident_area'] },
    rawText: String,
    psName: String,
  },
  { _id: false }
);

// A single parsed case from a DSR document
const parsedCaseSchema = new Schema(
  {
    slNo: Number,
    zone: String,
    crimeHead: String,
    policeStation: String, // raw name from document
    crNo: String,
    sections: String,
    dor: String,
    accusedDetails: String,
    briefFacts: String,
    seizedProperty: String,
    seizedWorth: String,
    numAccused: Number,
    numCases: Number,
    abscondingAccused: String,
    // Extracted locations from text
    extractedLocations: [extractedLocationSchema],
    // Matched references
    matchedPSId: { type: Schema.Types.ObjectId, ref: 'PoliceStation' },
    matchedZoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    matchedOfficerId: { type: Schema.Types.ObjectId, ref: 'Officer' },
    // Warning status
    warningGenerated: { type: Boolean, default: false },
    warningId: { type: Schema.Types.ObjectId, ref: 'DisciplinaryAction' },
  },
  { _id: true }
);

const dsrSchema = new Schema(
  {
    date: { type: Date, required: true },
    forceType: { type: String, enum: Object.values(ForceType), required: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    policeStationId: { type: Schema.Types.ObjectId, ref: 'PoliceStation' },
    fileName: String,
    fileType: String,
    rawText: String,
    parsedCases: [parsedCaseSchema],
    parsedData: Schema.Types.Mixed,
    processingStatus: { type: String, enum: Object.values(DSRStatus), default: DSRStatus.PENDING },
    qualityScore: { type: Number, min: 0, max: 100 },
    missingFields: [String],
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    processedAt: Date,
    totalCases: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dsrSchema.index({ date: 1 });
dsrSchema.index({ forceType: 1 });
dsrSchema.index({ processingStatus: 1 });
dsrSchema.index({ zoneId: 1, date: 1 });

export const DSR = mongoose.model('DSR', dsrSchema);
