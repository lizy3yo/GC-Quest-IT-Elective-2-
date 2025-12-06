/**
 * Script to clean up duplicate MongoDB indexes
 * Specifically removes duplicate classCode indexes from the classes collection
 */

const mongoose = require('mongoose');

async function cleanupIndexes() {
  try {
    // Connect to MongoDB using the same connection as the app
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gc-quest-db';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('classes');

    // Get current indexes
    console.log('🔍 Checking current indexes...');
    const indexes = await collection.listIndexes().toArray();
    console.log('Current indexes:', indexes.map(idx => `${idx.name} (${JSON.stringify(idx.key)})`));

    // Find duplicate classCode indexes
    const classCodeIndexes = indexes.filter(idx => 
      idx.key && idx.key.classCode === 1
    );

    console.log(`Found ${classCodeIndexes.length} classCode indexes`);

    if (classCodeIndexes.length > 1) {
      // Keep the one with unique constraint, drop others
      for (let i = 1; i < classCodeIndexes.length; i++) {
        const indexToRemove = classCodeIndexes[i];
        console.log(`🗑️ Dropping duplicate index: ${indexToRemove.name}`);
        await collection.dropIndex(indexToRemove.name);
        console.log(`✅ Successfully dropped index: ${indexToRemove.name}`);
      }
    } else {
      console.log('ℹ️ No duplicate classCode indexes found');
    }

    // Verify final state
    console.log('🔍 Verifying final state...');
    const finalIndexes = await collection.listIndexes().toArray();
    console.log('Final indexes:', finalIndexes.map(idx => `${idx.name} (${JSON.stringify(idx.key)})`));

    // Check if we have exactly one classCode index with unique constraint
    const remainingClassCodeIndexes = finalIndexes.filter(idx => 
      idx.key && idx.key.classCode === 1
    );
    
    if (remainingClassCodeIndexes.length === 1 && remainingClassCodeIndexes[0].unique) {
      console.log('✅ Perfect! One unique classCode index remains');
    } else if (remainingClassCodeIndexes.length === 0) {
      console.log('⚠️ Warning: No classCode index found. Creating one...');
      await collection.createIndex({ classCode: 1 }, { unique: true, name: 'classCode_1' });
      console.log('✅ Created unique classCode index');
    } else {
      console.log('⚠️ Warning: Multiple classCode indexes still exist or missing unique constraint');
    }

  } catch (error) {
    console.error('❌ Error cleaning up indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

console.log('🧹 Starting MongoDB index cleanup...');
cleanupIndexes().then(() => {
  console.log('✅ Index cleanup completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Index cleanup failed:', error);
  process.exit(1);
});