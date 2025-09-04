#!/usr/bin/env node

const axios = require('axios');
const { PlaywrightConsoleCapture } = require('../test-utils');

/**
 * Test UI functionality and API endpoints
 */
async function testUI() {
  console.log('🧪 Testing Flash Loan Bot UI...\n');
  
  const baseURL = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  // Test 1: Health Check
  console.log('1️⃣  Testing Health Endpoint...');
  try {
    const response = await axios.get(`${baseURL}/health`);
    if (response.status === 200 && response.data.status === 'OK') {
      console.log('✅ Health check passed');
      passed++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    failed++;
  }

  // Test 2: UI Loading
  console.log('\n2️⃣  Testing UI Loading...');
  try {
    const response = await axios.get(baseURL);
    if (response.status === 200 && response.data.includes('Flash Loan Arbitrage Bot')) {
      console.log('✅ UI loads successfully');
      passed++;
    } else {
      throw new Error('UI content not found');
    }
  } catch (error) {
    console.log('❌ UI loading failed:', error.message);
    failed++;
  }

  // Test 3: API Endpoints
  console.log('\n3️⃣  Testing API Endpoints...');
  const endpoints = [
    { method: 'GET', url: '/api/opportunities', name: 'Opportunities' },
    { method: 'GET', url: '/api/prices', name: 'Prices' },
    { method: 'GET', url: '/api/stats', name: 'Statistics' },
    { method: 'POST', url: '/api/start', name: 'Start Trading' },
    { method: 'POST', url: '/api/pause', name: 'Pause Trading' },
    { method: 'POST', url: '/api/stop', name: 'Stop Trading' },
    { method: 'POST', url: '/api/emergency-stop', name: 'Emergency Stop' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method.toLowerCase(),
        url: `${baseURL}${endpoint.url}`
      });
      
      if (response.status === 200) {
        console.log(`✅ ${endpoint.name}: ${response.status}`);
        passed++;
      } else {
        throw new Error(`Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.message}`);
      failed++;
    }
  }

  // Test 4: Data Format Validation
  console.log('\n4️⃣  Testing Data Formats...');
  try {
    const [opportunities, prices, stats] = await Promise.all([
      axios.get(`${baseURL}/api/opportunities`),
      axios.get(`${baseURL}/api/prices`),
      axios.get(`${baseURL}/api/stats`)
    ]);

    // Validate opportunities format
    if (Array.isArray(opportunities.data.opportunities)) {
      console.log('✅ Opportunities data format valid');
      passed++;
    } else {
      throw new Error('Invalid opportunities format');
    }

    // Validate prices format
    if (Array.isArray(prices.data.prices)) {
      console.log('✅ Prices data format valid');
      passed++;
    } else {
      throw new Error('Invalid prices format');
    }

    // Validate stats format
    if (stats.data.trading && stats.data.mode) {
      console.log('✅ Statistics data format valid');
      passed++;
    } else {
      throw new Error('Invalid stats format');
    }
  } catch (error) {
    console.log('❌ Data format validation failed:', error.message);
    failed += 3;
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! UI is ready for use.');
    console.log(`🌐 Access the UI at: ${baseURL}`);
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
    return false;
  }
}

if (require.main === module) {
  testUI()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed with error:', error);
      process.exit(1);
    });
}

module.exports = { testUI };