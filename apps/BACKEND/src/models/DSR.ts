import mongoose, { Schema } from 'mongoose';

export enum DSRStatus {
  PENDING = 'PENDING', PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED', FAILED = 'FAILED', MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum ForceType {
  CHARMINAR_GOLCONDA = 'CHARMINAR_GOLCONDA',
  RAJENDRANAGAR_SHAMSHABAD = 'RAJENDRANAGAR_SHAMSHABAD',
  KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS = 'KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS',
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
    policeStation: String, // raw name from document
    sector: String, // e.g. 'Sector 1', 'Sector 2'
    socialViceType: String, // e.g. 'Gambling', 'Narcotics', 'None'
    actionTakenBy: String, // e.g. 'Task Force', 'H-Fast', 'H-New'
    natureOfCase: String, // crime head with sub-details
    crNo: String,
    sections: String,
    dor: String,
    psWithCrDetails: String, // full PS + Cr.No + sections + DOR block
    accusedParticulars: String, // full "Type of Work and Accused Particulars" text
    seizedProperty: String,
    seizedWorth: String,
    numAccused: Number,
    numCases: Number,
    abscondingAccused: Number,
    // Legacy / enriched fields
    crimeHead: String,
    accusedDetails: String,
    briefFacts: String,
    // Extracted locations from text
    extractedLocations: [extractedLocationSchema],
    // Matched references
    matchedPSId: { type: Schema.Types.ObjectId, ref: 'PoliceStation' },
    matchedZoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    matchedSectorId: { type: Schema.Types.ObjectId, ref: 'Sector' },
    matchedOfficerId: { type: Schema.Types.ObjectId, ref: 'Officer' },
    matchedSHOId: { type: Schema.Types.ObjectId, ref: 'Officer' },
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
    raidedBy: String, // Force that conducted the raid, selected during upload
    fileName: String,
    fileType: String,
    filePath: String, // path to original uploaded file on disk
    rawText: String,
    documentHtml: String, // full HTML conversion of the original document
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
