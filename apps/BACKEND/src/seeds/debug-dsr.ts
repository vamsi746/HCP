import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import { connectDB } from '../config/database';

async function main() {
  await connectDB();
  const db = mongoose.connection.db!;

  // Get latest DSR
  const dsr = await db.collection('dsrs').findOne({}, { sort: { createdAt: -1 } });
  if (!dsr) { console.log('No DSR found'); process.exit(0); }

  console.log('=== DSR INFO ===');
  console.log('ID:', dsr._id);
  console.log('ForceType:', dsr.forceType);
  console.log('Date:', dsr.date);
  console.log('TotalCases:', dsr.totalCases);
  console.log('Status:', dsr.processingStatus);
  console.log('ParsedCases count:', dsr.parsedCases?.length);

  // Show first 2 parsed cases fully
  if (dsr.parsedCases?.length > 0) {
    console.log('\n=== FIRST 3 PARSED CASES ===');
    for (let i = 0; i < Math.min(3, dsr.parsedCases.length); i++) {
      console.log(`\n--- Case ${i + 1} ---`);
      console.log(JSON.stringify(dsr.parsedCases[i], null, 2));
    }
  }

  // Show raw text (first 5000 chars)
  if (dsr.rawText) {
    console.log('\n=== RAW TEXT (first 5000 chars) ===');
    console.log(dsr.rawText.substring(0, 5000));
    console.log('\n=== RAW TEXT (5000-10000) ===');
    console.log(dsr.rawText.substring(5000, 10000));
  }

  // Check zone structure
  console.log('\n=== ZONES ===');
  const zones = await db.collection('zones').find({}).toArray();
  zones.forEach((z: any) => console.log(`  ${z.name} (${z.code}) - _id: ${z._id}`));

  // Check a sample PS with its circle/division chain
  console.log('\n=== SAMPLE PS → CIRCLE → DIVISION → ZONE CHAIN ===');
  const samplePS = await db.collection('policestations').findOne({ name: /Gudimalkapur/i });
  if (samplePS) {
    console.log('PS:', samplePS.name, samplePS._id);
    console.log('  circleId:', samplePS.circleId);
    const circle = await db.collection('circles').findOne({ _id: samplePS.circleId });
    if (circle) {
      console.log('  Circle:', circle.name, circle._id);
      console.log('  divisionId:', circle.divisionId);
      const division = await db.collection('divisions').findOne({ _id: circle.divisionId });
      if (division) {
        console.log('  Division:', division.name, division._id);
        console.log('  zoneId:', division.zoneId);
        const zone = await db.collection('zones').findOne({ _id: division.zoneId });
        if (zone) console.log('  Zone:', zone.name, zone._id);
      }
    }
  }

  // Check sectors for Gudimalkapur PS
  console.log('\n=== SECTORS for Gudimalkapur PS ===');
  if (samplePS) {
    const sectors = await db.collection('sectors').find({ policeStationId: samplePS._id }).toArray();
    sectors.forEach((s: any) => console.log(`  Sector: ${s.name} (${s._id})`));

    // Check sectorofficers
    if (sectors.length > 0) {
      console.log('\n=== SECTOR OFFICERS ===');
      const sectorIds = sectors.map((s: any) => s._id);
      const officers = await db.collection('sectorofficers').find({ sectorId: { $in: sectorIds } }).toArray();
      for (const so of officers) {
        const officer = await db.collection('officers').findOne({ _id: so.officerId });
        console.log(`  SectorOfficer: role=${so.role}, isActive=${so.isActive}, officer=${officer?.name || so.officerId}`);
      }
    }
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
