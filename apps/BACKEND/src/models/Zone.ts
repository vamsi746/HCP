import mongoose, { Schema, Document } from 'mongoose';

export interface IZone extends Document {
  name: string;
  code: string;
  dcpId?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const zoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    dcpId: { type: Schema.Types.ObjectId, ref: 'Officer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

zoneSchema.index({ isActive: 1 });

export const Zone = mongoose.model<IZone>('Zone', zoneSchema);
