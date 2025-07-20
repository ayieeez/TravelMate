const News = require('../models/News');
const newsDataService = require('../services/newsDataService');

// Malaysian states and major cities mapping for precise location matching
const MALAYSIAN_LOCATIONS = {
  'kuala lumpur': { state: 'Federal Territory', coordinates: [3.139, 101.6869] },
  'george town': { state: 'Penang', coordinates: [5.4141, 100.3288] },
  'johor bahru': { state: 'Johor', coordinates: [1.4927, 103.7414] },
  'ipoh': { state: 'Perak', coordinates: [4.5975, 101.0901] },
  'shah alam': { state: 'Selangor', coordinates: [3.0733, 101.5185] },
  'petaling jaya': { state: 'Selangor', coordinates: [3.1073, 101.6067] },
  'kota kinabalu': { state: 'Sabah', coordinates: [5.9749, 116.0724] },
  'kuching': { state: 'Sarawak', coordinates: [1.5533, 110.3593] },
  'malacca': { state: 'Malacca', coordinates: [2.2449, 102.2482] },
  'alor setar': { state: 'Kedah', coordinates: [6.1239, 100.3635] },
  'kota bharu': { state: 'Kelantan', coordinates: [6.1264, 102.2380] },
  'kuantan': { state: 'Pahang', coordinates: [3.8077, 103.3260] },
  'seremban': { state: 'Negeri Sembilan', coordinates: [2.7258, 101.9424] },
  'kangar': { state: 'Perlis', coordinates: [6.4414, 100.1986] },
  'kuala terengganu': { state: 'Terengganu', coordinates: [5.3302, 103.1408] },
  'putrajaya': { state: 'Federal Territory', coordinates: [2.9264, 101.6964] },
  'labuan': { state: 'Federal Territory', coordinates: [5.2767, 115.2417] }
};

// Function to get Malaysian location from coordinates
const getMalaysianLocation = async (lat, lon) => {
  // Define Malaysian coordinate bounds
  const MALAYSIA_BOUNDS = {
    north: 7.5,
    south: 0.8,
    east: 119.5,
    west: 99.5
  };
  
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  
  // Check if coordinates are within Malaysia
  const isInMalaysia = latNum >= MALAYSIA_BOUNDS.south && 
                       latNum <= MALAYSIA_BOUNDS.north && 
                       lonNum >= MALAYSIA_BOUNDS.west && 
                       lonNum <= MALAYSIA_BOUNDS.east;
  
  if (!isInMalaysia) {
    return { 
      country: 'MY', 
      city: 'Kuala Lumpur', 
      state: 'Federal Territory',
      isInMalaysia: false 
    };
  }
  
  // Find closest Malaysian city
  let closestCity = 'Kuala Lumpur';
  let closestState = 'Federal Territory';
  let minDistance = Infinity;
  
  for (const [cityKey, locationData] of Object.entries(MALAYSIAN_LOCATIONS)) {
    const [cityLat, cityLon] = locationData.coordinates;
    const distance = Math.sqrt(
      Math.pow(latNum - cityLat, 2) + Math.pow(lonNum - cityLon, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = cityKey.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      closestState = locationData.state;
    }
  }
  
  return {
    country: 'MY',
    city: closestCity,
    state: closestState,
    isInMalaysia: true
  };
};

// Main endpoint for getting Malaysian news (Database-first approach)
exports.getNews = async (req, res) => {
  const { lat, lon, category = 'all', limit = 50 } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ 
      error: "Latitude and longitude are required",
      message: "Please provide lat and lon parameters for Malaysian location-based news"
    });
  }

  try {
    console.log(`📰 News request for coordinates: ${lat}, ${lon}`);
    
    // Ensure news service is initialized
    if (!newsDataService.isInitialized) {
      console.log('🚀 Initializing news service...');
      await newsDataService.initialize();
    }
    
    // Get Malaysian location from coordinates
    const locationInfo = await getMalaysianLocation(lat, lon);
    console.log(`📍 Location determined: ${locationInfo.city}, ${locationInfo.state}`);
    
    // Get news from database for this location
    const articles = await newsDataService.getNewsForLocation(
      locationInfo.city, 
      locationInfo.state, 
      parseInt(limit)
    );
    
    if (articles.length > 0) {
      console.log(`✅ Returning ${articles.length} articles for ${locationInfo.city}`);
      
      return res.json({
        success: true,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        country: locationInfo.country,
        city: locationInfo.city,
        state: locationInfo.state,
        isInMalaysia: locationInfo.isInMalaysia,
        articles: articles,
        totalResults: articles.length,
        cached: true,
        dataSource: 'in-house-database',
        lastUpdated: new Date(),
        message: locationInfo.isInMalaysia 
          ? `Latest Malaysian news for ${locationInfo.city}` 
          : 'General Malaysian news (location outside Malaysia)'
      });
    }
    
    // If no articles found, trigger a refresh and return what we have
    console.log('📰 No articles found, checking if refresh is needed...');
    
    const stats = await newsDataService.getNewsStatistics();
    const shouldRefresh = !stats.lastFetchTime || 
                         (Date.now() - stats.lastFetchTime.getTime()) > 30 * 60 * 1000; // 30 minutes
    
    if (shouldRefresh) {
      console.log('🔄 Triggering background news refresh...');
      // Trigger background refresh without waiting
      newsDataService.collectAndStoreAllNews().catch(error => {
        console.error('❌ Background refresh failed:', error.message);
      });
    }
    
    // Return empty result with helpful message
    return res.json({
      success: true,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      country: locationInfo.country,
      city: locationInfo.city,
      state: locationInfo.state,
      isInMalaysia: locationInfo.isInMalaysia,
      articles: [],
      totalResults: 0,
      cached: false,
      dataSource: 'in-house-database',
      message: shouldRefresh 
        ? 'Fresh Malaysian news is being fetched. Please try again in a few moments.' 
        : 'No recent news available for this location.',
      refreshing: shouldRefresh,
      statistics: stats
    });
    
  } catch (error) {
    console.error('❌ News controller error:', error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      dataSource: 'in-house-database'
    });
  }
};

// Endpoint to manually refresh Malaysian news
exports.refreshMalaysianNews = async (req, res) => {
  try {
    console.log('🔄 Manual Malaysian news refresh triggered');
    
    // Ensure service is initialized
    if (!newsDataService.isInitialized) {
      await newsDataService.initialize();
    }
    
    const result = await newsDataService.collectAndStoreAllNews();
    
    res.json({
      success: true,
      message: `Successfully fetched and stored Malaysian news`,
      totalArticles: result.totalArticles,
      storedArticles: result.storedArticles,
      duration: result.duration,
      timestamp: new Date(),
      dataSource: 'in-house-database'
    });
  } catch (error) {
    console.error('❌ Manual refresh error:', error.message);
    res.status(500).json({
      success: false,
      error: "Failed to refresh Malaysian news",
      message: error.message,
      dataSource: 'in-house-database'
    });
  }
};

// Endpoint to get Malaysian news statistics
exports.getMalaysianNewsStats = async (req, res) => {
  try {
    const stats = await newsDataService.getNewsStatistics();
    
    res.json({
      success: true,
      ...stats,
      dataSource: 'in-house-database',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Stats error:', error.message);
    res.status(500).json({
      success: false,
      error: "Failed to get Malaysian news statistics",
      message: error.message,
      dataSource: 'in-house-database'
    });
  }
};

// Endpoint to clean old news
exports.cleanOldNews = async (req, res) => {
  try {
    const deletedCount = await newsDataService.cleanOldNews();
    
    res.json({
      success: true,
      message: `Successfully cleaned ${deletedCount} old news articles`,
      deletedCount: deletedCount,
      timestamp: new Date(),
      dataSource: 'in-house-database'
    });
  } catch (error) {
    console.error('❌ Clean old news error:', error.message);
    res.status(500).json({
      success: false,
      error: "Failed to clean old news",
      message: error.message,
      dataSource: 'in-house-database'
    });
  }
};

// Endpoint to get news by category
exports.getNewsByCategory = async (req, res) => {
  const { category, city, state, limit = 20 } = req.query;
  
  try {
    const query = {
      country: 'MY'
    };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (city) {
      query.city = city;
    }
    
    if (state) {
      query.state = state;
    }
    
    const news = await News.find(query)
      .sort({ 'article.publishedAt': -1 })
      .limit(parseInt(limit))
      .lean();
    
    const articles = news.map(item => item.article);
    
    res.json({
      success: true,
      category: category || 'all',
      city: city || 'all',
      state: state || 'all',
      articles: articles,
      totalResults: articles.length,
      dataSource: 'in-house-database',
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Category news error:', error.message);
    res.status(500).json({
      success: false,
      error: "Failed to get news by category",
      message: error.message,
      dataSource: 'in-house-database'
    });
  }
};
