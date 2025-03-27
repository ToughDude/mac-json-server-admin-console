const axios = require('axios');

async function testEndpoint(page) {
  try {
    const response = await axios({
      method: 'get',
      url: 'http://localhost:3001/v2/organizations/38811A2C67D7F3390A49421E@AdobeOrg/roles',
      params: {
        page,
        page_size: 1,
        filter_include_namespace: 'education'
      },
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en_US',
        'X-Api-Key': 'ONESIE1',
        'Authorization': 'Bearer token'
      }
    });

    console.log(`\n=== Testing Page ${page} ===`);
    console.log('Response Headers:', response.headers);
    console.log('\nResponse Data:', JSON.stringify(response.data, null, 2));
    console.log('========================\n');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
  }
}

async function runTests() {
  // Test page 1
  await testEndpoint(1);
  // Test page 2
  await testEndpoint(2);
}

runTests(); 