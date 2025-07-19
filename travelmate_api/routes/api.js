const express = require('express');
const router = express.Router();
const { getWeather } = require('../controllers/weatherController');
const { getNearbyPlaces, refreshPlacesData } = require('../controllers/placesController');
const { getExchangeRate } = require('../controllers/currencyController');

// Existing routes
router.get('/weather', getWeather);
router.get('/places', getNearbyPlaces);
router.get('/currency', getExchangeRate);

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