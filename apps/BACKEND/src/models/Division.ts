import mongoose, { Schema, Document } from 'mongoose';

const divisionSchema = new Schema(
  {
    name: { type: String, required: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    acpId: { type: Schema.Types.ObjectId, ref: 'Officer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
divisionSchema.index({ zoneId: 1 });

export const Division = mongoose.model('Division', divisionSchema);
