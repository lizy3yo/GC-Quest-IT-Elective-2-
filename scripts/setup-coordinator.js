/**
 * Setup Coordinator Script
 * 
 * This script helps you create or update a user to have coordinator role.
 * Run this script to set up your first coordinator account.
 * 
 * Usage:
 *   node setup-coordinator.js <email>
 * 
 * Example:
 *   node setup-coordinator.js coordinator@gordoncollege.edu.ph
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Read .env file manually
let MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const mongoUriMatch = envContent.match(/MONGO_URI=(.+)/);
      if (mongoUriMatch) {
        MONGODB_URI = mongoUriMatch[1].trim();
      }
    }
  } catch (err) {
    console.log('Could not read .env file, using default connection');
  }
}

// Fallback to default
if (!MONGODB_URI) {
  MONGODB_URI = 'mongodb://localhost:27017/gc-quest';
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    console.error('Make sure MongoDB is running and MONGODB_URI is set correctly');
    process.exit(1);
  }
}

// User Schema (simplified version)
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin', 'coordinator'],
    default: 'student'
  },
  firstName: String,
  lastName: String,
  studentNumber: String,
  honorifics: String,
  socialLinks: {
    website: String,
    facebook: String,
    instagram: String
  }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function setupCoordinator(email) {
  if (!email) {
    console.error('✗ Please provide an email address');
    console.log('Usage: node setup-coordinator.js <email>');
    console.log('Example: node setup-coordinator.js coordinator@gordoncollege.edu.ph');
    process.exit(1);
  }

  try {
    await connectDB();

    // Find user by email
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`\n⚠ User with email "${email}" not found. Creating new coordinator user...`);
      
      // Create new coordinator user with default password
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password@1234', 10);
      
      user = await User.create({
        username: 'coordinator',
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'coordinator',
        firstName: 'Coordinator',
        lastName: 'Admin',
      });

      console.log('\n✓ Successfully created new coordinator user!');
      console.log('\nUser Details:');
      console.log(`  Name: ${user.firstName} ${user.lastName}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Password: Password@1234`);
      console.log('\n✓ You can now log in and access the coordinator dashboard at: /coordinator_page');
    } else {
      // Update existing user role to coordinator
      user.role = 'coordinator';
      
      // Update password to Coordinator@1234
      const bcrypt = require('bcrypt');
      user.password = await bcrypt.hash('Coordinator@1234', 10);
      
      await user.save();

      console.log('\n✓ Successfully updated user to coordinator role!');
      console.log('\nUser Details:');
      console.log(`  Name: ${user.firstName} ${user.lastName}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Password: Coordinator@1234 (updated)`);
      console.log('\n✓ You can now log in and access the coordinator dashboard at: /coordinator_page');
    }

  } catch (error) {
    console.error('\n✗ Error setting up coordinator:', error.message);
    if (error.code === 11000) {
      console.error('✗ A user with this email or username already exists.');
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

// Get email from command line arguments or use default
const email = process.argv[2] || 'coordinator@gordoncollege.edu.ph';

console.log('\n========================================');
console.log('  Coordinator Setup Script');
console.log('========================================\n');
console.log(`Setting up coordinator for: ${email}\n`);

setupCoordinator(email);
