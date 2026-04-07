import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { parseTaskForceDSR } from '../services/dsr-parser';

async function main() {
  await connectDB();
  const db = mongoose.connection.db!;

  // Get latest DSR raw text
  const dsr = await db.collection('dsrs').findOne({}, { sort: { createdAt: -1 } });
  if (!dsr || !dsr.rawText) { console.log('No DSR found'); process.exit(0); }

  console.log('=== Re-parsing DSR with new parser ===');
  console.log('ID:', dsr._id);
  console.log('RawText length:', dsr.rawText.length);

  const result = parseTaskForceDSR(dsr.rawText);

  console.log('\n=== PARSE RESULT ===');
  console.log('reportDate:', result.reportDate);
  console.log('forceDescription:', result.forceDescription);
  console.log('zoneCoverage:', result.zoneCoverage);
  console.log('totalCases:', result.totalCases);

  console.log('\n=== ALL PARSED CASES ===');
  for (const c of result.cases) {
    console.log(`\n--- Case ${c.slNo} ---`);
    console.log('  zone:', c.zone);
    console.log('  crimeHead:', c.crimeHead);
    console.log('  policeStation:', c.policeStation);
    console.log('  crNo:', c.crNo);
    console.log('  sections:', c.sections);
    console.log('  dor:', c.dor);
    console.log('  accusedDetails:', c.accusedDetails?.slice(0, 150) + (c.accusedDetails?.length > 150 ? '...' : ''));
    console.log('  briefFacts:', c.briefFacts?.slice(0, 150) + (c.briefFacts?.length > 150 ? '...' : ''));
    console.log('  seizedProperty:', c.seizedProperty?.slice(0, 100));
    console.log('  seizedWorth:', c.seizedWorth);
    console.log('  numAccused:', c.numAccused);
    console.log('  abscondingAccused:', c.abscondingAccused?.slice(0, 100));
    console.log('  extractedLocations:', c.extractedLocations.length);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
