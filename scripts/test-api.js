/**
 * Test the student class API endpoint
 * Run with: node test-api.js <classId> <accessToken>
 */

const classId = process.argv[2] || '68e803064fa7553a940398d5';
const token = process.argv[3];

if (!token) {
  console.log('Usage: node test-api.js <classId> <accessToken>');
  console.log('Example: node test-api.js 68e803064fa7553a940398d5 your-token-here');
  console.log('\nTo get your access token:');
  console.log('1. Open your browser DevTools (F12)');
  console.log('2. Go to Application/Storage > Local Storage');
  console.log('3. Find "accessToken" key');
  console.log('4. Copy the value');
  process.exit(1);
}

async function testAPI() {
  try {
    const url = `http://localhost:3000/api/student_page/class/${classId}?details=true`;
    console.log(`\n🔍 Testing API: ${url}\n`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (!data.success) {
      console.error('❌ API Error:', data.error);
      return;
    }

    console.log('\n✅ API Response Success!\n');
    console.log('Class:', data.data.class.name);
    console.log('Class ID:', data.data.class._id);
    console.log('\nAssessments:', data.data.class.assessments?.length || 0);

    if (data.data.class.assessments && data.data.class.assessments.length > 0) {
      console.log('\nAssessment Details:');
      data.data.class.assessments.forEach((assessment, index) => {
        console.log(`\n${index + 1}. ${assessment.title}`);
        console.log(`   ID: ${assessment.id}`);
        console.log(`   Category: ${assessment.category}`);
        console.log(`   Type: ${assessment.type}`);
        console.log(`   Published: ${assessment.published}`);
        console.log(`   Due Date: ${assessment.dueDate}`);
      });
    } else {
      console.log('\n⚠️  No assessments returned by API');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
