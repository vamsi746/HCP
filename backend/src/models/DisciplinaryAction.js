"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

var ActionType; (function (ActionType) {
  const COUNSELING = 'COUNSELING'; ActionType["COUNSELING"] = COUNSELING; const WARNING = 'WARNING'; ActionType["WARNING"] = WARNING; const SHOW_CAUSE = 'SHOW_CAUSE'; ActionType["SHOW_CAUSE"] = SHOW_CAUSE;
  const ENQUIRY = 'ENQUIRY'; ActionType["ENQUIRY"] = ENQUIRY; const SUSPENSION = 'SUSPENSION'; ActionType["SUSPENSION"] = SUSPENSION;
  const COMMENDATION = 'COMMENDATION'; ActionType["COMMENDATION"] = COMMENDATION; const TRANSFER_RECOMMENDATION = 'TRANSFER_RECOMMENDATION'; ActionType["TRANSFER_RECOMMENDATION"] = TRANSFER_RECOMMENDATION;
})(ActionType || (exports.ActionType = ActionType = {}));

var ActionStatus; (function (ActionStatus) {
  const PENDING = 'PENDING'; ActionStatus["PENDING"] = PENDING; const ACKNOWLEDGED = 'ACKNOWLEDGED'; ActionStatus["ACKNOWLEDGED"] = ACKNOWLEDGED;
  const RESPONDED = 'RESPONDED'; ActionStatus["RESPONDED"] = RESPONDED; const CLOSED = 'CLOSED'; ActionStatus["CLOSED"] = CLOSED; const APPEALED = 'APPEALED'; ActionStatus["APPEALED"] = APPEALED;
})(ActionStatus || (exports.ActionStatus = ActionStatus = {}));

const disciplinaryActionSchema = new (0, _mongoose.Schema)(
  {
    officerId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    violationId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Violation' },
    actionType: { type: String, enum: Object.values(ActionType), required: true },
    actionNumber: { type: Number, default: 1 },
    documentUrl: String,
    issuedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    issuedAt: { type: Date, default: Date.now },
    responseDeadline: Date,
    responseReceived: String,
    status: { type: String, enum: Object.values(ActionStatus), default: ActionStatus.PENDING },
  },
  { timestamps: true }
);

disciplinaryActionSchema.index({ officerId: 1, issuedAt: 1 });
disciplinaryActionSchema.index({ actionType: 1 });
disciplinaryActionSchema.index({ status: 1 });

 const DisciplinaryAction = _mongoose2.default.model('DisciplinaryAction', disciplinaryActionSchema); exports.DisciplinaryAction = DisciplinaryAction;
