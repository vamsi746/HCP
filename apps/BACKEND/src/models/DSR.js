"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

var DSRStatus; (function (DSRStatus) {
  const PENDING = 'PENDING'; DSRStatus["PENDING"] = PENDING; const PROCESSING = 'PROCESSING'; DSRStatus["PROCESSING"] = PROCESSING;
  const COMPLETED = 'COMPLETED'; DSRStatus["COMPLETED"] = COMPLETED; const FAILED = 'FAILED'; DSRStatus["FAILED"] = FAILED; const MANUAL_REVIEW = 'MANUAL_REVIEW'; DSRStatus["MANUAL_REVIEW"] = MANUAL_REVIEW;
})(DSRStatus || (exports.DSRStatus = DSRStatus = {}));

var ForceType; (function (ForceType) {
  const CHARMINAR_GOLCONDA = 'CHARMINAR_GOLCONDA'; ForceType["CHARMINAR_GOLCONDA"] = CHARMINAR_GOLCONDA;
  const RAJENDRANAGAR_SHAMSHABAD = 'RAJENDRANAGAR_SHAMSHABAD'; ForceType["RAJENDRANAGAR_SHAMSHABAD"] = RAJENDRANAGAR_SHAMSHABAD;
  const KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS = 'KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS'; ForceType["KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS"] = KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS;
})(ForceType || (exports.ForceType = ForceType = {}));

var DSRCategory; (function (DSRCategory) {
  const SPECIAL_WINGS = 'SPECIAL_WINGS'; DSRCategory["SPECIAL_WINGS"] = SPECIAL_WINGS;
  const NORMAL = 'NORMAL'; DSRCategory["NORMAL"] = NORMAL;
})(DSRCategory || (exports.DSRCategory = DSRCategory = {}));

// A single extracted location from case text
const extractedLocationSchema = new (0, _mongoose.Schema)(
  {
    type: { type: String, enum: ['ps_reference', 'residential', 'incident_area'] },
    rawText: String,
    psName: String,
  },
  { _id: false }
);

// A single parsed case from a DSR document
const parsedCaseSchema = new (0, _mongoose.Schema)(
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
    matchedPSId: { type: _mongoose.Schema.Types.ObjectId, ref: 'PoliceStation' },
    matchedZoneId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    matchedSectorId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Sector' },
    matchedOfficerId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    matchedSHOId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    // Warning status
    warningGenerated: { type: Boolean, default: false },
    warningId: { type: _mongoose.Schema.Types.ObjectId, ref: 'DisciplinaryAction' },
  },
  { _id: true }
);

const dsrSchema = new (0, _mongoose.Schema)(
  {
    date: { type: Date, required: true },
    dsrCategory: { type: String, enum: Object.values(DSRCategory), default: DSRCategory.SPECIAL_WINGS },
    forceType: { type: String, enum: Object.values(ForceType) },
    zoneId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    policeStationId: { type: _mongoose.Schema.Types.ObjectId, ref: 'PoliceStation' },
    raidedBy: String, // Force that conducted the raid, selected during upload
    fileName: String,
    fileType: String,
    filePath: String, // path to original uploaded file on disk
    rawText: String,
    documentHtml: String, // full HTML conversion of the original document
    parsedCases: [parsedCaseSchema],
    parsedData: _mongoose.Schema.Types.Mixed,
    processingStatus: { type: String, enum: Object.values(DSRStatus), default: DSRStatus.PENDING },
    qualityScore: { type: Number, min: 0, max: 100 },
    missingFields: [String],
    uploadedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    processedAt: Date,
    totalCases: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dsrSchema.index({ date: -1 });
dsrSchema.index({ forceType: 1 });
dsrSchema.index({ processingStatus: 1 });
dsrSchema.index({ zoneId: 1, date: -1 });
dsrSchema.index({ processingStatus: 1, date: -1 });
dsrSchema.index({ forceType: 1, date: -1 });
dsrSchema.index({ forceType: 1, processingStatus: 1, date: -1 });
dsrSchema.index({ dsrCategory: 1, date: -1 });

 const DSR = _mongoose2.default.model('DSR', dsrSchema); exports.DSR = DSR;
