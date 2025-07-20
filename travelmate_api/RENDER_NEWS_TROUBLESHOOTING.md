# 🔧 TravelMate News Service - Render Troubleshooting Guide

## 🚨 Issue: News not displaying on Render

### ✅ What I've Fixed:

1. **API Key Mismatch** - Fixed NEWS_API_KEY in render.yaml
2. **Added Debug Endpoints** - For troubleshooting production issues
3. **Enhanced Logging** - Better error messages and environment checks
4. **Force Initialization** - Manual trigger for news service

---

## 🔍 Immediate Troubleshooting Steps

### Step 1: Check Debug Endpoint
Visit your Render URL + `/api/news/debug` to see:
```
https://your-render-app.onrender.com/api/news/debug
```

This will show:
- ✅ Environment variables status
- ✅ Service initialization status
- ✅ Database connection
- ✅ API test results

### Step 2: Force News Initialization
If debug shows issues, trigger force initialization:
```bash
# POST request to:
https://your-render-app.onrender.com/api/news/force-init
```

### Step 3: Check News Stats
Verify news data exists:
```
https://your-render-app.onrender.com/api/news/stats
```

### Step 4: Test News Endpoint
Try fetching news directly:
```
https://your-render-app.onrender.com/api/news?lat=3.139&lon=101.6869&limit=5
```

---

## 🔧 Common Issues & Solutions

### Issue 1: NEWS_API_KEY Not Working
**Symptoms:** Debug shows `hasNewsApiKey: false` or API test fails
**Solution:** 
1. Check your NewsAPI account at [newsapi.org](https://newsapi.org)
2. Verify API key is active and has quota remaining
3. Check if key matches in render.yaml

### Issue 2: MongoDB Connection Issues
**Symptoms:** Database stats show 0 articles, connection errors
**Solution:**
1. Verify MongoDB Atlas cluster is running
2. Check IP whitelist includes Render's IPs (or use 0.0.0.0/0)
3. Verify connection string is correct

### Issue 3: Service Not Initialized
**Symptoms:** `isInitialized: false` in debug
**Solution:**
1. Use force-init endpoint: POST `/api/news/force-init`
2. Check Render logs for initialization errors
3. Restart Render service

### Issue 4: No News Articles Found
**Symptoms:** Stats show 0 total articles
**Solution:**
1. Check NewsAPI quota usage
2. Try manual refresh: POST `/api/news/refresh`
3. Verify internet connectivity on Render

---

## 📊 Expected Debug Response (Healthy)

```json
{
  "environment": {
    "NODE_ENV": "production",
    "hasNewsApiKey": true,
    "hasMongoUri": true,
    "newsApiKeyLength": 32
  },
  "service": {
    "isInitialized": true,
    "lastFetchTime": "2025-01-20T10:30:00.000Z"
  },
  "database": {
    "totalArticles": 150,
    "recentArticles": 25,
    "locationBreakdown": [...]
  },
  "apiTest": {
    "articlesFound": 10,
    "sampleTitle": "Malaysia's Economic Growth..."
  }
}
```

---

## 🚀 Deploy Updated Code

1. **Commit Changes:**
```bash
git add .
git commit -m "Fix news service for Render deployment"
git push origin main
```

2. **Trigger Render Redeploy:**
- Go to Render dashboard
- Click "Manual Deploy" or wait for auto-deploy

3. **Test After Deployment:**
- Wait 2-3 minutes for service to start
- Visit debug endpoint
- Check news stats

---

## 📱 Flutter App Updates

Your Flutter app should automatically work once the API is fixed, but if issues persist:

### Check Flutter App Configuration
In `news_screen.dart`, ensure API URL is correct:
```dart
// For production Render deployment
const String API_BASE_URL = 'https://your-render-app.onrender.com';
```

---

## 🔄 Manual Recovery Steps

If news still doesn't work after fixes:

1. **Clear old data:**
```bash
DELETE https://your-render-app.onrender.com/api/news/clean
```

2. **Force refresh:**
```bash
POST https://your-render-app.onrender.com/api/news/refresh
```

3. **Force initialization:**
```bash
POST https://your-render-app.onrender.com/api/news/force-init
```

4. **Check results:**
```bash
GET https://your-render-app.onrender.com/api/news/stats
```

---

## 📞 Emergency Checklist

- [ ] API key is correct in render.yaml
- [ ] MongoDB Atlas is running and accessible
- [ ] Render service is deployed successfully
- [ ] Debug endpoint shows healthy status
- [ ] News stats show articles > 0
- [ ] News endpoint returns data

**🎯 Once all checkboxes are ✅, your news service should be working!**
