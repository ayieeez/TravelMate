const axios = require('axios');
const News = require('../models/News');

// Malaysian states and major cities mapping for precise location matching
const MALAYSIAN_LOCATIONS = {
  'kuala lumpur': { state: 'Federal Territory', keywords: ['kuala lumpur', 'kl', 'klang valley', 'selangor'] },
  'george town': { state: 'Penang', keywords: ['george town', 'penang', 'pulau pinang'] },
  'johor bahru': { state: 'Johor', keywords: ['johor bahru', 'jb', 'johor', 'southern malaysia'] },
  'ipoh': { state: 'Perak', keywords: ['ipoh', 'perak'] },
  'shah alam': { state: 'Selangor', keywords: ['shah alam', 'selangor', 'klang valley'] },
  'petaling jaya': { state: 'Selangor', keywords: ['petaling jaya', 'pj', 'selangor', 'klang valley'] },
  'kota kinabalu': { state: 'Sabah', keywords: ['kota kinabalu', 'kk', 'sabah', 'east malaysia'] },
  'kuching': { state: 'Sarawak', keywords: ['kuching', 'sarawak', 'east malaysia'] },
  'malacca': { state: 'Malacca', keywords: ['malacca', 'melaka', 'historical city'] },
  'alor setar': { state: 'Kedah', keywords: ['alor setar', 'kedah', 'northern malaysia'] },
  'kota bharu': { state: 'Kelantan', keywords: ['kota bharu', 'kelantan', 'east coast'] },
  'kuantan': { state: 'Pahang', keywords: ['kuantan', 'pahang', 'east coast'] },
  'seremban': { state: 'Negeri Sembilan', keywords: ['seremban', 'negeri sembilan'] },
  'kangar': { state: 'Perlis', keywords: ['kangar', 'perlis', 'northern malaysia'] },
  'kuala terengganu': { state: 'Terengganu', keywords: ['kuala terengganu', 'terengganu', 'east coast'] },
  'putrajaya': { state: 'Federal Territory', keywords: ['putrajaya', 'administrative capital'] },
  'labuan': { state: 'Federal Territory', keywords: ['labuan', 'offshore financial center'] }
};

// Categories for different types of news
const NEWS_CATEGORIES = {
  'general': ['Malaysia', 'Malaysian news', 'Malaysia today'],
  'economy': ['Malaysia economy', 'Malaysian ringgit', 'Malaysia business', 'Malaysia trade'],
  'tourism': ['Malaysia tourism', 'Visit Malaysia', 'Malaysia travel', 'Malaysian attractions'],
  'technology': ['Malaysia technology', 'Malaysia digital', 'Malaysia tech startup'],
  'politics': ['Malaysia politics', 'Malaysian government', 'Malaysia parliament'],
  'sports': ['Malaysia sports', 'Malaysian athletes', 'Malaysia football'],
  'culture': ['Malaysia culture', 'Malaysian festival', 'Malaysia heritage']
};

class NewsDataService {
  constructor() {
    this.isInitialized = false;
    this.lastFetchTime = null;
    this.refreshInterval = 30 * 60 * 1000; // 30 minutes
  }

  // Initialize the service and fetch initial data
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing News Data Service...');
    
    try {
      // Check if we have recent news data
      const recentNews = await News.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      if (recentNews === 0) {
        console.log('📰 No recent news found, fetching fresh data...');
        await this.collectAndStoreAllNews();
      } else {
        console.log(`📰 Found ${recentNews} recent news articles in database`);
      }
      
      this.isInitialized = true;
      this.setupAutoRefresh();
      console.log('✅ News Data Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize News Data Service:', error.message);
      // Continue with initialization even if initial fetch fails
      this.isInitialized = true;
    }
  }

  // Setup automatic refresh every 30 minutes
  setupAutoRefresh() {
    setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing news data...');
        await this.collectAndStoreAllNews();
        console.log('✅ Auto-refresh completed');
      } catch (error) {
        console.error('❌ Auto-refresh failed:', error.message);
      }
    }, this.refreshInterval);
  }

  // Collect and store all Malaysian news
  async collectAndStoreAllNews() {
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
      console.error('❌ NEWS_API_KEY not configured');
      throw new Error('NEWS_API_KEY not configured in environment variables');
    }

    console.log('📰 Starting comprehensive Malaysian news collection...');
    const startTime = Date.now();
    let totalArticles = 0;
    let storedArticles = 0;

    try {
      // Collect news for all categories
      for (const [categoryName, queries] of Object.entries(NEWS_CATEGORIES)) {
        console.log(`📋 Fetching ${categoryName} news...`);
        
        for (const query of queries) {
          try {
            const articles = await this.fetchNewsForQuery(query, newsApiKey);
            totalArticles += articles.length;
            
            for (const article of articles) {
              const stored = await this.storeArticleForAllRelevantLocations(article, categoryName);
              if (stored) storedArticles++;
            }
            
            // Rate limiting - wait between requests
            await this.delay(150);
            
          } catch (queryError) {
            console.error(`❌ Error fetching news for "${query}":`, queryError.message);
          }
        }
      }

      // Also fetch location-specific news
      for (const [locationKey, locationData] of Object.entries(MALAYSIAN_LOCATIONS)) {
        console.log(`📍 Fetching news for ${locationKey}...`);
        
        try {
          const articles = await this.fetchNewsForQuery(locationKey, newsApiKey);
          totalArticles += articles.length;
          
          for (const article of articles) {
            const stored = await this.storeArticleForSpecificLocation(
              article, 
              locationKey, 
              locationData.state
            );
            if (stored) storedArticles++;
          }
          
          await this.delay(150);
          
        } catch (locationError) {
          console.error(`❌ Error fetching news for ${locationKey}:`, locationError.message);
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ News collection completed in ${duration}s`);
      console.log(`📊 Total articles fetched: ${totalArticles}`);
      console.log(`💾 Articles stored: ${storedArticles}`);
      
      this.lastFetchTime = new Date();
      return { totalArticles, storedArticles, duration };

    } catch (error) {
      console.error('❌ News collection failed:', error.message);
      throw error;
    }
  }

  // Fetch news for a specific query
  async fetchNewsForQuery(query, apiKey) {
    try {
      const url = `https://newsapi.org/v2/everything`;
      const params = {
        q: query,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 50,
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Last 7 days
      };

      const response = await axios.get(url, {
        params: params,
        headers: { 'X-API-Key': apiKey },
        timeout: 10000
      });

      if (response.data && response.data.articles) {
        return response.data.articles.filter(article => 
          article.title && 
          article.title !== '[Removed]' &&
          article.description && 
          article.description !== '[Removed]' &&
          article.url &&
          this.isRelevantToMalaysia(article)
        );
      }

      return [];
    } catch (error) {
      console.error(`❌ API request failed for query "${query}":`, error.message);
      return [];
    }
  }

  // Check if article is relevant to Malaysia
  isRelevantToMalaysia(article) {
    const content = `${article.title} ${article.description} ${article.content || ''}`.toLowerCase();
    
    // Check for Malaysia-related keywords
    const malaysiaKeywords = [
      'malaysia', 'malaysian', 'kuala lumpur', 'penang', 'johor', 'sabah', 'sarawak',
      'selangor', 'perak', 'kedah', 'kelantan', 'terengganu', 'pahang', 'melaka',
      'negeri sembilan', 'perlis', 'putrajaya', 'labuan', 'ringgit', 'klang valley'
    ];
    
    return malaysiaKeywords.some(keyword => content.includes(keyword));
  }

  // Store article for all relevant Malaysian locations
  async storeArticleForAllRelevantLocations(article, category = 'general') {
    const articleText = `${article.title} ${article.description} ${article.content || ''}`.toLowerCase();
    const relatedLocations = [];
    
    // Find which locations this article relates to
    for (const [locationKey, locationData] of Object.entries(MALAYSIAN_LOCATIONS)) {
      if (locationData.keywords.some(keyword => articleText.includes(keyword))) {
        relatedLocations.push({
          city: this.capitalizeWords(locationKey),
          state: locationData.state
        });
      }
    }
    
    // If no specific location found, make it available to major cities
    if (relatedLocations.length === 0) {
      relatedLocations.push(
        { city: 'Kuala Lumpur', state: 'Federal Territory' },
        { city: 'George Town', state: 'Penang' },
        { city: 'Johor Bahru', state: 'Johor' }
      );
    }
    
    let stored = false;
    for (const location of relatedLocations) {
      try {
        await this.saveArticleToDatabase(article, location.city, location.state, category);
        stored = true;
      } catch (error) {
        console.error(`❌ Failed to store article for ${location.city}:`, error.message);
      }
    }
    
    return stored;
  }

  // Store article for a specific location
  async storeArticleForSpecificLocation(article, city, state, category = 'local') {
    try {
      const cityName = this.capitalizeWords(city);
      await this.saveArticleToDatabase(article, cityName, state, category);
      return true;
    } catch (error) {
      console.error(`❌ Failed to store article for ${city}:`, error.message);
      return false;
    }
  }

  // Save article to database with duplicate checking
  async saveArticleToDatabase(article, city, state, category = 'general') {
    try {
      // Check if this article already exists for this city
      const existingArticle = await News.findOne({
        'article.url': article.url,
        city: city
      });
      
      if (existingArticle) {
        // Update the existing article if it's older
        if (new Date(article.publishedAt) > existingArticle.article.publishedAt) {
          await News.updateOne(
            { _id: existingArticle._id },
            {
              $set: {
                article: {
                  title: article.title,
                  description: article.description,
                  url: article.url,
                  urlToImage: article.urlToImage,
                  publishedAt: new Date(article.publishedAt),
                  source: article.source,
                  content: article.content
                },
                category: category,
                lastUpdated: new Date()
              }
            }
          );
        }
        return;
      }
      
      // Create new article entry
      const newsEntry = new News({
        country: 'MY',
        city: city,
        state: state,
        category: category,
        article: {
          title: article.title,
          description: article.description,
          url: article.url,
          urlToImage: article.urlToImage,
          publishedAt: new Date(article.publishedAt),
          source: article.source,
          content: article.content
        },
        lastUpdated: new Date()
      });
      
      await newsEntry.save();
      
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - article already exists, ignore
        return;
      }
      throw error;
    }
  }

  // Get news for a specific location
  async getNewsForLocation(city, state, limit = 50) {
    try {
      const query = {
        country: 'MY',
        $or: [
          { city: city },
          { state: state },
          { city: 'Kuala Lumpur' } // Fallback to national news
        ]
      };
      
      const news = await News.find(query)
        .sort({ 'article.publishedAt': -1 })
        .limit(limit)
        .lean();
      
      // Remove duplicates based on URL
      const uniqueNews = [];
      const seenUrls = new Set();
      
      for (const newsItem of news) {
        if (!seenUrls.has(newsItem.article.url)) {
          seenUrls.add(newsItem.article.url);
          uniqueNews.push(newsItem.article);
        }
      }
      
      return uniqueNews;
      
    } catch (error) {
      console.error('❌ Error fetching news from database:', error.message);
      return [];
    }
  }

  // Get news statistics
  async getNewsStatistics() {
    try {
      const totalNews = await News.countDocuments({ country: 'MY' });
      const recentNews = await News.countDocuments({
        country: 'MY',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      const locationStats = await News.aggregate([
        { $match: { country: 'MY' } },
        {
          $group: {
            _id: { city: '$city', state: '$state' },
            count: { $sum: 1 },
            latestNews: { $max: '$article.publishedAt' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      return {
        totalArticles: totalNews,
        recentArticles: recentNews,
        lastFetchTime: this.lastFetchTime,
        locationBreakdown: locationStats,
        isInitialized: this.isInitialized
      };
      
    } catch (error) {
      console.error('❌ Error getting news statistics:', error.message);
      return {
        totalArticles: 0,
        recentArticles: 0,
        lastFetchTime: null,
        locationBreakdown: [],
        isInitialized: this.isInitialized,
        error: error.message
      };
    }
  }

  // Clean old news (older than 30 days)
  async cleanOldNews() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await News.deleteMany({
        createdAt: { $lt: thirtyDaysAgo }
      });
      
      console.log(`🧹 Cleaned ${result.deletedCount} old news articles`);
      return result.deletedCount;
      
    } catch (error) {
      console.error('❌ Error cleaning old news:', error.message);
      return 0;
    }
  }

  // Utility functions
  capitalizeWords(str) {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new NewsDataService();
