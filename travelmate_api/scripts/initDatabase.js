const mongoose = require('mongoose');
const Place = require('../models/Place');
require('dotenv').config();

// Database initialization script
async function initializeDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas successfully!');

    // Create indexes for better performance
    console.log('Creating database indexes...');
    
    // Geospatial index for location-based queries
    await Place.collection.createIndex({ location: '2dsphere' });
    console.log('✓ Created geospatial index on location field');

    // Compound index for search optimization
    await Place.collection.createIndex({ 
      'search_center.latitude': 1, 
      'search_center.longitude': 1, 
      search_radius: 1 
    });
    console.log('✓ Created compound index for search optimization');

    // Category and type index for filtering
    await Place.collection.createIndex({ category: 1, type: 1 });
    console.log('✓ Created index for category filtering');

    // Timestamp index for data freshness
    await Place.collection.createIndex({ created_at: -1 });
    console.log('✓ Created index for timestamp ordering');

    // Check current data
    const totalPlaces = await Place.countDocuments();
    console.log(`\nDatabase Status:`);
    console.log(`📍 Total places in database: ${totalPlaces}`);

    if (totalPlaces > 0) {
      const categories = await Place.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      console.log(`\nBreakdown by category:`);
      categories.forEach(cat => {
        console.log(`  ${cat._id}: ${cat.count} places`);
      });

      const recentData = await Place.countDocuments({
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      console.log(`\nRecent data (last 24 hours): ${recentData} places`);
    }

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\nYour TravelMate app is now ready to use MongoDB Atlas for places data.');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
  }
}

// Run the initialization
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
