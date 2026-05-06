const mongoose = require('mongoose');
const { Memo, DSR } = require('./src/models');
const { config } = require('./src/config');

async function cleanupMemos() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to DB...');

    // 1. Delete all Memos
    const memoResult = await Memo.deleteMany({});
    console.log(`Deleted ${memoResult.deletedCount} Memos (Drafts, Pending, Approved).`);

    // 2. Reset DSR parsed cases
    // We need to update the nested warningGenerated flag for all cases
    const dsrs = await DSR.find({});
    console.log(`Found ${dsrs.length} DSR documents. Resetting case statuses...`);

    let totalCasesReset = 0;
    for (let dsr of dsrs) {
      if (dsr.parsedCases && dsr.parsedCases.length > 0) {
        dsr.parsedCases.forEach(c => {
          c.warningGenerated = false;
          c.warningId = undefined;
        });
        await dsr.save();
        totalCasesReset += dsr.parsedCases.length;
      }
    }

    console.log(`\n--- Cleanup Complete ---`);
    console.log(`Reset ${totalCasesReset} parsed cases back to "Generate Memo" status.`);
    
    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanupMemos();
