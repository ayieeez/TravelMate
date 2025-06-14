const express = require('express');
const router = express.Router();
const { getWeather } = require('../controllers/weatherController');
const { getNearbyPlaces } = require('../controllers/placesController');
const { getExchangeRate } = require('../controllers/currencyController');

router.get('/weather', getWeather);
router.get('/places', getNearbyPlaces);
router.get('/currency', getExchangeRate);

module.exports = router;