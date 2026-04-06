import mongoose, { Schema } from 'mongoose';

export enum CrimeType {
  BETTING = 'BETTING', GAMBLING = 'GAMBLING', ONLINE_BETTING = 'ONLINE_BETTING',
  PROSTITUTION = 'PROSTITUTION',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA', NDPS_PETTY = 'NDPS_PETTY', NDPS_MAJOR = 'NDPS_MAJOR',
  MURDER = 'MURDER', ROBBERY = 'ROBBERY', THEFT = 'THEFT', ASSAULT = 'ASSAULT',
  ROWDY_SHEET = 'ROWDY_SHEET', MISSING_PERSON = 'MISSING_PERSON', CYBER_FRAUD = 'CYBER_FRAUD',
  ILLICIT_LIQUOR = 'ILLICIT_LIQUOR', PROPERTY_OFFENCE = 'PROPERTY_OFFENCE',
  BURGLARY = 'BURGLARY', CHAIN_SNATCHING = 'CHAIN_SNATCHING', VEHICLE_THEFT = 'VEHICLE_THEFT',
  CHEATING = 'CHEATING', KIDNAPPING = 'KIDNAPPING', DOWRY_DEATH = 'DOWRY_DEATH',
  SEXUAL_ASSAULT = 'SEXUAL_ASSAULT', EVE_TEASING = 'EVE_TEASING',
  ATTEMPT_MURDER = 'ATTEMPT_MURDER', ARMS_ACT = 'ARMS_ACT', OTHER = 'OTHER',
}

export enum HandlerType {
  SECTOR_SI = 'SECTOR_SI', TASK_FORCE = 'TASK_FORCE', SIT = 'SIT',
  SOT = 'SOT', ANTI_VICE = 'ANTI_VICE', CYBER_CELL = 'CYBER_CELL',
  SPECIAL_BRANCH = 'SPECIAL_BRANCH',
}

const caseSchema = new Schema(
  {
    dsrId: { type: Schema.Types.ObjectId, ref: 'DSR' },
    policeStationId: { type: Schema.Types.ObjectId, ref: 'PoliceStation' },
    caseDate: { type: Date, required: true },
    firNumber: String,
    crimeType: { type: String, enum: Object.values(CrimeType), required: true },
    crimeSubType: String,
    bnsSections: [String],
    description: String,
    handledBy: { type: String, enum: Object.values(HandlerType), default: HandlerType.SECTOR_SI },
    taskForceUnit: String,
    isMissedBySI: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
    adminReviewed: { type: Boolean, default: false },
    accusedCount: { type: Number, default: 0 },
    arrestCount: { type: Number, default: 0 },
    accusedDetails: [Schema.Types.Mixed],
    victimDetails: [Schema.Types.Mixed],
    seizureDetails: Schema.Types.Mixed,
    propertyValue: Number,
    location: String,
  },
  { timestamps: true }
);

caseSchema.index({ policeStationId: 1, caseDate: 1 });
caseSchema.index({ crimeType: 1 });
caseSchema.index({ handledBy: 1 });
caseSchema.index({ isMissedBySI: 1 });

export const Case = mongoose.model('Case', caseSchema);
