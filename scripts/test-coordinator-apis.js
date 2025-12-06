// Test script for coordinator APIs
// Run this after logging in as coordinator to test the new endpoints

const token = 'YOUR_ACCESS_TOKEN_HERE'; // Replace with actual token from localStorage

async function testAPI(endpoint, method = 'GET', body = null) {
  console.log(`\n=== Testing ${method} ${endpoint} ===`);
  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`http://localhost:3000${endpoint}`, options);
    console.log('Status:', response.status, response.statusText);
    
    const text = await response.text();
    console.log('Response preview:', text.substring(0, 200));
    
    try {
      const data = JSON.parse(text);
      console.log('Parsed JSON:', JSON.stringify(data, null, 2));
      return data;
    } catch (e) {
      console.error('Failed to parse JSON. Response was:', text);
      return null;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('Starting Coordinator API Tests...');
  console.log('Make sure you have:');
  console.log('1. Started the dev server (npm run dev)');
  console.log('2. Logged in as coordinator');
  console.log('3. Replaced YOUR_ACCESS_TOKEN_HERE with your actual token\n');
  
  // Test parents endpoint
  await testAPI('/api/coordinator/parents');
  
  // Test classes endpoint
  await testAPI('/api/coordinator/classes');
  
  // Test teachers endpoint
  await testAPI('/api/coordinator/teachers');
  
  // Test students endpoint
  await testAPI('/api/coordinator/students');
  
  console.log('\n=== Tests Complete ===');
}

// Run if token is set
if (token !== 'YOUR_ACCESS_TOKEN_HERE') {
  runTests();
} else {
  console.log('Please set your access token in the script first!');
  console.log('1. Open browser console on coordinator page');
  console.log('2. Run: localStorage.getItem("accessToken")');
  console.log('3. Copy the token and paste it in this script');
}
