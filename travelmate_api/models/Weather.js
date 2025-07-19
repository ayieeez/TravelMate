const mongoose = require('mongoose');

const WeatherSchema = new mongoose.Schema({
  city: String,
  country: String,
  lat: Number,
  lon: Number,
  temp: Number,
  description: String,
  icon: String,
  humidity: Number,
  fetchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Weather', WeatherSchema);
