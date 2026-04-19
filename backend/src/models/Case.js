"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

var CrimeType; (function (CrimeType) {
  const BETTING = 'BETTING'; CrimeType["BETTING"] = BETTING; const GAMBLING = 'GAMBLING'; CrimeType["GAMBLING"] = GAMBLING; const ONLINE_BETTING = 'ONLINE_BETTING'; CrimeType["ONLINE_BETTING"] = ONLINE_BETTING;
  const PROSTITUTION = 'PROSTITUTION'; CrimeType["PROSTITUTION"] = PROSTITUTION;
  const SOCIAL_MEDIA = 'SOCIAL_MEDIA'; CrimeType["SOCIAL_MEDIA"] = SOCIAL_MEDIA; const NDPS_PETTY = 'NDPS_PETTY'; CrimeType["NDPS_PETTY"] = NDPS_PETTY; const NDPS_MAJOR = 'NDPS_MAJOR'; CrimeType["NDPS_MAJOR"] = NDPS_MAJOR;
  const MURDER = 'MURDER'; CrimeType["MURDER"] = MURDER; const ROBBERY = 'ROBBERY'; CrimeType["ROBBERY"] = ROBBERY; const THEFT = 'THEFT'; CrimeType["THEFT"] = THEFT; const ASSAULT = 'ASSAULT'; CrimeType["ASSAULT"] = ASSAULT;
  const ROWDY_SHEET = 'ROWDY_SHEET'; CrimeType["ROWDY_SHEET"] = ROWDY_SHEET; const MISSING_PERSON = 'MISSING_PERSON'; CrimeType["MISSING_PERSON"] = MISSING_PERSON; const CYBER_FRAUD = 'CYBER_FRAUD'; CrimeType["CYBER_FRAUD"] = CYBER_FRAUD;
  const ILLICIT_LIQUOR = 'ILLICIT_LIQUOR'; CrimeType["ILLICIT_LIQUOR"] = ILLICIT_LIQUOR; const PROPERTY_OFFENCE = 'PROPERTY_OFFENCE'; CrimeType["PROPERTY_OFFENCE"] = PROPERTY_OFFENCE;
  const BURGLARY = 'BURGLARY'; CrimeType["BURGLARY"] = BURGLARY; const CHAIN_SNATCHING = 'CHAIN_SNATCHING'; CrimeType["CHAIN_SNATCHING"] = CHAIN_SNATCHING; const VEHICLE_THEFT = 'VEHICLE_THEFT'; CrimeType["VEHICLE_THEFT"] = VEHICLE_THEFT;
  const CHEATING = 'CHEATING'; CrimeType["CHEATING"] = CHEATING; const KIDNAPPING = 'KIDNAPPING'; CrimeType["KIDNAPPING"] = KIDNAPPING; const DOWRY_DEATH = 'DOWRY_DEATH'; CrimeType["DOWRY_DEATH"] = DOWRY_DEATH;
  const SEXUAL_ASSAULT = 'SEXUAL_ASSAULT'; CrimeType["SEXUAL_ASSAULT"] = SEXUAL_ASSAULT; const EVE_TEASING = 'EVE_TEASING'; CrimeType["EVE_TEASING"] = EVE_TEASING;
  const ATTEMPT_MURDER = 'ATTEMPT_MURDER'; CrimeType["ATTEMPT_MURDER"] = ATTEMPT_MURDER; const ARMS_ACT = 'ARMS_ACT'; CrimeType["ARMS_ACT"] = ARMS_ACT; const OTHER = 'OTHER'; CrimeType["OTHER"] = OTHER;
})(CrimeType || (exports.CrimeType = CrimeType = {}));

var HandlerType; (function (HandlerType) {
  const SECTOR_SI = 'SECTOR_SI'; HandlerType["SECTOR_SI"] = SECTOR_SI; const TASK_FORCE = 'TASK_FORCE'; HandlerType["TASK_FORCE"] = TASK_FORCE; const SIT = 'SIT'; HandlerType["SIT"] = SIT;
  const SOT = 'SOT'; HandlerType["SOT"] = SOT; const ANTI_VICE = 'ANTI_VICE'; HandlerType["ANTI_VICE"] = ANTI_VICE; const CYBER_CELL = 'CYBER_CELL'; HandlerType["CYBER_CELL"] = CYBER_CELL;
  const SPECIAL_BRANCH = 'SPECIAL_BRANCH'; HandlerType["SPECIAL_BRANCH"] = SPECIAL_BRANCH;
})(HandlerType || (exports.HandlerType = HandlerType = {}));

const caseSchema = new (0, _mongoose.Schema)(
  {
    dsrId: { type: _mongoose.Schema.Types.ObjectId, ref: 'DSR' },
    policeStationId: { type: _mongoose.Schema.Types.ObjectId, ref: 'PoliceStation' },
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
    accusedDetails: [_mongoose.Schema.Types.Mixed],
    victimDetails: [_mongoose.Schema.Types.Mixed],
    seizureDetails: _mongoose.Schema.Types.Mixed,
    propertyValue: Number,
    location: String,
  },
  { timestamps: true }
);

caseSchema.index({ policeStationId: 1, caseDate: -1 });
caseSchema.index({ crimeType: 1, caseDate: -1 });
caseSchema.index({ handledBy: 1, caseDate: -1 });
caseSchema.index({ isMissedBySI: 1 });
caseSchema.index({ dsrId: 1 });

 const Case = _mongoose2.default.model('Case', caseSchema); exports.Case = Case;
