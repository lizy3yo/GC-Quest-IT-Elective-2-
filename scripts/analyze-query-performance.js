/**
 * Query Performance Analysis Script
 * 
 * This script analyzes common queries to ensure they're using indexes properly.
 * Use this to identify slow queries and missing indexes.
 * 
 * Usage: node scripts/analyze-query-performance.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../src/models/user.ts').default;
const Class = require('../src/models/class.ts').default;
const Assessment = require('../src/models/assessment.ts').default;
const Submission = require('../src/models/submission.ts').default;
const Flashcard = require('../src/models/flashcard.ts').default;

async function analyzeQuery(name, query) {
  console.log(`\n📊 Analyzing: ${name}`);
  console.log('─'.repeat(60));
  
  try {
    const explanation = await query.explain('executionStats');
    const stats = explanation.executionStats;
    
    const stage = stats.executionStages?.stage || stats.stage;
    const usesIndex = stage !== 'COLLSCAN';
    const indexName = stats.executionStages?.indexName || stats.indexName;
    const docsExamined = stats.totalDocsExamined;
    const docsReturned = stats.nReturned;
    const executionTime = stats.executionTimeMillis;
    
    // Performance rating
    let rating = '✅ EXCELLENT';
    if (!usesIndex) {
      rating = '❌ POOR (No Index)';
    } else if (executionTime > 100) {
      rating = '⚠️  SLOW';
    } else if (docsExamined > docsReturned * 10) {
      rating = '⚠️  INEFFICIENT';
    }
    
    console.log(`Status: ${rating}`);
    console.log(`Uses Index: ${usesIndex ? '✅ Yes' : '❌ No (COLLSCAN)'}`);
    if (indexName) {
      console.log(`Index Used: ${indexName}`);
    }
    console.log(`Execution Time: ${executionTime}ms`);
    console.log(`Docs Examined: ${docsExamined}`);
    console.log(`Docs Returned: ${docsReturned}`);
    console.log(`Efficiency: ${docsReturned > 0 ? ((docsReturned / docsExamined) * 100).toFixed(1) : 0}%`);
    
    return {
      name,
      usesIndex,
      indexName,
      executionTime,
      docsExamined,
      docsReturned,
      rating,
    };
  } catch (error) {
    console.error(`❌ Error analyzing query: ${error.message}`);
    return {
      name,
      error: error.message,
    };
  }
}

async function analyzePerformance() {
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

    console.log('🔍 Analyzing Common Query Patterns...');
    console.log('='.repeat(60));

    const results = [];

    // Get a sample user ID for testing
    const sampleUser = await User.findOne().select('_id').lean();
    const userId = sampleUser?._id?.toString() || '507f1f77bcf86cd799439011';

    // Get a sample class for testing
    const sampleClass = await Class.findOne().select('_id').lean();
    const classId = sampleClass?._id?.toString() || '507f1f77bcf86cd799439011';

    // Common query patterns to analyze
    const queries = [
      {
        name: 'Find user by email',
        query: User.find({ email: 'test@example.com' }),
      },
      {
        name: 'Find user by role',
        query: User.find({ role: 'student' }),
      },
      {
        name: 'Find active classes for teacher',
        query: Class.find({ teacherId: userId, isActive: true }),
      },
      {
        name: 'Find student enrollments',
        query: Class.find({ 'students.studentId': userId }),
      },
      {
        name: 'Find published assessments for class',
        query: Assessment.find({ classId: classId, published: true }),
      },
      {
        name: 'Find assessments by teacher (sorted)',
        query: Assessment.find({ teacherId: userId }).sort({ createdAt: -1 }),
      },
      {
        name: 'Find submissions for assessment',
        query: Submission.find({ assessmentId: classId }).sort({ submittedAt: -1 }),
      },
      {
        name: 'Find student submissions',
        query: Submission.find({ studentId: userId }).sort({ submittedAt: -1 }),
      },
      {
        name: 'Find pending submissions',
        query: Submission.find({ status: 'submitted', needsManualGrading: true }),
      },
      {
        name: 'Find user flashcards by subject',
        query: Flashcard.find({ user: userId, subject: 'Math' }),
      },
      {
        name: 'Find favorite flashcards',
        query: Flashcard.find({ user: userId, isFavorite: true }),
      },
      {
        name: 'Find public flashcards',
        query: Flashcard.find({ accessType: 'public' }),
      },
    ];

    // Analyze each query
    for (const { name, query } of queries) {
      const result = await analyzeQuery(name, query);
      results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    const withIndex = results.filter(r => r.usesIndex);
    const withoutIndex = results.filter(r => !r.usesIndex && !r.error);
    const slow = results.filter(r => r.executionTime > 100);
    const errors = results.filter(r => r.error);
    
    console.log(`\n✅ Queries using indexes: ${withIndex.length}/${results.length - errors.length}`);
    console.log(`❌ Queries without indexes: ${withoutIndex.length}/${results.length - errors.length}`);
    console.log(`⚠️  Slow queries (>100ms): ${slow.length}/${results.length - errors.length}`);
    
    if (withoutIndex.length > 0) {
      console.log('\n⚠️  QUERIES NEEDING INDEXES:');
      withoutIndex.forEach(r => {
        console.log(`   - ${r.name}`);
      });
    }
    
    if (slow.length > 0) {
      console.log('\n⚠️  SLOW QUERIES:');
      slow.forEach(r => {
        console.log(`   - ${r.name}: ${r.executionTime}ms`);
      });
    }
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }
    
    const avgTime = results
      .filter(r => r.executionTime)
      .reduce((sum, r) => sum + r.executionTime, 0) / results.filter(r => r.executionTime).length;
    
    console.log(`\n⏱️  Average execution time: ${avgTime.toFixed(2)}ms`);
    
    console.log('\n✨ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
analyzePerformance();
