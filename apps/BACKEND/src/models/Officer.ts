import mongoose, { Schema, Document } from 'mongoose';

export enum OfficerRank {
  CONSTABLE = 'CONSTABLE',
  HEAD_CONSTABLE = 'HEAD_CONSTABLE',
  ASI = 'ASI',
  PSI = 'PSI',
  SI = 'SI',
  WSI = 'WSI',
  CI = 'CI',
  ACP = 'ACP',
  DCP = 'DCP',
  ADDL_CP = 'ADDL_CP',
  COMMISSIONER = 'COMMISSIONER',
}

export interface IOfficer extends Document {
  badgeNumber: string;
  name: string;
  rank: OfficerRank;
  email?: string;
  phone?: string;
  passwordHash: string;
  isActive: boolean;
  recruitmentType?: 'DIRECT' | 'RANKER';
  batch?: number;
  remarks?: string;
  joiningDate?: Date;
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
}

const officerSchema = new Schema<IOfficer>(
  {
    badgeNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    rank: { type: String, enum: Object.values(OfficerRank), required: true },
    email: { type: String, unique: true, sparse: true },
    phone: String,
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    recruitmentType: { type: String, enum: ['DIRECT', 'RANKER'] },
    batch: Number,
    remarks: String,
    joiningDate: Date,
    lastLogin: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true }
);

officerSchema.index({ rank: 1 });
officerSchema.index({ isActive: 1 });
officerSchema.index({ rank: 1, isActive: 1 });

export const Officer = mongoose.model<IOfficer>('Officer', officerSchema);

// Sector Officer assignment
const sectorOfficerSchema = new Schema(
  {
    sectorId: { type: Schema.Types.ObjectId, ref: 'Sector', required: true },
    officerId: { type: Schema.Types.ObjectId, ref: 'Officer', required: true },
    role: { type: String, enum: ['PRIMARY_SI', 'RELIEF_SI', 'CI_OVERSIGHT'], required: true },
    isActive: { type: Boolean, default: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sectorOfficerSchema.index({ sectorId: 1, role: 1, isActive: 1 });
sectorOfficerSchema.index({ officerId: 1 });
sectorOfficerSchema.index({ isActive: 1, officerId: 1 });

export const SectorOfficer = mongoose.model('SectorOfficer', sectorOfficerSchema);

// Officer Leave
const officerLeaveSchema = new Schema(
  {
    officerId: { type: Schema.Types.ObjectId, ref: 'Officer', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: String,
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    reliefSIId: { type: Schema.Types.ObjectId, ref: 'Officer' },
  },
  { timestamps: true }
);

export const OfficerLeave = mongoose.model('OfficerLeave', officerLeaveSchema);
