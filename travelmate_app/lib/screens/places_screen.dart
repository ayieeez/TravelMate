import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:travelmate_app/config/env.dart';
import 'package:travelmate_app/providers/location_provider.dart';
import 'package:travelmate_app/widgets/place_card.dart';

class PlacesScreen extends StatefulWidget {
  const PlacesScreen({super.key});

  @override
  State<PlacesScreen> createState() => _PlacesScreenState();
}

class _PlacesScreenState extends State<PlacesScreen> {
  List<dynamic> _places = [];
  bool _isLoading = true;
  String _error = '';

  Future<void> _fetchNearbyPlaces(double lat, double lon) async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final url = Uri.parse('${Env.baseUrl}/places?lat=$lat&lon=$lon');
      final response = await http.get(url);
      
      if (response.statusCode == 200) {
        setState(() {
          _places = json.decode(response.body);
          _error = '';
        });
      } else {
        setState(() {
          _error = 'Failed to load places: ${response.statusCode} - ${response.body}';
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

  @override
  Widget build(BuildContext context) {
    final location = Provider.of<LocationProvider>(context).currentPosition;
    final locationError = Provider.of<LocationProvider>(context).error;

    if (locationError.isNotEmpty) {
      return Center(child: Text(locationError));
    }

    if (location != null && _isLoading) {
      _fetchNearbyPlaces(location.latitude, location.longitude);
    }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                icon: const Icon(Icons.refresh),
                onPressed: location != null
                  ? () => _fetchNearbyPlaces(location.latitude, location.longitude)
                  : null,
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_isLoading) 
            const Center(child: CircularProgressIndicator()),
          
          if (_error.isNotEmpty)
            Center(
              child: Text(
                _error,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          
          if (!_isLoading && _places.isEmpty && _error.isEmpty)
            const Center(
              child: Text(
                'No places found nearby',
                style: TextStyle(color: Colors.grey),
              ),
            ),
          
          if (!_isLoading && _places.isNotEmpty)
            Expanded(
              child: ListView.builder(
                itemCount: _places.length,
                itemBuilder: (context, index) => PlaceCard(
                  name: _places[index]['name'] ?? 'Unknown Place',
                  address: _places[index]['address'] ?? 'Address not available',
                  distance: double.tryParse(_places[index]['distance'].toString()) ?? 0.0,
                  placeType: _places[index]['type'] ?? 'attraction',
                ),
              ),
            ),
        ],
      ),
    );
  }
}