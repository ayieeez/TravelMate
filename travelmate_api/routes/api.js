const express = require('express');
const router = express.Router();
const { getWeather } = require('../controllers/weatherController');
const { getNearbyPlaces, refreshPlacesData } = require('../controllers/placesController');
const { getExchangeRate } = require('../controllers/currencyController');
const { getNews, refreshMalaysianNews, getMalaysianNewsStats, cleanOldNews, getNewsByCategory } = require('../controllers/newsController');

// Existing routes
router.get('/weather', getWeather);
router.get('/places', getNearbyPlaces);
router.get('/currency', getExchangeRate);

// Malaysian news routes
router.get('/news', getNews);
router.post('/news/refresh', refreshMalaysianNews);
router.get('/news/stats', getMalaysianNewsStats);
router.delete('/news/clean', cleanOldNews);
router.get('/news/category', getNewsByCategory);

// Debug endpoint for news service troubleshooting
router.get('/news/debug', async (req, res) => {
  try {
    const newsDataService = require('../services/newsDataService');
    
    // Check environment variables
    const hasNewsApiKey = !!process.env.NEWS_API_KEY;
    const hasMongoUri = !!process.env.MONGODB_URI;
    
    // Check service status
    const isInitialized = newsDataService.isInitialized;
    
    // Get basic stats
    const stats = await newsDataService.getNewsStatistics();
    
    // Test news collection (just one query)
    let testResult = null;
    try {
      if (hasNewsApiKey) {
        const testArticles = await newsDataService.fetchNewsForQuery('Malaysia', process.env.NEWS_API_KEY);
        testResult = {
          articlesFound: testArticles.length,
          sampleTitle: testArticles[0]?.title || 'No articles found'
        };
      }
    } catch (testError) {
      testResult = { error: testError.message };
    }
    
    res.json({
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasNewsApiKey,
        hasMongoUri,
        newsApiKeyLength: process.env.NEWS_API_KEY ? process.env.NEWS_API_KEY.length : 0
      },
      service: {
        isInitialized,
        lastFetchTime: newsDataService.lastFetchTime
      },
      database: stats,
      apiTest: testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Force news initialization endpoint
router.post('/news/force-init', async (req, res) => {
  try {
    const newsDataService = require('../services/newsDataService');
    
    // Reset initialization status
    newsDataService.isInitialized = false;
    
    // Force initialize
    await newsDataService.initialize();
    
    // Get stats
    const stats = await newsDataService.getNewsStatistics();
    
    res.json({
      message: 'News service force-initialized',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Force initialization failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// New routes for places data management
router.post('/places/refresh', refreshPlacesData);

// New route for data collection (admin use)
router.post('/places/collect', async (req, res) => {
  const { lat, lon, radius = 5000, category = 'all' } = req.body;
  
  try {
    const placesDataService = require('../services/placesDataService');
    const result = await placesDataService.collectAndStoreData(
      parseFloat(lat), 
      parseFloat(lon), 
      parseInt(radius), 
      category
    );
    
    res.json({
      message: 'Data collection completed',
      collected: result.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Data collection failed', message: error.message });
  }
});

// MongoDB logging endpoints
router.post('/recent-location', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();
    const collection = db.collection('recent_locations');
    
    await collection.replaceOne(
      { locKey: req.body.locKey },
      req.body,
      { upsert: true }
    );
    
    await client.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/weather-log', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();
    const collection = db.collection('weather_logs');
    
    await collection.insertOne(req.body);
    
    await client.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/places-log', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();
    const collection = db.collection('places_logs');
    
    await collection.insertOne(req.body);
    
    await client.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;