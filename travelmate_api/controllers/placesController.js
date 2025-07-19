const Place = require('../models/Place');
const placesDataService = require('../services/placesDataService');

exports.getNearbyPlaces = async (req, res) => {
  const { lat, lon, radius = 1000, category = 'all' } = req.query;

  try {
    console.log(`Fetching places from MongoDB: ${category} within ${radius}m of ${lat}, ${lon}`);
    
    // Ensure geospatial index exists before querying
    await ensureGeospatialIndex();
    
    // First, try to get data from MongoDB Atlas
    let places;
    try {
      places = await Place.find({
        $and: [
          {
            location: {
              $near: {
                $geometry: { type: 'Point', coordinates: [parseFloat(lon), parseFloat(lat)] },
                $maxDistance: parseInt(radius)
              }
            }
          },
          category === 'all' ? {} : { category: category }
        ]
      })
      .sort({ distance: 1 }) // Sort by distance
      .limit(25); // Limit results
    } catch (geoQueryError) {
      console.log('Geospatial query failed, using fallback method:', geoQueryError.message);
      
      // Fallback: Use basic query without geospatial operations
      places = await Place.find(
        category === 'all' ? {} : { category: category }
      )
      .limit(50); // Get more for manual filtering
      
      // Manual distance filtering
      places = places.filter(place => {
        if (!place.location || !place.location.coordinates) return false;
        const distance = calculateDistance(
          parseFloat(lat), parseFloat(lon),
          place.location.coordinates[1], place.location.coordinates[0]
        );
        return distance <= parseInt(radius);
      })
      .sort((a, b) => {
        const distA = calculateDistance(
          parseFloat(lat), parseFloat(lon),
          a.location.coordinates[1], a.location.coordinates[0]
        );
        const distB = calculateDistance(
          parseFloat(lat), parseFloat(lon),
          b.location.coordinates[1], b.location.coordinates[0]
        );
        return distA - distB;
      })
      .slice(0, 25);
    }

    console.log(`Found ${places.length} places in MongoDB Atlas`);

    // If we don't have enough recent data, collect fresh data
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hasRecentData = places.some(place => place.created_at > oneDayAgo);
    
    if (places.length < 5 || !hasRecentData) {
      console.log('Collecting fresh data from external APIs...');
      try {
        const freshPlaces = await placesDataService.collectAndStoreData(
          parseFloat(lat), 
          parseFloat(lon), 
          parseInt(radius), 
          category
        );
        
        // Re-query MongoDB to get the latest data
        places = await Place.find({
          $and: [
            {
              location: {
                $near: {
                  $geometry: { type: 'Point', coordinates: [parseFloat(lon), parseFloat(lat)] },
                  $maxDistance: parseInt(radius)
                }
              }
            },
            category === 'all' ? {} : { category: category }
          ]
        })
        .sort({ distance: 1 })
        .limit(25);
        
        console.log(`Updated results: ${places.length} places from MongoDB Atlas`);
      } catch (dataCollectionError) {
        console.error('Fresh data collection failed:', dataCollectionError.message);
        // Continue with existing data if fresh collection fails
      }
    }

    // Format response for frontend
    const formattedPlaces = places.map(place => ({
      name: place.name,
      address: place.address,
      distance: (place.distance / 1000).toFixed(1), // Convert to km
      type: place.type,
      category: place.category,
      lat: place.location.coordinates[1], // latitude
      lon: place.location.coordinates[0], // longitude
      rating: place.rating,
      opening_hours: place.opening_hours,
      source: place.source,
      updated: place.updated_at
    }));

    // Return standardized response
    res.json({
      places: formattedPlaces,
      total: formattedPlaces.length,
      category: category,
      radius: `${radius}m`,
      center: { lat: parseFloat(lat), lon: parseFloat(lon) },
      data_source: 'mongodb_atlas',
      last_updated: places.length > 0 ? places[0].updated_at : null
    });

  } catch (error) {
    console.error('Places MongoDB Error:', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: "Failed to fetch places from database", 
      message: "Please try again later",
      places: [],
      debug: error.message
    });
  }
};

// New endpoint to manually refresh data for a location
exports.refreshPlacesData = async (req, res) => {
  const { lat, lon, radius = 5000, category = 'all' } = req.body;

  try {
    console.log(`Manually refreshing data for ${lat}, ${lon}`);
    
    const freshPlaces = await placesDataService.collectAndStoreData(
      parseFloat(lat), 
      parseFloat(lon), 
      parseInt(radius), 
      category
    );

    res.json({
      message: `Successfully refreshed ${freshPlaces.length} places`,
      places: freshPlaces.length,
      category: category,
      radius: `${radius}m`
    });

  } catch (error) {
    console.error('Manual refresh failed:', error);
    res.status(500).json({
      error: 'Failed to refresh places data',
      message: error.message
    });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Ensure geospatial index exists for MongoDB queries
async function ensureGeospatialIndex() {
  try {
    // Check if the index already exists
    const indexes = await Place.collection.getIndexes();
    const hasGeoIndex = Object.keys(indexes).some(indexName => 
      indexes[indexName].some(field => field[0] === 'location' && field[1] === '2dsphere')
    );

    if (!hasGeoIndex) {
      console.log('Creating geospatial index for location field...');
      await Place.collection.createIndex({ location: '2dsphere' });
      console.log('✅ Geospatial index created successfully');
    }
  } catch (error) {
    console.error('Failed to create geospatial index:', error.message);
    // Continue without index - queries will be slower but still work with alternative approach
  }
}
