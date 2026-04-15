import mongoose, { Schema } from 'mongoose';

const policeStationSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    circleId: { type: Schema.Types.ObjectId, ref: 'Circle', required: true },
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

export const PoliceStation = mongoose.model('PoliceStation', policeStationSchema);
