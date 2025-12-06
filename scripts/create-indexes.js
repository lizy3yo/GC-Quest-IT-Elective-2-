/**
 * Create Database Indexes Script
 * 
 * This script ensures all indexes defined in models are created in MongoDB.
 * Run this after deploying to ensure optimal query performance.
 * 
 * Usage: node scripts/create-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import all models to register their schemas and indexes
const models = {
  User: require('../src/models/user.ts').default,
  Class: require('../src/models/class.ts').default,
  Assessment: require('../src/models/assessment.ts').default,
  Submission: require('../src/models/submission.ts').default,
  Flashcard: require('../src/models/flashcard.ts').default,
  Folder: require('../src/models/folder.ts').default,
  Summary: require('../src/models/summary.ts').default,
  PracticeTest: require('../src/models/practice-test.ts').PracticeTest,
  PracticeTestSubmission: require('../src/models/practice-test-submission.ts').PracticeTestSubmission,
  StudyRoom: require('../src/models/study-room.ts').default,
  Resource: require('../src/models/resource.ts').default,
};

async function createIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable is not set');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      dbName: 'gc-quest-db',
      serverApi: { version: '1', strict: true, deprecationErrors: true },
    });
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Creating indexes for all models...\n');

    const results = [];

    for (const [modelName, Model] of Object.entries(models)) {
      try {
        console.log(`⏳ Creating indexes for ${modelName}...`);
        const startTime = Date.now();
        
        // Create all indexes defined in the schema
        await Model.createIndexes();
        
        const duration = Date.now() - startTime;
        
        // Get index information
        const indexes = await Model.collection.getIndexes();
        const indexCount = Object.keys(indexes).length;
        
        console.log(`✅ ${modelName}: ${indexCount} indexes created (${duration}ms)`);
        
        // List all indexes
        Object.entries(indexes).forEach(([name, index]) => {
          const keys = Object.entries(index.key || {})
            .map(([field, order]) => `${field}: ${order}`)
            .join(', ');
          console.log(`   - ${name}: { ${keys} }`);
        });
        console.log('');
        
        results.push({
          model: modelName,
          success: true,
          indexCount,
          duration,
        });
      } catch (error) {
        console.error(`❌ Error creating indexes for ${modelName}:`, error.message);
        results.push({
          model: modelName,
          success: false,
          error: error.message,
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 INDEX CREATION SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}/${results.length} models`);
    if (failed.length > 0) {
      console.log(`❌ Failed: ${failed.length}/${results.length} models`);
      failed.forEach(f => {
        console.log(`   - ${f.model}: ${f.error}`);
      });
    }
    
    const totalIndexes = successful.reduce((sum, r) => sum + r.indexCount, 0);
    console.log(`📈 Total indexes created: ${totalIndexes}`);
    
    const totalTime = successful.reduce((sum, r) => sum + r.duration, 0);
    console.log(`⏱️  Total time: ${totalTime}ms`);
    
    console.log('\n✨ Index creation complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
createIndexes();
