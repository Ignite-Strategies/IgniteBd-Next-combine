/**
 * Quick diagnostic script to test persona API connection
 * Run: node scripts/test-persona-connection.js
 */

const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

console.log('🔍 Testing Persona API Connection...\n');

// Test 1: Check if server is running
console.log('1. Testing server availability...');
const testServer = http.get(`http://${HOST}:${PORT}/api/personas/generate-minimal`, (res) => {
  console.log(`   ✅ Server is responding (Status: ${res.statusCode})`);
  console.log(`   📝 Note: Expected 401 (Unauthorized) without auth token\n`);
  
  // Test 2: Check environment variables
  console.log('2. Checking environment variables...');
  const requiredVars = ['OPENAI_API_KEY', 'DATABASE_URL'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length === 0) {
    console.log('   ✅ All required environment variables are set');
  } else {
    console.log(`   ⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.log('   📝 Make sure .env.local file exists with these variables\n');
  }
  
  console.log('\n✅ Basic connectivity test complete!');
  console.log('📝 If you\'re seeing errors in the browser:');
  console.log('   1. Open browser DevTools (F12)');
  console.log('   2. Check Console tab for JavaScript errors');
  console.log('   3. Check Network tab for failed API requests');
  console.log('   4. Look for 401 (auth), 500 (server), or CORS errors');
  
  process.exit(0);
});

testServer.on('error', (err) => {
  console.log(`   ❌ Server is not responding: ${err.message}`);
  console.log('   📝 Make sure the dev server is running: npm run dev\n');
  process.exit(1);
});

testServer.setTimeout(5000, () => {
  console.log('   ❌ Server connection timeout');
  process.exit(1);
});

