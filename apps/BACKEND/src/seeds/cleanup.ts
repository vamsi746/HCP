import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { Officer, SectorOfficer, Violation, DisciplinaryAction } from '../models';

async function cleanup() {
  await connectDB();
  console.log('Connected to MongoDB. Cleaning up...');

  // Find the Commissioner
  const commissioner = await Officer.findOne({ badgeNumber: 'HCP-001' });
  if (!commissioner) {
    console.error('Commissioner HCP-001 not found!');
    process.exit(1);
  }

  // Get all officer IDs except commissioner
  const othersFilter = { _id: { $ne: commissioner._id } };

  // Remove related records first
  const otherIds = (await Officer.find(othersFilter).select('_id').lean()).map((o) => o._id);

  const [assignments, violations, actions, officers] = await Promise.all([
    SectorOfficer.deleteMany({ officerId: { $in: otherIds } }),
    Violation.deleteMany({ officerId: { $in: otherIds } }),
    DisciplinaryAction.deleteMany({ officerId: { $in: otherIds } }),
    Officer.deleteMany(othersFilter),
  ]);

  console.log('\n══════════════════════════════════════════════');
  console.log('  CLEANUP COMPLETE');
  console.log('══════════════════════════════════════════════');
  console.log(`  Officers removed:      ${officers.deletedCount}`);
  console.log(`  Assignments removed:   ${assignments.deletedCount}`);
  console.log(`  Violations removed:    ${violations.deletedCount}`);
  console.log(`  Actions removed:       ${actions.deletedCount}`);
  console.log('──────────────────────────────────────────────');
  console.log(`  Kept: ${commissioner.name} (${commissioner.badgeNumber})`);
  console.log('══════════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
