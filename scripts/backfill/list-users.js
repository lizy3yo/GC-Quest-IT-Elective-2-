// Quick script to list users in database for seeding
import mongoose from 'mongoose';
import { User } from '../../src/models/user.js';

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gc-quest';
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
    
    // Find all teachers
    const teachers = await User.find({ role: 'teacher' }).select('email firstName lastName').lean();
    console.log('\n👨‍🏫 Teachers:');
    teachers.forEach(teacher => {
      console.log(`  📧 ${teacher.email} - ${teacher.firstName} ${teacher.lastName}`);
    });
    
    // Find all students
    const students = await User.find({ role: 'student' }).select('email firstName lastName').lean();
    console.log('\n👨‍🎓 Students:');
    students.forEach(student => {
      console.log(`  📧 ${student.email} - ${student.firstName} ${student.lastName}`);
    });
    
    console.log('\n📋 Use these emails in your test-seeding.js file');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

connectDB();