require('dotenv').config({ path: __dirname + '/.env' });
console.log('Environment variables loaded:');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('NEWS_API_KEY:', process.env.NEWS_API_KEY ? 'Set' : 'Not set');
console.log('OPENWEATHER_API_KEY:', process.env.OPENWEATHER_API_KEY ? 'Set' : 'Not set');

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin']
}));
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

    // Initialize News indexes
    const News = require('./models/News');
    try {
      await News.collection.createIndex({ country: 1, city: 1, 'article.publishedAt': -1 });
      console.log('✅ News location index ready');
    } catch (indexError) {
      console.log('⚠️ News location index already exists or failed to create');
    }

    try {
      await News.collection.createIndex({ category: 1, 'article.publishedAt': -1 });
      console.log('✅ News category index ready');
    } catch (indexError) {
      console.log('⚠️ News category index already exists or failed to create');
    }

    // Initialize News Data Service
    console.log('🚀 Initializing News Data Service...');
    const newsDataService = require('./services/newsDataService');
    await newsDataService.initialize();
    
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

// Serve static files with absolute path
app.use(express.static(path.join(__dirname, 'public')));

// Root route for testing
app.get('/', (req, res) => {
  res.send('<h1>Malaysian News API Server</h1><p>Visit <a href="/test-news.html">/test-news.html</a> to test the news API</p>');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));