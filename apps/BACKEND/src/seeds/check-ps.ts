import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import { connectDB } from '../config/database';

async function main() {
  await connectDB();
  const ps = await mongoose.connection.db!.collection('policestations').find({}).toArray();
  console.log('Total police stations:', ps.length);
  
  // Search for Gudimalkapur
  const gudimal = ps.filter((p: any) => p.name.toLowerCase().includes('gudimal'));
  console.log('\nGudimalkapur search:', gudimal.map((p: any) => ({ name: p.name, code: p.code })));
  
  // Show all PS names for reference
  console.log('\nAll police stations:');
  ps.forEach((p: any) => console.log(`  ${p.name} (${p.code})`));
  
  const sectors = await mongoose.connection.db!.collection('sectors').find({}).toArray();
  console.log('\nTotal sectors:', sectors.length);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
