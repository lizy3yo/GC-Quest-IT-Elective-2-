const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let MONGO_URI = '';
for (const line of envLines) {
  if (line.startsWith('MONGO_URI=')) {
    MONGO_URI = line.substring('MONGO_URI='.length).trim();
    break;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  olderThan: args.find(arg => arg.startsWith('--older-than='))?.split('=')[1] || '90', // days
  type: args.find(arg => arg.startsWith('--type='))?.split('=')[1] || 'all', // all, pdf, image, video, document
  unused: args.includes('--unused'), // delete resources not referenced by any document
  limit: args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || null, // limit number of resources to delete
  help: args.includes('--help') || args.includes('-h')
};

function showHelp() {
  console.log(`
📦 Resource Cleanup Script
==========================

Usage: node scripts/cleanup-resources.js [options]

Options:
  --dry-run              Show what would be deleted without actually deleting
  --older-than=DAYS      Delete resources older than X days (default: 90)
  --type=TYPE            Delete specific type: all, pdf, image, video, document (default: all)
  --unused               Delete resources not referenced by any collection
  --limit=NUMBER         Limit the number of resources to delete (e.g., --limit=30)
  --help, -h             Show this help message

Examples:
  # Dry run to see what would be deleted (older than 90 days)
  node scripts/cleanup-resources.js --dry-run

  # Delete only 30 oldest resources
  node scripts/cleanup-resources.js --limit=30

  # Delete only 30 unused resources
  node scripts/cleanup-resources.js --unused --limit=30 --dry-run

  # Delete resources older than 180 days
  node scripts/cleanup-resources.js --older-than=180

  # Delete only 50 PDF files older than 60 days
  node scripts/cleanup-resources.js --type=pdf --older-than=60 --limit=50

  # Delete unused resources (not referenced anywhere)
  node scripts/cleanup-resources.js --unused --dry-run

  # Combine options
  node scripts/cleanup-resources.js --type=image --older-than=30 --limit=30
  `);
}

async function findUnusedResources(resources) {
  console.log('🔍 Checking for unused resources...');
  
  const resourceIds = resources.map(r => r._id);
  const collections = ['summaries', 'flashcards', 'assessments', 'submissions', 'users'];
  const usedResourceIds = new Set();

  for (const collectionName of collections) {
    try {
      const collection = mongoose.connection.db.collection(collectionName);
      
      // Find documents that reference resources
      const docs = await collection.find({
        $or: [
          { resourceId: { $in: resourceIds } },
          { resources: { $in: resourceIds } },
          { attachments: { $in: resourceIds } },
          { files: { $in: resourceIds } },
          { 'content.resourceId': { $in: resourceIds } }
        ]
      }).toArray();

      docs.forEach(doc => {
        if (doc.resourceId) usedResourceIds.add(doc.resourceId.toString());
        if (doc.resources) doc.resources.forEach(id => usedResourceIds.add(id.toString()));
        if (doc.attachments) doc.attachments.forEach(id => usedResourceIds.add(id.toString()));
        if (doc.files) doc.files.forEach(id => usedResourceIds.add(id.toString()));
      });
    } catch (error) {
      console.log(`  ⚠️  Collection ${collectionName} not found or error: ${error.message}`);
    }
  }

  const unusedResources = resources.filter(r => !usedResourceIds.has(r._id.toString()));
  console.log(`  Found ${unusedResources.length} unused resources out of ${resources.length} total`);
  
  return unusedResources;
}

async function cleanupResources() {
  try {
    if (options.help) {
      showHelp();
      process.exit(0);
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const resourcesCollection = mongoose.connection.db.collection('resources');
    
    // Build query
    const query = {};
    
    // Filter by age
    if (!options.unused) {
      const daysAgo = parseInt(options.olderThan);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      query.createdAt = { $lt: cutoffDate };
      console.log(`📅 Looking for resources older than ${daysAgo} days (before ${cutoffDate.toLocaleDateString()})`);
    }

    // Filter by type
    if (options.type !== 'all') {
      const typeMap = {
        pdf: 'application/pdf',
        image: /^image\//,
        video: /^video\//,
        document: /^application\/(msword|vnd\.openxmlformats|vnd\.ms-)/
      };
      
      if (typeMap[options.type]) {
        query.mimeType = typeMap[options.type];
        console.log(`📄 Filtering by type: ${options.type}`);
      }
    }

    // Find resources matching criteria
    let resourcesToDelete = await resourcesCollection.find(query).toArray();
    console.log(`\n🔍 Found ${resourcesToDelete.length} resources matching criteria`);

    if (resourcesToDelete.length === 0) {
      console.log('\n✨ No resources to delete!');
      process.exit(0);
    }

    // Check for unused resources if flag is set
    if (options.unused) {
      resourcesToDelete = await findUnusedResources(resourcesToDelete);
    }

    if (resourcesToDelete.length === 0) {
      console.log('\n✨ No resources to delete after filtering!');
      process.exit(0);
    }

    // Apply limit if specified
    if (options.limit) {
      const limit = parseInt(options.limit);
      if (resourcesToDelete.length > limit) {
        console.log(`\n🔢 Limiting to ${limit} resources (found ${resourcesToDelete.length} total)`);
        resourcesToDelete = resourcesToDelete.slice(0, limit);
      }
    }

    // Calculate total size
    const totalSize = resourcesToDelete.reduce((sum, r) => sum + (r.size || 0), 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    console.log('\n📊 Summary:');
    console.log(`  Total resources: ${resourcesToDelete.length}`);
    console.log(`  Total size: ${totalSizeMB} MB`);
    
    // Group by type
    const byType = {};
    resourcesToDelete.forEach(r => {
      const type = r.mimeType || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    console.log('\n  By type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });

    // Show sample resources
    console.log('\n📝 Sample resources to be deleted:');
    resourcesToDelete.slice(0, 5).forEach(r => {
      const sizeMB = ((r.size || 0) / (1024 * 1024)).toFixed(2);
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'unknown';
      console.log(`    - ${r.filename || r.originalName || 'unnamed'} (${sizeMB} MB, ${date})`);
    });
    
    if (resourcesToDelete.length > 5) {
      console.log(`    ... and ${resourcesToDelete.length - 5} more`);
    }

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN - No resources were deleted');
      console.log('   Remove --dry-run flag to actually delete these resources');
    } else {
      console.log('\n⚠️  WARNING: This will permanently delete these resources!');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const resourceIds = resourcesToDelete.map(r => r._id);
      const result = await resourcesCollection.deleteMany({ _id: { $in: resourceIds } });
      
      console.log(`\n✅ Successfully deleted ${result.deletedCount} resources`);
      console.log(`💾 Freed up approximately ${totalSizeMB} MB of storage`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

cleanupResources();
