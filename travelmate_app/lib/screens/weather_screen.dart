import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:travelmate_app/config/env.dart';
import 'package:travelmate_app/providers/location_provider.dart';
import 'package:travelmate_app/widgets/weather_card.dart';

class WeatherScreen extends StatefulWidget {
  const WeatherScreen({super.key});

  @override
  State<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends State<WeatherScreen> {
  Map<String, dynamic>? _weatherData;
  String _error = '';
  bool _isLoading = true;
  final TextEditingController _searchController = TextEditingController();
  String _currentLocation = 'Current Location';
  double? _customLat;
  double? _customLon;

  Future<void> _fetchWeather(double lat, double lon) async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    
    try {
      final url = Uri.parse('${Env.baseUrl}/weather?lat=$lat&lon=$lon');
      final response = await http.get(url);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          _weatherData = data;
          _error = '';
          
          // Update location name
          final city = data['city'] ?? '';
          final country = data['country'] ?? '';
          _currentLocation = city.isNotEmpty 
            ? '$city${country.isNotEmpty ? ", $country" : ""}' 
            : 'Current Location';
        });
      } else {
        setState(() {
          _error = 'Failed to load weather: ${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Connection error: ${e.toString()}';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _searchLocation(String query) async {
    if (query.isEmpty) return;
    
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final response = await http.get(
        Uri.parse('https://nominatim.openstreetmap.org/search?format=json&q=$query'),
        headers: {'User-Agent': 'TravelMate App (com.travelmate.app)'}, // Add User-Agent
      );

      if (response.statusCode == 200) {
        final results = json.decode(response.body);
        if (results.isNotEmpty) {
          final location = results[0];
          final lat = double.parse(location['lat']);
          final lon = double.parse(location['lon']);
          
          setState(() {
            _customLat = lat;
            _customLon = lon;
            _currentLocation = location['display_name'] ?? 'Searched Location';
          });
          
          _fetchWeather(lat, lon);
        } else {
          setState(() {
            _error = 'Location not found';
          });
        }
      } else {
        setState(() {
          _error = 'Search failed: ${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Search error: ${e.toString()}';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _resetToCurrentLocation() {
    final location = Provider.of<LocationProvider>(context, listen: false).currentPosition;
    if (location != null) {
      setState(() {
        _customLat = null;
        _customLon = null;
        _currentLocation = 'Current Location';
      });
      _fetchWeather(location.latitude, location.longitude);
    }
  }

  @override
  void initState() {
    super.initState();
    final location = Provider.of<LocationProvider>(context, listen: false).currentPosition;
    if (location != null) {
      _fetchWeather(location.latitude, location.longitude);
    } else {
      // If location is null, try to get it again
      Provider.of<LocationProvider>(context, listen: false).getCurrentLocation().then((_) {
        final newLocation = Provider.of<LocationProvider>(context, listen: false).currentPosition;
        if (newLocation != null) {
          _fetchWeather(newLocation.latitude, newLocation.longitude);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = Provider.of<LocationProvider>(context).currentPosition;
    final locationError = Provider.of<LocationProvider>(context).error;

    if (locationError.isNotEmpty) {
      return Center(child: Text(locationError));
    }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          // Location header and search
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.location_on, color: Colors.green),
                onPressed: _resetToCurrentLocation,
              ),
              Expanded(
                child: Text(
                  _currentLocation,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.search),
                onPressed: () => showSearchDialog(context),
              ),
            ],
          ),
          const SizedBox(height: 20),
          
          // Weather content
          if (_isLoading)
            const Expanded(child: Center(child: CircularProgressIndicator())),
          
          if (_error.isNotEmpty)
            Expanded(
              child: Center(
                child: Text(
                  _error,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            ),
          
          if (_weatherData != null && !_isLoading)
            Expanded(
              child: Column(
                children: [
                  WeatherCard(
                    temp: _weatherData!['temp'],
                    description: _weatherData!['description'],
                    icon: _weatherData!['icon'],
                    humidity: _weatherData!['humidity'],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      WeatherActionButton(
                        icon: Icons.refresh,
                        label: 'Refresh',
                        onPressed: () {
                          if (_customLat != null && _customLon != null) {
                            _fetchWeather(_customLat!, _customLon!);
                          } else if (location != null) {
                            _fetchWeather(location.latitude, location.longitude);
                          }
                        },
                      ),
                      WeatherActionButton(
                        icon: Icons.map,
                        label: 'View Map',
                        onPressed: () {},
                      ),
                      WeatherActionButton(
                        icon: Icons.share,
                        label: 'Share',
                        onPressed: () {},
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void showSearchDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Search Location'),
        content: TextField(
          controller: _searchController,
          decoration: const InputDecoration(
            hintText: 'Enter city name',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              _searchLocation(_searchController.text);
              Navigator.pop(context);
            },
            child: const Text('Search'),
          ),
        ],
      ),
    );
  }
}

class WeatherActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  const WeatherActionButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        IconButton(
          icon: Icon(icon, size: 28, color: Colors.blue),
          onPressed: onPressed,
        ),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}