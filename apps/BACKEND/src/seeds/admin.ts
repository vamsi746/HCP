import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database';
import { Officer, OfficerRank } from '../models';

async function seedAdmin() {
  await connectDB();

  const existing = await Officer.findOne({ badgeNumber: 'admin@hcp.com' });
  if (existing) {
    console.log('Admin already exists, updating password...');
    existing.passwordHash = await bcrypt.hash('admin123', 12);
    existing.isActive = true;
    existing.failedLoginAttempts = 0;
    existing.lockedUntil = undefined;
    await existing.save();
    console.log('Admin password updated.');
  } else {
    const passwordHash = await bcrypt.hash('admin123', 12);
    await Officer.create({
      badgeNumber: 'admin@hcp.com',
      name: 'System Admin',
      rank: OfficerRank.COMMISSIONER,
      email: 'admin@hcp.com',
      passwordHash,
      isActive: true,
      failedLoginAttempts: 0,
    });
    console.log('Admin user created successfully.');
  }

  console.log('Credentials → Badge: admin@hcp.com | Password: admin123');
  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
