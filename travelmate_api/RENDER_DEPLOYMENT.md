# Render Deployment Configuration for TravelMate API

## Environment Variables for Render

Set these environment variables in your Render dashboard:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://muhammadizzuddin4600:OmHkoNe0tVTRLOdS@cluster0.ejzsqys.mongodb.net/travelmate_db?retryWrites=true&w=majority
OPENWEATHER_API_KEY=dc282357cf98721b16440ed5964f1376
NEWS_API_KEY=7c9c4c4e8a8b4e5f9e3a8b2c1d4e5f6a
```

## Render Service Configuration

### Build Command
```
npm install
```

### Start Command
```
npm start
```

### Health Check Endpoint
```
https://your-app-name.onrender.com/api/news/stats
```

## Auto-Deploy Setup

1. Connect your GitHub repository to Render
2. Set the root directory to: `travelmate_api`
3. Configure environment variables above
4. Enable auto-deploy on main branch

## Production Features

✅ **Database-First News Service**: All news stored in MongoDB Atlas
✅ **Auto-Initialization**: Service initializes automatically on startup
✅ **Background Refresh**: News updates every 30 minutes
✅ **Error Handling**: Comprehensive error handling with fallbacks
✅ **Location Intelligence**: Smart Malaysian location detection
✅ **API Monitoring**: Built-in statistics and health checks

## API Endpoints (Production)

- `GET /api/news?lat=3.139&lon=101.6869` - Location-based news
- `POST /api/news/refresh` - Manual refresh
- `GET /api/news/stats` - Service statistics
- `GET /api/news/category?category=tourism` - Category news
- `DELETE /api/news/clean` - Clean old articles

## Flutter App Configuration

Update your `lib/config/env.dart`:

```dart
class Env {
  static const String baseUrl = 'https://your-app-name.onrender.com/api';
}
```

## Monitoring

The service provides comprehensive logging:
- 🚀 Service startup and initialization
- 📰 News collection progress
- ✅ Successful API requests
- ❌ Error handling and recovery
- 📊 Usage statistics

## Deployment Checklist

- [ ] Repository connected to Render
- [ ] Environment variables configured
- [ ] Build and start commands set
- [ ] Root directory set to `travelmate_api`
- [ ] Flutter app updated with production URL
- [ ] Health check endpoint tested

Your in-house news service will be production-ready on Render!
