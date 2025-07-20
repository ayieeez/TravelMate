# TravelMate In-House News Service

This is a complete in-house news service that fetches, stores, and serves Malaysian news data through your own API. The service follows a **database-first approach** where all news data is stored in MongoDB Atlas and served from your own backend.

## 🎯 Features

- **Database-First Architecture**: All news stored in MongoDB Atlas
- **Location-Based News**: Automatic location detection and relevant news serving
- **Auto-Refresh**: Automatic background news updates every 30 minutes
- **Category Support**: News categorized by topic (general, economy, tourism, etc.)
- **Caching**: Efficient caching with fallback mechanisms
- **Malaysian Focus**: Specialized for Malaysian news with location mapping
- **Production Ready**: Full error handling and monitoring

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# Get a free NewsAPI key from https://newsapi.org/
NEWS_API_KEY=your_newsapi_key_here
MONGODB_URI=your_mongodb_connection_string
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize News Service

```bash
# Initialize the news service and fetch initial data
node news-manager.js init

# Start the server
npm start
```

### 4. Test the API

```bash
# Test the news API
node test-news-api.js

# Check news statistics
node news-manager.js stats
```

## 📡 API Endpoints

### Get Location-Based News
```
GET /api/news?lat=3.139&lon=101.6869&limit=50
```

**Response:**
```json
{
  "success": true,
  "lat": 3.139,
  "lon": 101.6869,
  "country": "MY",
  "city": "Kuala Lumpur",
  "state": "Federal Territory",
  "isInMalaysia": true,
  "articles": [...],
  "totalResults": 25,
  "cached": true,
  "dataSource": "in-house-database",
  "lastUpdated": "2025-07-20T10:30:00.000Z",
  "message": "Latest Malaysian news for Kuala Lumpur"
}
```

### Manual News Refresh
```
POST /api/news/refresh
```

### Get News Statistics
```
GET /api/news/stats
```

### Get News by Category
```
GET /api/news/category?category=tourism&city=Kuala%20Lumpur&limit=20
```

### Clean Old News
```
DELETE /api/news/clean
```

## 🏗️ Architecture

```
NewsAPI → NewsDataService → MongoDB Atlas → API Controller → Flutter App
```

### Components:

1. **NewsDataService**: Handles data collection, processing, and storage
2. **News Model**: MongoDB schema for news articles
3. **News Controller**: API endpoints for serving news
4. **Auto-Initialization**: Automatic setup on server start

## 🗄️ Database Schema

```javascript
{
  country: "MY",
  city: "Kuala Lumpur",
  state: "Federal Territory",
  category: "general",
  article: {
    title: "News Title",
    description: "News description...",
    url: "https://example.com/news",
    urlToImage: "https://example.com/image.jpg",
    publishedAt: "2025-07-20T10:00:00.000Z",
    source: { name: "News Source" },
    content: "Full article content..."
  },
  createdAt: "2025-07-20T10:00:00.000Z",
  lastUpdated: "2025-07-20T10:00:00.000Z"
}
```

## 🛠️ Management Commands

```bash
# Initialize service and fetch initial data
node news-manager.js init

# Refresh all news data
node news-manager.js refresh

# Show statistics
node news-manager.js stats

# Clean old articles (>30 days)
node news-manager.js clean

# Test news retrieval
node news-manager.js test
```

## 📱 Flutter Integration

The Flutter app automatically connects to your in-house API:

```dart
// Production API (priority)
response = await http.get(
  Uri.parse('${Env.baseUrl}/news?lat=$lat&lon=$lon&limit=50'),
);

// Local development fallback
response = await http.get(
  Uri.parse('http://localhost:5000/api/news?lat=$lat&lon=$lon&limit=50'),
);
```

## 🌍 Location Support

Supported Malaysian locations with automatic detection:
- Kuala Lumpur, Federal Territory
- George Town, Penang
- Johor Bahru, Johor
- Ipoh, Perak
- Shah Alam, Selangor
- Petaling Jaya, Selangor
- Kota Kinabalu, Sabah
- Kuching, Sarawak
- And 9 more major cities...

## 📊 News Categories

- **General**: Malaysia news, Malaysian news, Malaysia today
- **Economy**: Malaysia economy, Malaysian ringgit, Malaysia business
- **Tourism**: Malaysia tourism, Visit Malaysia, Malaysia travel
- **Technology**: Malaysia technology, Malaysia digital
- **Politics**: Malaysia politics, Malaysian government
- **Sports**: Malaysia sports, Malaysian athletes
- **Culture**: Malaysia culture, Malaysian festival

## 🔧 Configuration

### Environment Variables
```bash
NEWS_API_KEY=your_newsapi_key          # Required: NewsAPI key
MONGODB_URI=your_mongodb_connection    # Required: MongoDB connection
PORT=5000                              # Optional: Server port
NODE_ENV=development                   # Optional: Environment
```

### Auto-Refresh Settings
- **Refresh Interval**: 30 minutes
- **Data Retention**: 30 days
- **Rate Limiting**: 150ms between API calls
- **Timeout**: 10 seconds per request

## 🚀 Deployment

### Production Deployment (Render)

1. **Environment Setup**:
   ```bash
   NEWS_API_KEY=your_actual_api_key
   MONGODB_URI=your_production_mongodb_uri
   NODE_ENV=production
   ```

2. **Auto-Initialization**: The service automatically initializes on startup

3. **Health Check**: Use `/api/news/stats` to monitor service health

### Local Development

```bash
# Start development server
npm run dev

# Test the service
curl "http://localhost:5000/api/news?lat=3.139&lon=101.6869"
```

## 📈 Monitoring

### Check Service Health
```bash
# Get comprehensive statistics
curl http://localhost:5000/api/news/stats

# Test specific location
curl "http://localhost:5000/api/news?lat=3.139&lon=101.6869&limit=5"
```

### Log Monitoring
The service provides detailed logging:
- 🚀 Service initialization
- 📰 Data collection progress
- ✅ Successful operations
- ❌ Error handling
- 📊 Statistics updates

## 🔒 Security & Performance

- **Rate Limiting**: Built-in API rate limiting
- **Error Handling**: Comprehensive error handling with fallbacks
- **Caching**: Efficient MongoDB querying with indexes
- **Deduplication**: Automatic article deduplication
- **Input Validation**: Parameter validation for all endpoints

## 🎉 Success Metrics

Your in-house news service provides:

1. ✅ **Complete Data Ownership**: All news stored in your database
2. ✅ **API Independence**: No direct dependency on external APIs in frontend
3. ✅ **Location Intelligence**: Smart location-based news serving
4. ✅ **Production Ready**: Full error handling and monitoring
5. ✅ **Scalable Architecture**: MongoDB Atlas with proper indexing
6. ✅ **Real-time Updates**: Automatic background refreshing
7. ✅ **Malaysian Focus**: Specialized for Malaysian content

## 🆘 Troubleshooting

### Common Issues

1. **No News Data**:
   ```bash
   node news-manager.js init
   ```

2. **API Key Issues**:
   - Check `.env` file
   - Verify NewsAPI key validity
   - Check API quota limits

3. **Database Connection**:
   - Verify MongoDB URI
   - Check network connectivity
   - Ensure database permissions

4. **Empty Results**:
   ```bash
   node news-manager.js refresh
   node news-manager.js stats
   ```

This in-house news service gives you complete control over your news data while providing a robust, scalable solution for the TravelMate application.
