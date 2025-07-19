import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:travelmate_app/config/env.dart';
import 'package:travelmate_app/providers/location_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import 'package:travelmate_app/services/mongodb_service.dart';

class PlacesScreen extends StatefulWidget {
  const PlacesScreen({super.key});

  @override
  State<PlacesScreen> createState() => _PlacesScreenState();
}

class _PlacesScreenState extends State<PlacesScreen> {
  List<dynamic> _places = [];
  bool _isLoading = true;
  String _error = '';
  String _selectedCategory = 'all';
  double _radius = 1000; // Default radius in meters
  Position? _userPosition;

  final List<Map<String, dynamic>> _categories = [
    {'key': 'all', 'label': 'All Places', 'icon': Icons.place},
    {
      'key': 'tourism',
      'label': 'Tourist Attractions',
      'icon': Icons.camera_alt,
    },
    {'key': 'restaurant', 'label': 'Restaurants', 'icon': Icons.restaurant},
    {'key': 'accommodation', 'label': 'Hotels', 'icon': Icons.hotel},
    {'key': 'shopping', 'label': 'Shopping', 'icon': Icons.shopping_bag},
    {'key': 'entertainment', 'label': 'Entertainment', 'icon': Icons.movie},
  ];

  @override
  void initState() {
    super.initState();
    _getUserLocation();
  }

  Future<void> _getUserLocation() async {
    final location = Provider.of<LocationProvider>(
      context,
      listen: false,
    ).currentPosition;
    if (location != null) {
      setState(() {
        _userPosition = location;
      });
      _fetchNearbyPlaces(location.latitude, location.longitude);
    }
  }

  // Store places data to MongoDB
  void _storePlacesData(List<dynamic> places, double lat, double lon) async {
    try {
      final mongoService = MongoDBService();
      final locKey = '${lat.toStringAsFixed(4)},${lon.toStringAsFixed(4)}';

      await mongoService.insertPlacesLog({
        'location': {'locKey': locKey, 'latitude': lat, 'longitude': lon},
        'places': places,
        'category': _selectedCategory,
        'radius': _radius,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('MongoDB places storage failed: $e');
    }
  }

  Future<void> _fetchNearbyPlaces(double lat, double lon) async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      String url =
          '${Env.baseUrl}/places?lat=$lat&lon=$lon&radius=${_radius.toInt()}';
      if (_selectedCategory != 'all') {
        url += '&category=$_selectedCategory';
      }

      print('Fetching places from: $url'); // Debug log
      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final places = json.decode(response.body);
        print('Received ${places.length} places'); // Debug log
        print('Places data: $places'); // Debug log

        setState(() {
          _places = places;
          _error = '';
        });

        // Store places data to MongoDB
        _storePlacesData(places, lat, lon);
      } else {
        print(
          'API Error: ${response.statusCode} - ${response.body}',
        ); // Debug log
        setState(() {
          _error =
              'Failed to load places: ${response.statusCode} - ${response.body}';
        });
      }
    } catch (e) {
      print('Exception: $e'); // Debug log
      setState(() {
        _error = 'Connection error: ${e.toString()}';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Open map for a specific place
  Future<void> _openPlaceOnMap(double lat, double lon, String placeName) async {
    final url = Uri.parse(
      'https://www.openstreetmap.org/?mlat=$lat&mlon=$lon#map=18/$lat/$lon',
    );

    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        // Fallback to Google Maps
        final googleUrl = Uri.parse(
          'https://www.google.com/maps/search/?api=1&query=$lat,$lon',
        );
        if (await canLaunchUrl(googleUrl)) {
          await launchUrl(googleUrl, mode: LaunchMode.externalApplication);
        } else {
          throw Exception('Could not launch maps');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open map for $placeName'),
            action: SnackBarAction(
              label: 'RETRY',
              onPressed: () => _openPlaceOnMap(lat, lon, placeName),
            ),
          ),
        );
      }
    }
  }

  // Calculate distance from user location
  double _calculateDistance(double placeLat, double placeLon) {
    if (_userPosition == null) return 0.0;

    return Geolocator.distanceBetween(
      _userPosition!.latitude,
      _userPosition!.longitude,
      placeLat,
      placeLon,
    );
  }

  // Check if place is within geofence
  bool _isWithinGeofence(double placeLat, double placeLon) {
    if (_userPosition == null) return false;

    final distance = _calculateDistance(placeLat, placeLon);
    return distance <= _radius;
  }

  // Show filter dialog for radius adjustment
  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Search Filters'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Search Radius: ${(_radius / 1000).toStringAsFixed(1)} km'),
            Slider(
              value: _radius,
              min: 500,
              max: 10000,
              divisions: 19,
              label: '${(_radius / 1000).toStringAsFixed(1)} km',
              onChanged: (value) {
                setState(() {
                  _radius = value;
                });
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              final location = Provider.of<LocationProvider>(
                context,
                listen: false,
              ).currentPosition;
              if (location != null) {
                _fetchNearbyPlaces(location.latitude, location.longitude);
              }
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final location = Provider.of<LocationProvider>(context).currentPosition;
    final locationError = Provider.of<LocationProvider>(context).error;

    if (locationError.isNotEmpty) {
      return Center(child: Text(locationError));
    }

    if (location != null && _isLoading && _userPosition == null) {
      setState(() {
        _userPosition = location;
      });
      _fetchNearbyPlaces(location.latitude, location.longitude);
    }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with title and refresh button
          Row(
            children: [
              Text(
                'Nearby Places',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue[800],
                ),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.settings),
                onPressed: () => _showFilterDialog(),
              ),
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: location != null
                    ? () => _fetchNearbyPlaces(
                        location.latitude,
                        location.longitude,
                      )
                    : null,
              ),
            ],
          ),

          // Category filter chips
          const SizedBox(height: 8),
          SizedBox(
            height: 50,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              itemBuilder: (context, index) {
                final category = _categories[index];
                final isSelected = _selectedCategory == category['key'];

                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: FilterChip(
                    label: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          category['icon'],
                          size: 16,
                          color: isSelected ? Colors.white : Colors.blue[800],
                        ),
                        const SizedBox(width: 4),
                        Text(
                          category['label'],
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.blue[800],
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        _selectedCategory = category['key'];
                      });
                      if (location != null) {
                        _fetchNearbyPlaces(
                          location.latitude,
                          location.longitude,
                        );
                      }
                    },
                    selectedColor: Colors.blue[600],
                    backgroundColor: Colors.blue[50],
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 16),

          // Radius and count info
          if (_places.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.green[200]!),
              ),
              child: Row(
                children: [
                  Icon(Icons.location_on, size: 16, color: Colors.green[700]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      '${_places.length} places within ${(_radius / 1000).toStringAsFixed(1)}km',
                      style: TextStyle(
                        color: Colors.green[700],
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  // Debug button to force refresh
                  TextButton(
                    onPressed: location != null
                        ? () {
                            print('Force refreshing places...');
                            _fetchNearbyPlaces(
                              location.latitude,
                              location.longitude,
                            );
                          }
                        : null,
                    child: Text(
                      'Refresh',
                      style: TextStyle(color: Colors.green[700], fontSize: 10),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 16),

          // Places list
          if (_isLoading)
            const Expanded(child: Center(child: CircularProgressIndicator())),

          if (_error.isNotEmpty)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
                    const SizedBox(height: 16),
                    Text(
                      _error,
                      style: const TextStyle(color: Colors.red),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: location != null
                          ? () => _fetchNearbyPlaces(
                              location.latitude,
                              location.longitude,
                            )
                          : null,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),

          if (!_isLoading && _places.isEmpty && _error.isEmpty)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.place_outlined,
                      size: 64,
                      color: Colors.grey[400],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No places found nearby',
                      style: TextStyle(color: Colors.grey[600], fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Try increasing the search radius or changing the category',
                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Current settings: ${(_radius / 1000).toStringAsFixed(1)}km radius, $_selectedCategory category',
                      style: TextStyle(color: Colors.grey[400], fontSize: 10),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: location != null
                          ? () {
                              setState(() {
                                _selectedCategory = 'all';
                                _radius = 5000; // Increase radius to 5km
                              });
                              _fetchNearbyPlaces(
                                location.latitude,
                                location.longitude,
                              );
                            }
                          : null,
                      icon: const Icon(Icons.search),
                      label: const Text('Search with 5km radius'),
                    ),
                  ],
                ),
              ),
            ),

          if (!_isLoading && _places.isNotEmpty)
            Expanded(
              child: ListView.builder(
                itemCount: _places.length,
                itemBuilder: (context, index) {
                  final place = _places[index];
                  final distance = _calculateDistance(
                    place['lat']?.toDouble() ?? 0.0,
                    place['lon']?.toDouble() ?? 0.0,
                  );

                  return EnhancedPlaceCard(
                    name: place['name'] ?? 'Unknown Place',
                    address: place['address'] ?? 'Address not available',
                    distance: distance / 1000, // Convert to km
                    placeType: place['type'] ?? 'attraction',
                    rating: place['rating']?.toDouble(),
                    openingHours: place['opening_hours'],
                    latitude: place['lat']?.toDouble() ?? 0.0,
                    longitude: place['lon']?.toDouble() ?? 0.0,
                    onMapTap: () => _openPlaceOnMap(
                      place['lat']?.toDouble() ?? 0.0,
                      place['lon']?.toDouble() ?? 0.0,
                      place['name'] ?? 'Unknown Place',
                    ),
                    isWithinGeofence: _isWithinGeofence(
                      place['lat']?.toDouble() ?? 0.0,
                      place['lon']?.toDouble() ?? 0.0,
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

// Enhanced Place Card Widget with additional features
class EnhancedPlaceCard extends StatelessWidget {
  final String name;
  final String address;
  final double distance;
  final String placeType;
  final double? rating;
  final String? openingHours;
  final double latitude;
  final double longitude;
  final VoidCallback onMapTap;
  final bool isWithinGeofence;

  const EnhancedPlaceCard({
    super.key,
    required this.name,
    required this.address,
    required this.distance,
    required this.placeType,
    this.rating,
    this.openingHours,
    required this.latitude,
    required this.longitude,
    required this.onMapTap,
    required this.isWithinGeofence,
  });

  IconData _getPlaceIcon() {
    switch (placeType.toLowerCase()) {
      case 'restaurant':
      case 'food':
        return Icons.restaurant;
      case 'hotel':
      case 'accommodation':
        return Icons.hotel;
      case 'tourism':
      case 'attraction':
        return Icons.camera_alt;
      case 'shopping':
        return Icons.shopping_bag;
      case 'entertainment':
        return Icons.movie;
      default:
        return Icons.place;
    }
  }

  Color _getTypeColor() {
    switch (placeType.toLowerCase()) {
      case 'restaurant':
      case 'food':
        return Colors.orange;
      case 'hotel':
      case 'accommodation':
        return Colors.blue;
      case 'tourism':
      case 'attraction':
        return Colors.green;
      case 'shopping':
        return Colors.purple;
      case 'entertainment':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: isWithinGeofence
              ? Border.all(color: Colors.green, width: 2)
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row with icon, name, and actions
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _getTypeColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      _getPlaceIcon(),
                      color: _getTypeColor(),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (rating != null) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              ...List.generate(5, (index) {
                                return Icon(
                                  index < (rating! / 2).round()
                                      ? Icons.star
                                      : Icons.star_border,
                                  color: Colors.amber,
                                  size: 16,
                                );
                              }),
                              const SizedBox(width: 4),
                              Text(
                                rating!.toStringAsFixed(1),
                                style: TextStyle(
                                  color: Colors.grey[600],
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Geofence indicator
                  if (isWithinGeofence)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'NEARBY',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 12),

              // Address
              Row(
                children: [
                  Icon(Icons.location_on, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      address,
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),

              // Opening hours if available
              if (openingHours != null && openingHours!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.access_time, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        openingHours!,
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 12),

              // Footer with distance and actions
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.blue[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${distance.toStringAsFixed(1)} km',
                      style: TextStyle(
                        color: Colors.blue[700],
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _getTypeColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      placeType.toUpperCase(),
                      style: TextStyle(
                        color: _getTypeColor(),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.map_outlined),
                    onPressed: onMapTap,
                    iconSize: 20,
                    color: Colors.blue[700],
                    tooltip: 'View on Map',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
