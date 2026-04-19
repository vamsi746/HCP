"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

var ViolationType; (function (ViolationType) {
  const MISSED_ACTION = 'MISSED_ACTION'; ViolationType["MISSED_ACTION"] = MISSED_ACTION;
  const INACTIVE_SI = 'INACTIVE_SI'; ViolationType["INACTIVE_SI"] = INACTIVE_SI;
  const DEFECTIVE_REGISTRATION = 'DEFECTIVE_REGISTRATION'; ViolationType["DEFECTIVE_REGISTRATION"] = DEFECTIVE_REGISTRATION;
  const SUPERVISION_FAILURE = 'SUPERVISION_FAILURE'; ViolationType["SUPERVISION_FAILURE"] = SUPERVISION_FAILURE;
  const INSUBORDINATION = 'INSUBORDINATION'; ViolationType["INSUBORDINATION"] = INSUBORDINATION;
})(ViolationType || (exports.ViolationType = ViolationType = {}));

var Severity; (function (Severity) {
  const LOW = 'LOW'; Severity["LOW"] = LOW; const MEDIUM = 'MEDIUM'; Severity["MEDIUM"] = MEDIUM; const HIGH = 'HIGH'; Severity["HIGH"] = HIGH; const CRITICAL = 'CRITICAL'; Severity["CRITICAL"] = CRITICAL;
})(Severity || (exports.Severity = Severity = {}));

const violationSchema = new (0, _mongoose.Schema)(
  {
    officerId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    caseId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Case' },
    violationType: { type: String, enum: Object.values(ViolationType), required: true },
    severity: { type: String, enum: Object.values(Severity), required: true },
    date: { type: Date, required: true },
    description: String,
    isExempted: { type: Boolean, default: false },
    exemptionReason: String,
    exemptedBy: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    coolingResetDate: Date,
  },
  { timestamps: true }
);

violationSchema.index({ officerId: 1, date: 1 });
violationSchema.index({ violationType: 1 });
violationSchema.index({ date: 1 });

 const Violation = _mongoose2.default.model('Violation', violationSchema); exports.Violation = Violation;
