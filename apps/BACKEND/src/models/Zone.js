"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);








const zoneSchema = new _mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    dcpId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

zoneSchema.index({ isActive: 1 });

 const Zone = _mongoose2.default.model('Zone', zoneSchema); exports.Zone = Zone;
