"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

const sectorSchema = new (0, _mongoose.Schema)(
  {
    name: { type: String, required: true },
    policeStationId: { type: _mongoose.Schema.Types.ObjectId, ref: 'PoliceStation', required: true },
    boundaryGeoJson: _mongoose.Schema.Types.Mixed,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
sectorSchema.index({ policeStationId: 1 });
sectorSchema.index({ policeStationId: 1, isActive: 1 });

 const Sector = _mongoose2.default.model('Sector', sectorSchema); exports.Sector = Sector;
