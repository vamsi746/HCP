import mongoose, { Schema } from 'mongoose';

const circleSchema = new Schema(
  {
    name: { type: String, required: true },
    divisionId: { type: Schema.Types.ObjectId, ref: 'Division', required: true },
    ciId: { type: Schema.Types.ObjectId, ref: 'Officer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
circleSchema.index({ divisionId: 1 });
circleSchema.index({ divisionId: 1, isActive: 1 });

export const Circle = mongoose.model('Circle', circleSchema);
