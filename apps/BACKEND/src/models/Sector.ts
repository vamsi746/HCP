import mongoose, { Schema } from 'mongoose';

const sectorSchema = new Schema(
  {
    name: { type: String, required: true },
    policeStationId: { type: Schema.Types.ObjectId, ref: 'PoliceStation', required: true },
    boundaryGeoJson: Schema.Types.Mixed,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
sectorSchema.index({ policeStationId: 1 });
sectorSchema.index({ policeStationId: 1, isActive: 1 });

export const Sector = mongoose.model('Sector', sectorSchema);
