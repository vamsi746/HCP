"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

const policeStationSchema = new (0, _mongoose.Schema)(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    circleId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Circle', required: true },
    address: String,
    lat: Number,
    lng: Number,
    phone: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
policeStationSchema.index({ circleId: 1 });
policeStationSchema.index({ isActive: 1 });
policeStationSchema.index({ isActive: 1, name: 1 });

 const PoliceStation = _mongoose2.default.model('PoliceStation', policeStationSchema); exports.PoliceStation = PoliceStation;
