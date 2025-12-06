/**
 * Comprehensive verification of assessment data flow
 * Run with: node verify-assessment-flow.js <classId>
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } catch (error) {
    console.warn('⚠️  Could not load .env file:', error.message);
  }
}

loadEnv();

const classId = process.argv[2] || '68e803064fa7553a940398d5';

// Schemas
const assessmentSchema = new mongoose.Schema({
  title: String,
  classId: String,
  teacherId: String,
  category: String,
  type: String,
  format: String,
  published: Boolean,
  questions: Array,
  totalPoints: Number,
  dueDate: Date
}, { timestamps: true });

const classSchema = new mongoose.Schema({
  name: String,
  classCode: String,
  students: Array
});

const Assessment = mongoose.models.Assessment || mongoose.model('Assessment', assessmentSchema);
const Class = mongoose.models.Class || mongoose.model('Class', classSchema);

async function verifyFlow() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 ASSESSMENT DATA FLOW VERIFICATION');
    console.log('='.repeat(70));
    console.log(`\nClass ID: ${classId}\n`);

    // 1. Check if class exists
    console.log('1️⃣  Checking if class exists...');
    const classDoc = await Class.findById(classId).lean();
    
    if (!classDoc) {
      console.log('   ❌ Class not found!');
      console.log('   💡 Make sure you\'re using the correct class ID');
      await mongoose.disconnect();
      return;
    }

    console.log(`   ✅ Class found: ${classDoc.name}`);
    console.log(`   📝 Class Code: ${classDoc.classCode}`);
    console.log(`   👥 Students enrolled: ${classDoc.students?.length || 0}`);

    // 2. Check assessments for this class
    console.log('\n2️⃣  Checking assessments for this class...');
    
    const allAssessments = await Assessment.find({ classId: classId }).lean();
    console.log(`   📊 Total assessments: ${allAssessments.length}`);

    if (allAssessments.length === 0) {
      console.log('   ⚠️  No assessments found for this class');
      console.log('   💡 Create assessments using the teacher interface or run:');
      console.log(`      node create-test-quiz.js ${classId} <teacherId>`);
      await mongoose.disconnect();
      return;
    }

    // 3. Check published assessments
    console.log('\n3️⃣  Checking published assessments...');
    const publishedAssessments = await Assessment.find({ 
      classId: classId, 
      published: true 
    }).lean();

    console.log(`   ✅ Published assessments: ${publishedAssessments.length}`);
    console.log(`   ⏳ Unpublished assessments: ${allAssessments.length - publishedAssessments.length}`);

    if (publishedAssessments.length === 0) {
      console.log('\n   ⚠️  No published assessments!');
      console.log('   💡 Publish assessments using the teacher interface');
      console.log('\n   Unpublished assessments:');
      allAssessments.forEach((a, i) => {
        console.log(`      ${i + 1}. ${a.title} (${a.category})`);
      });
      await mongoose.disconnect();
      return;
    }

    // 4. Show assessment breakdown by category
    console.log('\n4️⃣  Published assessments by category:');
    
    const quizzes = publishedAssessments.filter(a => a.category === 'Quiz');
    const exams = publishedAssessments.filter(a => a.category === 'Exam');
    const activities = publishedAssessments.filter(a => a.category === 'Activity');

    console.log(`   📝 Quizzes: ${quizzes.length}`);
    console.log(`   📄 Exams: ${exams.length}`);
    console.log(`   📋 Activities: ${activities.length}`);

    // 5. Show detailed assessment info
    console.log('\n5️⃣  Detailed assessment information:');
    
    publishedAssessments.forEach((assessment, index) => {
      console.log(`\n   ${index + 1}. ${assessment.title}`);
      console.log(`      ID: ${assessment._id}`);
      console.log(`      Category: ${assessment.category}`);
      console.log(`      Type: ${assessment.type}`);
      console.log(`      Format: ${assessment.format || 'online'}`);
      console.log(`      Questions: ${assessment.questions?.length || 0}`);
      console.log(`      Total Points: ${assessment.totalPoints || 'N/A'}`);
      console.log(`      Due Date: ${assessment.dueDate ? new Date(assessment.dueDate).toLocaleString() : 'No deadline'}`);
      console.log(`      Created: ${new Date(assessment.createdAt).toLocaleString()}`);
    });

    // 6. Verify data structure matches API expectations
    console.log('\n6️⃣  Verifying data structure...');
    
    let hasIssues = false;
    
    publishedAssessments.forEach((assessment, index) => {
      const issues = [];
      
      if (!assessment.title) issues.push('Missing title');
      if (!assessment.category) issues.push('Missing category');
      if (!assessment.type) issues.push('Missing type');
      if (!assessment.questions || assessment.questions.length === 0) issues.push('No questions');
      if (!assessment.dueDate) issues.push('No due date');
      
      if (issues.length > 0) {
        hasIssues = true;
        console.log(`   ⚠️  Assessment "${assessment.title}" has issues:`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      }
    });

    if (!hasIssues) {
      console.log('   ✅ All assessments have valid data structure');
    }

    // 7. Summary and next steps
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 SUMMARY:');
    console.log(`   Class: ${classDoc.name}`);
    console.log(`   Total Assessments: ${allAssessments.length}`);
    console.log(`   Published: ${publishedAssessments.length}`);
    console.log(`   - Quizzes: ${quizzes.length}`);
    console.log(`   - Exams: ${exams.length}`);
    console.log(`   - Activities: ${activities.length}`);

    if (publishedAssessments.length > 0) {
      console.log('\n✅ Everything looks good!');
      console.log('\n💡 Next steps:');
      console.log('   1. Make sure you\'re logged in as a student enrolled in this class');
      console.log('   2. Navigate to the class page');
      console.log('   3. Go to "Resources and Assessments" tab');
      console.log('   4. Click on the "Quiz", "Exam", or "Activity" sub-tab');
      console.log('   5. You should see the assessments listed above');
      console.log('\n   If you still don\'t see them:');
      console.log('   - Check browser console for errors (F12)');
      console.log('   - Clear browser cache and reload');
      console.log('   - Verify the student is enrolled in this class');
    }

    console.log('\n' + '='.repeat(70) + '\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyFlow();
