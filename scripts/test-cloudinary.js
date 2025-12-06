// Test script to verify Cloudinary configuration and URL access
const fetch = require('node-fetch');

// Test Cloudinary URL fetch
async function testCloudinaryFetch() {
  // Replace with an actual Cloudinary URL from your database
  const testUrl = 'https://res.cloudinary.com/dqvhbvqnw/raw/upload/v1234567890/test-file.pdf';

  console.log('Testing Cloudinary fetch for URL:', testUrl);

  try {
    const response = await fetch(testUrl);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      console.log('✅ Cloudinary URL is accessible');
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        console.log('File size:', contentLength, 'bytes');
      }
    } else {
      console.log('❌ Cloudinary URL returned error:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Failed to fetch Cloudinary URL:', error.message);
  }
}

// Test environment variables
function testEnvironment() {
  console.log('Testing environment variables...');
  console.log('CLOUDINARY_URL exists:', !!process.env.CLOUDINARY_URL);
  console.log('CLOUD_NAME exists:', !!process.env.CLOUD_NAME);
  console.log('CLOUD_API_KEY exists:', !!process.env.CLOUD_API_KEY);
  console.log('CLOUD_API_SECRET exists:', !!process.env.CLOUD_API_SECRET);

  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      console.log('✅ CLOUDINARY_URL is valid format');
      console.log('Cloud name:', url.hostname);
    } catch (error) {
      console.log('❌ CLOUDINARY_URL is invalid format');
    }
  }
}

// Run tests
console.log('=== Cloudinary Configuration Test ===');
testEnvironment();
console.log('\n=== Cloudinary URL Fetch Test ===');
// Uncomment the line below and replace with actual URL to test
// testCloudinaryFetch();

console.log('\n=== Instructions ===');
console.log('1. Check that environment variables are properly set');
console.log('2. Replace testUrl in testCloudinaryFetch() with an actual Cloudinary URL from your database');
console.log('3. Uncomment the testCloudinaryFetch() call and run again');