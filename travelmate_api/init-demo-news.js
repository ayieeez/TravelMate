require('dotenv').config({ path: __dirname + '/.env' });

const News = require('./models/News');
const connectDB = require('./config/db');

// Sample Malaysian news data for testing
const SAMPLE_NEWS_DATA = [
  {
    country: 'MY',
    city: 'Kuala Lumpur',
    state: 'Federal Territory',
    category: 'general',
    article: {
      title: "Malaysia's Digital Economy Initiative Shows Strong Growth in 2025",
      description: "Malaysia's digital transformation continues to accelerate with new government initiatives driving economic growth and technological advancement across key sectors.",
      url: "https://example.com/malaysia-digital-economy-2025",
      urlToImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
      publishedAt: new Date(),
      source: { name: "Malaysia Digital Economy Corporation" },
      content: "Malaysia's digital economy initiative has shown remarkable progress in 2025, with significant investments in technology infrastructure and digital skills development programs."
    }
  },
  {
    country: 'MY',
    city: 'George Town',
    state: 'Penang',
    category: 'tourism',
    article: {
      title: "Penang Heritage Sites Receive UNESCO Recognition for Conservation Efforts",
      description: "George Town's historic quarter has been praised by UNESCO for its outstanding preservation efforts and sustainable tourism practices in 2025.",
      url: "https://example.com/penang-unesco-heritage-2025",
      urlToImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800",
      publishedAt: new Date(Date.now() - 3600000),
      source: { name: "Penang Tourism Board" },
      content: "The historic city of George Town continues to set an example for heritage conservation and sustainable tourism development in Southeast Asia."
    }
  },
  {
    country: 'MY',
    city: 'Johor Bahru',
    state: 'Johor',
    category: 'economy',
    article: {
      title: "Johor Economic Development Accelerates with New Industrial Projects",
      description: "Johor Bahru announces major industrial development projects that will boost the state's economy and create thousands of new jobs in 2025.",
      url: "https://example.com/johor-economic-development-2025",
      urlToImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
      publishedAt: new Date(Date.now() - 7200000),
      source: { name: "Johor Economic Development Authority" },
      content: "Johor's strategic location and business-friendly policies continue to attract international investments and drive economic growth."
    }
  },
  {
    country: 'MY',
    city: 'Kuala Lumpur',
    state: 'Federal Territory',
    category: 'technology',
    article: {
      title: "Malaysia Launches National AI Strategy for Sustainable Development",
      description: "The Malaysian government unveils a comprehensive artificial intelligence strategy aimed at sustainable development and digital transformation by 2030.",
      url: "https://example.com/malaysia-ai-strategy-2025",
      urlToImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
      publishedAt: new Date(Date.now() - 10800000),
      source: { name: "Ministry of Science, Technology and Innovation" },
      content: "Malaysia's AI strategy focuses on ethical AI development, digital inclusion, and sustainable technology solutions for national development."
    }
  },
  {
    country: 'MY',
    city: 'Kuala Lumpur',
    state: 'Federal Territory',
    category: 'tourism',
    article: {
      title: "Visit Malaysia Year 2025 Campaign Exceeds Tourism Targets",
      description: "Malaysia's tourism industry celebrates record-breaking visitor numbers and revenue in the first half of 2025, surpassing pre-pandemic levels.",
      url: "https://example.com/visit-malaysia-2025-success",
      urlToImage: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800",
      publishedAt: new Date(Date.now() - 14400000),
      source: { name: "Tourism Malaysia" },
      content: "The Visit Malaysia Year 2025 campaign has successfully positioned Malaysia as a premier tourist destination in Southeast Asia with innovative tourism products."
    }
  },
  {
    country: 'MY',
    city: 'George Town',
    state: 'Penang',
    category: 'culture',
    article: {
      title: "Penang Food Festival 2025 Celebrates Malaysian Culinary Heritage",
      description: "George Town hosts the largest food festival in Malaysia, showcasing traditional and modern Malaysian cuisine from across the country.",
      url: "https://example.com/penang-food-festival-2025",
      urlToImage: "https://images.unsplash.com/photo-1564759224907-65b47b8b1fa3?w=800",
      publishedAt: new Date(Date.now() - 18000000),
      source: { name: "Penang State Tourism" },
      content: "The festival brings together renowned chefs, local food vendors, and culinary enthusiasts to celebrate Malaysia's rich food culture and heritage."
    }
  }
];

async function initializeDemoNews() {
  try {
    console.log('🚀 Initializing Demo News Data');
    console.log('===============================\n');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Check if demo data already exists
    const existingNews = await News.countDocuments();
    console.log(`📊 Current news articles in database: ${existingNews}`);
    
    if (existingNews === 0) {
      console.log('📰 No existing news found, inserting demo data...');
      
      // Insert sample news data
      let insertedCount = 0;
      for (const newsItem of SAMPLE_NEWS_DATA) {
        try {
          const news = new News(newsItem);
          await news.save();
          insertedCount++;
          console.log(`✅ Inserted: ${newsItem.article.title.substring(0, 50)}...`);
        } catch (error) {
          console.log(`⚠️ Skipped duplicate: ${newsItem.article.title.substring(0, 30)}...`);
        }
      }
      
      console.log(`\n🎉 Demo data initialization complete!`);
      console.log(`📊 Inserted ${insertedCount} news articles`);
    } else {
      console.log('📰 News data already exists in database');
    }
    
    // Create indexes for better performance
    try {
      await News.collection.createIndex({ country: 1, city: 1, 'article.publishedAt': -1 });
      console.log('✅ News indexes created');
    } catch (error) {
      console.log('⚠️ Indexes already exist or failed to create');
    }
    
    // Test news retrieval
    console.log('\n🧪 Testing news retrieval:');
    const testLocations = [
      { city: 'Kuala Lumpur', state: 'Federal Territory' },
      { city: 'George Town', state: 'Penang' },
      { city: 'Johor Bahru', state: 'Johor' }
    ];
    
    for (const location of testLocations) {
      const articles = await News.find({
        country: 'MY',
        $or: [
          { city: location.city },
          { state: location.state }
        ]
      }).sort({ 'article.publishedAt': -1 }).limit(3);
      
      console.log(`\n📍 ${location.city}, ${location.state}: ${articles.length} articles`);
      articles.forEach((article, index) => {
        console.log(`   ${index + 1}. ${article.article.title}`);
        console.log(`      Category: ${article.category}`);
        console.log(`      Source: ${article.article.source.name}`);
      });
    }
    
    console.log('\n🎉 Demo News Service Ready!');
    console.log('=============================');
    console.log('✅ Your in-house news API is now functional');
    console.log('✅ Demo data has been loaded into MongoDB');
    console.log('✅ Flutter app can now fetch news from your database');
    console.log('\n📋 Next steps:');
    console.log('1. Start your API server: npm start');
    console.log('2. Test the news endpoint: GET /api/news?lat=3.139&lon=101.6869');
    console.log('3. Get a NewsAPI key from https://newsapi.org/ for live data');
    console.log('4. Add the key to your .env file: NEWS_API_KEY=your_key_here');
    
  } catch (error) {
    console.error('❌ Demo initialization failed:', error.message);
  } finally {
    process.exit(0);
  }
}

// Run the demo initialization
initializeDemoNews();
