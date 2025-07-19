// Set working directory to script location
process.chdir(__dirname);
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database and Index Initialization
async function initializeApp() {
  try {
    // Connect to database
    await connectDB();
    
    // Initialize indexes for better performance
    const Place = require('./models/Place');
    console.log('Initializing database indexes...');
    
    try {
      await Place.collection.createIndex({ location: '2dsphere' });
      console.log('✅ Geospatial index ready');
    } catch (indexError) {
      console.log('⚠️ Geospatial index already exists or failed to create');
    }
    
    try {
      await Place.collection.createIndex({ category: 1, type: 1 });
      console.log('✅ Category index ready');
    } catch (indexError) {
      console.log('⚠️ Category index already exists or failed to create');
    }
    
    try {
      await Place.collection.createIndex({ created_at: -1 });
      console.log('✅ Timestamp index ready');
    } catch (indexError) {
      console.log('⚠️ Timestamp index already exists or failed to create');
    }
    
    console.log('🎉 Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    // Continue anyway - the app can still function
  }
}

// Initialize app
initializeApp();

// Routes
app.use('/api', apiRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));