const mongoose = require('mongoose');

const PlaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  type: { type: String, required: true },
  category: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  distance: { type: Number }, // Distance from search center in meters
  rating: { type: Number },
  opening_hours: { type: String },
  
  // Additional data from APIs
  source: { type: String, enum: ['overpass', 'nominatim'], required: true },
  source_id: { type: String }, // Original ID from API
  tags: { type: Map, of: String }, // Original tags from OSM
  
  // Search metadata
  search_center: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  search_radius: { type: Number, required: true },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Indexes for performance
PlaceSchema.index({ location: '2dsphere' }); // Geospatial index
PlaceSchema.index({ search_center: 1, search_radius: 1 }); // Search optimization
PlaceSchema.index({ category: 1, type: 1 }); // Category filtering
PlaceSchema.index({ created_at: -1 }); // Recent data first

module.exports = mongoose.model('Place', PlaceSchema);
