const mongoose = require('mongoose');

const PlaceSchema = new mongoose.Schema({
  name: String,
  address: String,
  distance: String,
  type: String,
  lat: Number,
  lon: Number,
  fetchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Place', PlaceSchema);
