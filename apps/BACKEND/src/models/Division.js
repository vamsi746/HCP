"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

const divisionSchema = new (0, _mongoose.Schema)(
  {
    name: { type: String, required: true },
    zoneId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    acpId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
divisionSchema.index({ zoneId: 1 });

 const Division = _mongoose2.default.model('Division', divisionSchema); exports.Division = Division;
