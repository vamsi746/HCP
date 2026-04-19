"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

var AppealStatus; (function (AppealStatus) {
  const SUBMITTED = 'SUBMITTED'; AppealStatus["SUBMITTED"] = SUBMITTED; const UNDER_REVIEW = 'UNDER_REVIEW'; AppealStatus["UNDER_REVIEW"] = UNDER_REVIEW;
  const APPROVED = 'APPROVED'; AppealStatus["APPROVED"] = APPROVED; const REJECTED = 'REJECTED'; AppealStatus["REJECTED"] = REJECTED; const ESCALATED = 'ESCALATED'; AppealStatus["ESCALATED"] = ESCALATED;
})(AppealStatus || (exports.AppealStatus = AppealStatus = {}));

const appealSchema = new (0, _mongoose.Schema)(
  {
    officerId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    violationId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Violation', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: Object.values(AppealStatus), default: AppealStatus.SUBMITTED },
    reviewedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    reviewComment: String,
    escalationLevel: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    slaDeadline: Date,
  },
  { timestamps: true }
);

appealSchema.index({ officerId: 1 });
appealSchema.index({ status: 1 });
appealSchema.index({ slaDeadline: 1 });
appealSchema.index({ status: 1, slaDeadline: 1 });

 const Appeal = _mongoose2.default.model('Appeal', appealSchema); exports.Appeal = Appeal;
