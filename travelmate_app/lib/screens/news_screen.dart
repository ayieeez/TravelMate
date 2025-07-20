import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:travelmate_app/providers/location_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import 'package:travelmate_app/services/mongodb_service.dart';
import 'package:travelmate_app/config/env.dart';

class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  List<dynamic> _newsArticles = [];
  String _error = '';
  bool _isLoading = true;
  String _currentLocation = 'Current Location';
  Map<String, dynamic>? _locationInfo;

  @override
  void initState() {
    super.initState();
    _fetchNews();
  }

  Future<void> _fetchNews() async {
    try {
      if (mounted) {
        setState(() {
          _isLoading = true;
          _error = '';
        });
      }

      final locationProvider = Provider.of<LocationProvider>(context, listen: false);
      
      double lat, lon;
      if (locationProvider.currentPosition != null) {
        lat = locationProvider.currentPosition!.latitude;
        lon = locationProvider.currentPosition!.longitude;
      } else {
        // Default to Kuala Lumpur if no location
        lat = 3.139;
        lon = 101.6869;
      }

      http.Response response;
      bool usingLocalhost = false;
      
      // For web apps, try localhost first as it's more likely to work
      try {
        usingLocalhost = true;
        response = await http.get(
          Uri.parse('http://localhost:5000/api/news?lat=$lat&lon=$lon'),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        ).timeout(const Duration(seconds: 8));
        
        if (response.statusCode != 200) {
          throw Exception('Local API returned ${response.statusCode}');
        }
      } catch (e) {
        // If localhost fails, try production API
        try {
          usingLocalhost = false;
          response = await http.get(
            Uri.parse('${Env.baseUrl}/news?lat=$lat&lon=$lon'),
            headers: {'Content-Type': 'application/json'},
          ).timeout(const Duration(seconds: 10));
          
          if (response.statusCode != 200) {
            throw Exception('Production API returned ${response.statusCode}');
          }
        } catch (prodError) {
          // Both APIs failed, provide helpful error message
          throw Exception('Unable to connect to news service. This may be due to browser security restrictions when connecting to localhost. Try running the app on a mobile device or check if the API server is running.');
        }
      }

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (mounted) {
          setState(() {
            _newsArticles = data['articles'] ?? [];
            _locationInfo = data;
            _currentLocation = '${data['city']}, ${data['state']}';
            _isLoading = false;
          });
        }

        // Store news data in MongoDB
        _storeNewsData(lat, lon, data);
        
        // Show which API was used
        if (usingLocalhost) {
          print('✅ News loaded from local API server');
        } else {
          print('✅ News loaded from production API');
        }
      } else {
        if (mounted) {
          setState(() {
            _error = 'Failed to fetch news: ${response.statusCode}';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Error: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _storeNewsData(double lat, double lon, Map<String, dynamic> data) async {
    try {
      await MongoDBService.storeNewsData({
        'lat': lat,
        'lon': lon,
        'location': _currentLocation,
        'country': data['country'],
        'city': data['city'],
        'state': data['state'],
        'isInMalaysia': data['isInMalaysia'],
        'articles': _newsArticles,
        'totalResults': data['totalResults'],
        'cached': data['cached'] ?? false,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      // Silently fail if MongoDB service is not available
      print('Failed to store news data: $e');
    }
  }

  Future<void> _launchURL(String url) async {
    final Uri uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not launch $url')),
        );
      }
    }
  }

  void _shareArticle(String title, String url) {
    Share.share('$title\n\n$url');
  }

  Widget _buildNewsCard(Map<String, dynamic> article) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _launchURL(article['url'] ?? ''),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            if (article['urlToImage'] != null && article['urlToImage'].isNotEmpty)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                child: Image.network(
                  article['urlToImage'],
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Container(
                    height: 180,
                    color: Colors.grey[300],
                    child: const Icon(Icons.image_not_supported, size: 50),
                  ),
                ),
              ),
            
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    article['title'] ?? 'No title',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  
                  // Description
                  if (article['description'] != null)
                    Text(
                      article['description'],
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                        height: 1.4,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 12),
                  
                  // Source and date row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Source
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.blue[50],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          article['source']?['name'] ?? 'Unknown Source',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.blue[700],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      
                      // Share button
                      IconButton(
                        icon: const Icon(Icons.share, size: 20),
                        onPressed: () => _shareArticle(
                          article['title'] ?? '',
                          article['url'] ?? '',
                        ),
                        color: Colors.grey[600],
                      ),
                    ],
                  ),
                  
                  // Published date
                  if (article['publishedAt'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        _formatDate(article['publishedAt']),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[500],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final difference = now.difference(date);
      
      if (difference.inDays > 0) {
        return '${difference.inDays} day${difference.inDays > 1 ? 's' : ''} ago';
      } else if (difference.inHours > 0) {
        return '${difference.inHours} hour${difference.inHours > 1 ? 's' : ''} ago';
      } else {
        return '${difference.inMinutes} minute${difference.inMinutes > 1 ? 's' : ''} ago';
      }
    } catch (e) {
      return 'Recently';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _fetchNews,
        child: Column(
          children: [
            // Header with location info
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Colors.blue[600]!, Colors.blue[800]!],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '🇲🇾 Malaysian News',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '📍 $_currentLocation',
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.white70,
                    ),
                  ),
                  if (_locationInfo != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          Icon(
                            _locationInfo!['isInMalaysia'] == true 
                                ? Icons.location_on 
                                : Icons.public,
                            color: Colors.white70,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _locationInfo!['isInMalaysia'] == true
                                ? 'Location-specific news'
                                : 'General Malaysian news',
                            style: const TextStyle(
                              fontSize: 14,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            
            // Content
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircularProgressIndicator(),
                          SizedBox(height: 16),
                          Text('Fetching Malaysian news...'),
                        ],
                      ),
                    )
                  : _error.isNotEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.error_outline,
                                  size: 64,
                                  color: Colors.red,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'Oops! Something went wrong',
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _error,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: Colors.grey[600]),
                                ),
                                const SizedBox(height: 16),
                                ElevatedButton(
                                  onPressed: _fetchNews,
                                  child: const Text('Try Again'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : _newsArticles.isEmpty
                          ? const Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.newspaper,
                                    size: 64,
                                    color: Colors.grey,
                                  ),
                                  SizedBox(height: 16),
                                  Text(
                                    'No news available',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  Text(
                                    'Pull down to refresh',
                                    style: TextStyle(color: Colors.grey),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              itemCount: _newsArticles.length,
                              itemBuilder: (context, index) {
                                return _buildNewsCard(_newsArticles[index]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}