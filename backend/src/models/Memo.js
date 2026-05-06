"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

var MemoStatus; (function (MemoStatus) {
  const DRAFT = 'DRAFT'; MemoStatus["DRAFT"] = DRAFT;
  const PENDING_REVIEW = 'PENDING_REVIEW'; MemoStatus["PENDING_REVIEW"] = PENDING_REVIEW;
  const REVIEWED = 'REVIEWED'; MemoStatus["REVIEWED"] = REVIEWED;
  const APPROVED = 'APPROVED'; MemoStatus["APPROVED"] = APPROVED;
  const SENT = 'SENT'; MemoStatus["SENT"] = SENT;
  const ON_HOLD = 'ON_HOLD'; MemoStatus["ON_HOLD"] = ON_HOLD;
  const REJECTED = 'REJECTED'; MemoStatus["REJECTED"] = REJECTED;
})(MemoStatus || (exports.MemoStatus = MemoStatus = {}));

const memoSchema = new (0, _mongoose.Schema)(
  {
    // Link to DSR case (optional for charge memos)
    dsrId: { type: _mongoose.Schema.Types.ObjectId, ref: 'DSR' },
    caseId: { type: String }, // parsedCase _id within DSR

    // Memo type: WARNING (default) or CHARGE
    memoType: { type: String, enum: ['WARNING', 'CHARGE'], default: 'WARNING' },

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
    psId: { type: _mongoose.Schema.Types.ObjectId, ref: 'PoliceStation' },
    zone: String,
    zoneId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    sector: String,
    briefFacts: String,

    // Workflow status
    status: {
      type: String,
      enum: Object.values(MemoStatus),
      default: MemoStatus.DRAFT,
    },

    // Recipient (filled by CP Sir during review)
    recipientType: { type: String, enum: ['SI', 'SHO', ''], default: '' },
    recipientId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
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
    generatedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    reviewedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    approvedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    generatedAt: Date,
    reviewedAt: Date,
    approvedAt: Date,

    remarks: String,

    // Compliance tracking (for approved/sent memos)
    complianceStatus: {
      type: String,
      enum: ['AWAITING_REPLY', 'COMPLIED'],
    },
    complianceRemarks: String,
    complianceDocumentPath: String,
    complianceDocumentName: String,
    compliedAt: Date,
    compliedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
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
memoSchema.index({ complianceStatus: 1, status: 1 });
memoSchema.index({ recipientId: 1, status: 1 });
memoSchema.index({ recipientId: 1, status: 1, date: 1 });
memoSchema.index({ date: -1 });
memoSchema.index({ status: 1, complianceStatus: 1, createdAt: -1 });
memoSchema.index({ approvedAt: -1 });
memoSchema.index({ zoneId: 1, date: -1 });
memoSchema.index({ recipientType: 1, status: 1, date: -1 });
memoSchema.index({ caseId: 1, status: 1 });
memoSchema.index({ zone: 1, date: -1 });

 const Memo = _mongoose2.default.model('Memo', memoSchema); exports.Memo = Memo;
