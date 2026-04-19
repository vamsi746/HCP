"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

var OfficerRank; (function (OfficerRank) {
  const CONSTABLE = 'CONSTABLE'; OfficerRank["CONSTABLE"] = CONSTABLE;
  const HEAD_CONSTABLE = 'HEAD_CONSTABLE'; OfficerRank["HEAD_CONSTABLE"] = HEAD_CONSTABLE;
  const ASI = 'ASI'; OfficerRank["ASI"] = ASI;
  const PSI = 'PSI'; OfficerRank["PSI"] = PSI;
  const SI = 'SI'; OfficerRank["SI"] = SI;
  const WSI = 'WSI'; OfficerRank["WSI"] = WSI;
  const CI = 'CI'; OfficerRank["CI"] = CI;
  const ACP = 'ACP'; OfficerRank["ACP"] = ACP;
  const DCP = 'DCP'; OfficerRank["DCP"] = DCP;
  const ADDL_CP = 'ADDL_CP'; OfficerRank["ADDL_CP"] = ADDL_CP;
  const COMMISSIONER = 'COMMISSIONER'; OfficerRank["COMMISSIONER"] = COMMISSIONER;
})(OfficerRank || (exports.OfficerRank = OfficerRank = {}));


















const officerSchema = new _mongoose.Schema(
  {
    badgeNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    rank: { type: String, enum: Object.values(OfficerRank), required: true },
    email: { type: String, unique: true, sparse: true },
    phone: String,
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    recruitmentType: { type: String, enum: ['DIRECT', 'RANKER'] },
    batch: Number,
    remarks: String,
    joiningDate: Date,
    lastLogin: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true }
);

officerSchema.index({ rank: 1 });
officerSchema.index({ isActive: 1 });
officerSchema.index({ rank: 1, isActive: 1 });

 const Officer = _mongoose2.default.model('Officer', officerSchema); exports.Officer = Officer;

// Sector Officer assignment
const sectorOfficerSchema = new (0, _mongoose.Schema)(
  {
    sectorId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Sector', required: true },
    officerId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    role: { type: String, enum: ['PRIMARY_SI', 'RELIEF_SI', 'CI_OVERSIGHT'], required: true },
    isActive: { type: Boolean, default: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sectorOfficerSchema.index({ sectorId: 1, role: 1, isActive: 1 });
sectorOfficerSchema.index({ officerId: 1 });
sectorOfficerSchema.index({ isActive: 1, officerId: 1 });

 const SectorOfficer = _mongoose2.default.model('SectorOfficer', sectorOfficerSchema); exports.SectorOfficer = SectorOfficer;

// Officer Leave
const officerLeaveSchema = new (0, _mongoose.Schema)(
  {
    officerId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: String,
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    reliefSIId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
  },
  { timestamps: true }
);

 const OfficerLeave = _mongoose2.default.model('OfficerLeave', officerLeaveSchema); exports.OfficerLeave = OfficerLeave;
