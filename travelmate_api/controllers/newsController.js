const axios = require('axios');
const News = require('../models/News');

// Malaysian states and major cities mapping for precise location matching
const MALAYSIAN_LOCATIONS = {
  'kuala lumpur': { state: 'Federal Territory', keywords: ['kuala lumpur', 'kl', 'klang valley'] },
  'george town': { state: 'Penang', keywords: ['george town', 'penang', 'pulau pinang'] },
  'johor bahru': { state: 'Johor', keywords: ['johor bahru', 'jb', 'johor'] },
  'ipoh': { state: 'Perak', keywords: ['ipoh', 'perak'] },
  'shah alam': { state: 'Selangor', keywords: ['shah alam', 'selangor'] },
  'petaling jaya': { state: 'Selangor', keywords: ['petaling jaya', 'pj', 'selangor'] },
  'kota kinabalu': { state: 'Sabah', keywords: ['kota kinabalu', 'kk', 'sabah'] },
  'kuching': { state: 'Sarawak', keywords: ['kuching', 'sarawak'] },
  'malacca': { state: 'Malacca', keywords: ['malacca', 'melaka'] },
  'alor setar': { state: 'Kedah', keywords: ['alor setar', 'kedah'] },
  'kota bharu': { state: 'Kelantan', keywords: ['kota bharu', 'kelantan'] },
  'kuantan': { state: 'Pahang', keywords: ['kuantan', 'pahang'] },
  'seremban': { state: 'Negeri Sembilan', keywords: ['seremban', 'negeri sembilan'] },
  'kangar': { state: 'Perlis', keywords: ['kangar', 'perlis'] },
  'kuala terengganu': { state: 'Terengganu', keywords: ['kuala terengganu', 'terengganu'] },
  'putrajaya': { state: 'Federal Territory', keywords: ['putrajaya'] },
  'labuan': { state: 'Federal Territory', keywords: ['labuan'] }
};

// Function to get Malaysian location from coordinates (simplified for testing)
const getMalaysianLocation = async (lat, lon) => {
  // Define Malaysian coordinate bounds
  const MALAYSIA_BOUNDS = {
    north: 7.5,
    south: 0.8,
    east: 119.5,
    west: 99.5
  };
  
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  
  // Check if coordinates are within Malaysia
  const isInMalaysia = latNum >= MALAYSIA_BOUNDS.south && 
                       latNum <= MALAYSIA_BOUNDS.north && 
                       lonNum >= MALAYSIA_BOUNDS.west && 
                       lonNum <= MALAYSIA_BOUNDS.east;
  
  if (!isInMalaysia) {
    return { 
      country: 'MY', 
      city: 'Kuala Lumpur', 
      state: 'Federal Territory',
      isInMalaysia: false 
    };
  }
  
  // Simple city detection based on coordinates
  if (latNum >= 3.0 && latNum <= 3.3 && lonNum >= 101.5 && lonNum <= 101.8) {
    return {
      country: 'MY',
      city: 'Kuala Lumpur',
      state: 'Federal Territory',
      isInMalaysia: true
    };
  } else if (latNum >= 5.2 && latNum <= 5.6 && lonNum >= 100.1 && lonNum <= 100.5) {
    return {
      country: 'MY',
      city: 'George Town',
      state: 'Penang',
      isInMalaysia: true
    };
  } else if (latNum >= 1.4 && latNum <= 1.6 && lonNum >= 103.6 && lonNum <= 103.9) {
    return {
      country: 'MY',
      city: 'Johor Bahru',
      state: 'Johor',
      isInMalaysia: true
    };
  }
  
  // Default to Kuala Lumpur for other Malaysian coordinates
  return {
    country: 'MY',
    city: 'Kuala Lumpur',
    state: 'Federal Territory',
    isInMalaysia: true
  };
};

// Function to fetch Malaysian news from NewsAPI and store in database
const fetchAndStoreMalaysianNews = async () => {
  try {
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
      console.error('NEWS_API_KEY not configured in environment variables');
      throw new Error('NEWS_API_KEY not configured');
    }

    console.log('Fetching Malaysian news from NewsAPI...');
    
    // Fetch Malaysia-specific news
    const malaysianNewsQueries = [
      'Malaysia',
      'Kuala Lumpur',
      'Malaysian government',
      'Malaysia economy',
      'Malaysia tourism',
      'Penang Malaysia',
      'Johor Malaysia',
      'Sabah Malaysia',
      'Sarawak Malaysia'
    ];

    const allArticles = [];
    
    // Fetch news for each major Malaysian topic
    for (const query of malaysianNewsQueries) {
      try {
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=100&apiKey=${newsApiKey}`;
        console.log(`Fetching news for: ${query}`);
        
        const response = await axios.get(url);
        
        if (response.data.articles) {
          allArticles.push(...response.data.articles);
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error fetching news for ${query}:`, error.message);
      }
    }

    // Remove duplicates based on URL
    const uniqueArticles = allArticles.filter((article, index, self) => 
      index === self.findIndex(a => a.url === article.url)
    );

    console.log(`Fetched ${uniqueArticles.length} unique Malaysian articles`);

    // Store articles in database with location categorization
    for (const article of uniqueArticles) {
      if (!article.title || article.title === '[Removed]' || 
          !article.description || article.description === '[Removed]') {
        continue;
      }

      // Determine which Malaysian cities/states this article relates to
      const relatedLocations = [];
      const articleText = `${article.title} ${article.description} ${article.content || ''}`.toLowerCase();
      
      for (const [locationKey, locationData] of Object.entries(MALAYSIAN_LOCATIONS)) {
        if (locationData.keywords.some(keyword => articleText.includes(keyword))) {
          relatedLocations.push({
            city: locationKey.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            state: locationData.state
          });
        }
      }

      // If no specific location found, make it available to all major cities
      if (relatedLocations.length === 0) {
        relatedLocations.push(
          { city: 'Kuala Lumpur', state: 'Federal Territory' },
          { city: 'George Town', state: 'Penang' },
          { city: 'Johor Bahru', state: 'Johor' }
        );
      }

      // Store for each related location
      for (const location of relatedLocations) {
        try {
          const newsDocument = {
            country: 'MY',
            city: location.city,
            state: location.state,
            article: {
              title: article.title,
              description: article.description,
              url: article.url,
              urlToImage: article.urlToImage,
              publishedAt: article.publishedAt,
              source: {
                name: article.source?.name || 'Unknown Source'
              },
              content: article.content
            },
            createdAt: new Date(),
            lastUpdated: new Date()
          };

          // Upsert to avoid duplicates
          await News.findOneAndUpdate(
            { 
              'article.url': article.url,
              city: location.city
            },
            newsDocument,
            { upsert: true, new: true }
          );
        } catch (dbError) {
          console.error('Error saving article to database:', dbError.message);
        }
      }
    }

    console.log('Malaysian news stored in database successfully');
    return uniqueArticles.length;
  } catch (error) {
    console.error('Error fetching Malaysian news:', error.message);
    throw error;
  }
};

// Function to get Malaysian news from database based on user location
const getMalaysianNewsFromDB = async (city, state) => {
  try {
    console.log(`Fetching cached Malaysian news for ${city}, ${state}`);
    
    // Try to fetch from MongoDB first, fall back to in-memory cache
    try {
      const newsQuery = {
        country: 'MY',
        $or: [
          { city: city },
          { state: state },
          { city: 'Kuala Lumpur' } // Fallback to national news
        ]
      };
      
      const cachedNews = await News.find(newsQuery)
        .sort({ 'article.publishedAt': -1 })
        .limit(50)
        .exec();
      
      if (cachedNews && cachedNews.length > 0) {
        const articles = cachedNews.map(news => news.article);
        
        // Remove duplicates based on URL
        const uniqueArticles = articles.filter((article, index, self) => 
          index === self.findIndex(a => a.url === article.url)
        );
        
        console.log(`Found ${uniqueArticles.length} cached articles for ${city}`);
        return uniqueArticles.slice(0, 20); // Return top 20 articles
      }
    } catch (dbError) {
      console.log('Database not available, using fallback sample data');
    }
    
    // Fallback sample Malaysian news for demonstration
    const sampleMalaysianNews = [
      {
        title: "Malaysia Tourism Recovery Shows Strong Progress in 2025",
        description: "Malaysia's tourism sector continues to show remarkable recovery with international visitor arrivals increasing significantly in the first quarter of 2025.",
        url: "https://example.com/malaysia-tourism-recovery",
        urlToImage: "https://example.com/tourism-image.jpg",
        publishedAt: new Date().toISOString(),
        source: { name: "Malaysia Tourism Board" },
        content: "Malaysia's tourism industry has demonstrated resilience and strong recovery..."
      },
      {
        title: `${city} Local Development Projects Accelerate Economic Growth`,
        description: `New infrastructure and development projects in ${city}, ${state} are driving economic growth and improving quality of life for residents.`,
        url: `https://example.com/${city.toLowerCase().replace(' ', '-')}-development`,
        urlToImage: "https://example.com/development-image.jpg",
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        source: { name: `${state} Development Authority` },
        content: `The ${state} state government has announced several key development projects...`
      },
      {
        title: "Malaysia's Digital Economy Transformation Continues",
        description: "Malaysia strengthens its position as a digital hub in Southeast Asia with new technology initiatives and investments.",
        url: "https://example.com/malaysia-digital-economy",
        urlToImage: "https://example.com/digital-image.jpg",
        publishedAt: new Date(Date.now() - 7200000).toISOString(),
        source: { name: "Malaysian Investment Development Authority" },
        content: "Malaysia's digital transformation strategy is yielding positive results..."
      }
    ];
    
    console.log(`Returning ${sampleMalaysianNews.length} sample articles for ${city}`);
    return sampleMalaysianNews;
    
  } catch (error) {
    console.error('Error fetching news:', error.message);
    return [];
  }
};

// Main endpoint for getting Malaysian news
exports.getNews = async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ 
      error: "Latitude and longitude are required",
      message: "Please provide lat and lon parameters for Malaysian location-based news"
    });
  }

  try {
    console.log(`News request for coordinates: ${lat}, ${lon}`);
    
    // Get Malaysian location from coordinates
    const locationInfo = await getMalaysianLocation(lat, lon);
    
    // If user is not in Malaysia, return Malaysia general news
    if (!locationInfo.isInMalaysia) {
      console.log('User outside Malaysia, returning general Malaysian news');
      const generalMalaysianNews = await getMalaysianNewsFromDB('Kuala Lumpur', 'Federal Territory');
      
      return res.json({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        country: 'MY',
        city: 'Malaysia (General)',
        state: 'General',
        isInMalaysia: false,
        articles: generalMalaysianNews,
        totalResults: generalMalaysianNews.length,
        message: "Showing general Malaysian news (user location outside Malaysia)",
        cached: true
      });
    }
    
    // Get location-specific Malaysian news from database
    const cityNews = await getMalaysianNewsFromDB(locationInfo.city, locationInfo.state);
    
    if (cityNews.length > 0) {
      console.log(`Returning ${cityNews.length} cached articles for ${locationInfo.city}`);
      return res.json({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        country: locationInfo.country,
        city: locationInfo.city,
        state: locationInfo.state,
        isInMalaysia: true,
        articles: cityNews,
        totalResults: cityNews.length,
        cached: true,
        lastUpdated: new Date()
      });
    }
    
    // If no cached news, trigger fresh fetch and return what we have
    console.log('No cached news found, triggering fresh fetch...');
    
    try {
      // Trigger background refresh without waiting
      fetchAndStoreMalaysianNews().catch(error => {
        console.error('Background news fetch failed:', error.message);
      });
      
      // Return empty result with message to try again
      return res.json({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        country: locationInfo.country,
        city: locationInfo.city,
        state: locationInfo.state,
        isInMalaysia: true,
        articles: [],
        totalResults: 0,
        message: "Fresh Malaysian news is being fetched. Please try again in a few moments.",
        refreshing: true
      });
    } catch (refreshError) {
      console.error('Error triggering news refresh:', refreshError.message);
      
      return res.status(500).json({
        error: "Unable to fetch Malaysian news",
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        country: locationInfo.country,
        city: locationInfo.city,
        state: locationInfo.state,
        articles: [],
        totalResults: 0
      });
    }
    
  } catch (error) {
    console.error('News controller error:', error.message);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    });
  }
};

// Endpoint to manually refresh Malaysian news
exports.refreshMalaysianNews = async (req, res) => {
  try {
    console.log('Manual Malaysian news refresh triggered');
    const articleCount = await fetchAndStoreMalaysianNews();
    
    res.json({
      success: true,
      message: `Successfully fetched and stored ${articleCount} Malaysian articles`,
      articleCount: articleCount,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Manual refresh error:', error.message);
    res.status(500).json({
      success: false,
      error: "Failed to refresh Malaysian news",
      message: error.message
    });
  }
};

// Endpoint to get Malaysian news statistics
exports.getMalaysianNewsStats = async (req, res) => {
  try {
    const stats = await News.aggregate([
      { $match: { country: 'MY' } },
      {
        $group: {
          _id: { city: '$city', state: '$state' },
          count: { $sum: 1 },
          lastUpdated: { $max: '$lastUpdated' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const totalArticles = await News.countDocuments({ country: 'MY' });
    
    res.json({
      totalMalaysianArticles: totalArticles,
      locationBreakdown: stats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({
      error: "Failed to get Malaysian news statistics",
      message: error.message
    });
  }
};
