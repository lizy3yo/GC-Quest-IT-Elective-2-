const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let MONGO_URI = '';
for (const line of envLines) {
  if (line.startsWith('MONGO_URI=')) {
    MONGO_URI = line.substring('MONGO_URI='.length).trim();
    break;
  }
}

async function clearResources() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const result = await mongoose.connection.db.collection('resources').deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} resources`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearResources();
