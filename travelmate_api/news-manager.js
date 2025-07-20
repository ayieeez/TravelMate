require('dotenv').config({ path: __dirname + '/.env' });

const newsDataService = require('./services/newsDataService');
const connectDB = require('./config/db');

async function newsManager() {
  try {
    const command = process.argv[2];
    
    if (!command) {
      console.log('📰 TravelMate News Manager');
      console.log('=========================\n');
      console.log('Available commands:');
      console.log('  node news-manager.js init      - Initialize news service and fetch initial data');
      console.log('  node news-manager.js refresh   - Refresh all news data');
      console.log('  node news-manager.js stats     - Show news statistics');
      console.log('  node news-manager.js clean     - Clean old news articles');
      console.log('  node news-manager.js test      - Test news retrieval for different locations');
      return;
    }
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    switch (command.toLowerCase()) {
      case 'init':
        console.log('🚀 Initializing News Service...');
        await newsDataService.initialize();
        console.log('✅ News service initialization complete');
        break;
        
      case 'refresh':
        console.log('🔄 Refreshing news data...');
        const result = await newsDataService.collectAndStoreAllNews();
        console.log(`✅ Refresh complete: ${result.totalArticles} fetched, ${result.storedArticles} stored`);
        break;
        
      case 'stats':
        console.log('📊 News Statistics:');
        const stats = await newsDataService.getNewsStatistics();
        console.log(`   Total articles: ${stats.totalArticles}`);
        console.log(`   Recent articles (24h): ${stats.recentArticles}`);
        console.log(`   Last fetch: ${stats.lastFetchTime || 'Never'}`);
        console.log(`   Service initialized: ${stats.isInitialized}`);
        
        if (stats.locationBreakdown && stats.locationBreakdown.length > 0) {
          console.log('\n📍 Location breakdown:');
          stats.locationBreakdown.forEach(loc => {
            console.log(`   ${loc._id.city}, ${loc._id.state}: ${loc.count} articles`);
          });
        }
        break;
        
      case 'clean':
        console.log('🧹 Cleaning old news articles...');
        const deletedCount = await newsDataService.cleanOldNews();
        console.log(`✅ Cleaned ${deletedCount} old articles`);
        break;
        
      case 'test':
        console.log('🧪 Testing news retrieval...');
        const testLocations = [
          { city: 'Kuala Lumpur', state: 'Federal Territory' },
          { city: 'George Town', state: 'Penang' },
          { city: 'Johor Bahru', state: 'Johor' }
        ];
        
        for (const location of testLocations) {
          console.log(`\n📍 ${location.city}, ${location.state}:`);
          const articles = await newsDataService.getNewsForLocation(location.city, location.state, 3);
          console.log(`   Found ${articles.length} articles`);
          
          articles.forEach((article, index) => {
            console.log(`   ${index + 1}. ${article.title}`);
            console.log(`      Source: ${article.source.name}`);
            console.log(`      Published: ${new Date(article.publishedAt).toLocaleString()}`);
          });
        }
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Run without arguments to see available commands');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

newsManager();
