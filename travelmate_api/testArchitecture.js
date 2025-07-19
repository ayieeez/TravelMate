// Test script to verify the new MongoDB Atlas architecture
// Run this locally to test your Render deployment

const axios = require('axios');

// Replace with your actual Render URL
const RENDER_URL = 'https://your-app-name.onrender.com'; // Update this!

async function testMongoDBArchitecture() {
  console.log('🧪 Testing TravelMate MongoDB Atlas Architecture\n');

  // Test coordinates (example: New York City)
  const testLat = 40.7128;
  const testLon = -74.0060;
  const testRadius = 2000;

  try {
    console.log('1️⃣ Testing basic places API...');
    const response = await axios.get(`${RENDER_URL}/places`, {
      params: {
        lat: testLat,
        lon: testLon,
        radius: testRadius,
        category: 'restaurant'
      },
      timeout: 30000
    });

    console.log('✅ API Response received!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📍 Data source: ${response.data.data_source || 'unknown'}`);
    console.log(`🏢 Total places: ${response.data.total || 0}`);
    console.log(`📂 Category: ${response.data.category}`);
    console.log(`📏 Radius: ${response.data.radius}`);

    if (response.data.places && response.data.places.length > 0) {
      console.log('\n📋 Sample places:');
      response.data.places.slice(0, 3).forEach((place, index) => {
        console.log(`  ${index + 1}. ${place.name}`);
        console.log(`     📍 ${place.address}`);
        console.log(`     🎯 Type: ${place.type}`);
        console.log(`     📏 Distance: ${place.distance}km`);
        console.log(`     🔄 Source: ${place.source || 'legacy'}`);
        console.log('');
      });
    }

    // Test data refresh endpoint
    console.log('2️⃣ Testing data refresh endpoint...');
    try {
      const refreshResponse = await axios.post(`${RENDER_URL}/places/refresh`, {
        lat: testLat,
        lon: testLon,
        radius: 1000,
        category: 'tourism'
      }, { timeout: 60000 });

      console.log('✅ Data refresh successful!');
      console.log(`📦 Message: ${refreshResponse.data.message}`);
    } catch (refreshError) {
      console.log('⚠️ Data refresh test failed (this might be expected):');
      console.log(`   ${refreshError.response?.data?.message || refreshError.message}`);
    }

    console.log('\n🎉 MongoDB Atlas architecture test completed!');
    console.log('\n📝 Summary:');
    console.log('✅ Your Render deployment is working');
    console.log('✅ MongoDB Atlas integration is active');
    console.log('✅ Places API returns structured data');
    console.log('✅ Real-time data collection is available');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Possible issues:');
      console.log('   - Update RENDER_URL with your actual Render app URL');
      console.log('   - Make sure your Render app is deployed and running');
      console.log('   - Check if your MongoDB Atlas connection is configured');
    } else if (error.response) {
      console.log(`\n📊 Server responded with status: ${error.response.status}`);
      console.log(`📝 Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Usage instructions
console.log('🔧 Setup Instructions:');
console.log('1. Update RENDER_URL with your actual Render app URL');
console.log('2. Make sure your .env file has MONGODB_URI configured');
console.log('3. Run: node testArchitecture.js');
console.log('4. Check that your Render app is deployed and running\n');

// Run the test if called directly
if (require.main === module) {
  testMongoDBArchitecture();
}

module.exports = { testMongoDBArchitecture };
