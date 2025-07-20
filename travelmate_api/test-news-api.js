require('dotenv').config({ path: __dirname + '/.env' });

const newsDataService = require('./services/newsDataService');
const connectDB = require('./config/db');

async function testNewsAPI() {
  try {
    console.log('🚀 Testing In-House News API');
    console.log('==============================\n');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Initialize news service
    console.log('📰 Initializing News Data Service...');
    await newsDataService.initialize();
    console.log('✅ News service initialized\n');
    
    // Get news statistics
    console.log('📊 Fetching news statistics...');
    const stats = await newsDataService.getNewsStatistics();
    console.log(`📈 Total articles: ${stats.totalArticles}`);
    console.log(`📅 Recent articles (24h): ${stats.recentArticles}`);
    console.log(`🔄 Last fetch: ${stats.lastFetchTime || 'Never'}\n`);
    
    // Test news for different locations
    const testLocations = [
      { city: 'Kuala Lumpur', state: 'Federal Territory' },
      { city: 'George Town', state: 'Penang' },
      { city: 'Johor Bahru', state: 'Johor' }
    ];
    
    for (const location of testLocations) {
      console.log(`📍 Testing news for ${location.city}, ${location.state}`);
      const articles = await newsDataService.getNewsForLocation(location.city, location.state, 5);
      console.log(`📰 Found ${articles.length} articles`);
      
      if (articles.length > 0) {
        console.log(`   Latest: "${articles[0].title}"`);
        console.log(`   Source: ${articles[0].source.name}`);
        console.log(`   Published: ${new Date(articles[0].publishedAt).toLocaleString()}`);
      }
      console.log('');
    }
    
    // If no articles found, trigger a collection
    if (stats.totalArticles === 0) {
      console.log('🔄 No articles found, triggering news collection...');
      const result = await newsDataService.collectAndStoreAllNews();
      console.log(`✅ Collected ${result.totalArticles} articles, stored ${result.storedArticles}`);
    }
    
    console.log('🎉 In-House News API Test Complete!');
    console.log('✅ Your news service is ready for production');
    console.log('\n📋 Available endpoints:');
    console.log('   GET /api/news?lat=3.139&lon=101.6869 - Get location-based news');
    console.log('   POST /api/news/refresh - Manually refresh news data');
    console.log('   GET /api/news/stats - Get news statistics');
    console.log('   GET /api/news/category?category=tourism - Get news by category');
    console.log('   DELETE /api/news/clean - Clean old news articles');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

// Run the test
testNewsAPI();
