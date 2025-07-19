const express = require('express');
const router = express.Router();
const { getWeather } = require('../controllers/weatherController');
const { getNearbyPlaces } = require('../controllers/placesController');
const { getExchangeRate } = require('../controllers/currencyController');

router.get('/weather', getWeather);
router.get('/places', getNearbyPlaces);
router.get('/currency', getExchangeRate);

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

module.exports = router;