import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:travelmate_app/config/env.dart';

class MongoDBService {
  static final MongoDBService _instance = MongoDBService._internal();
  factory MongoDBService() => _instance;
  MongoDBService._internal();

  Future<void> upsertRecentLocation(Map<String, dynamic> location) async {
    try {
      final url = Uri.parse('${Env.baseUrl}/recent-location');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode(location),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to store location: ${response.statusCode}');
      }
    } catch (e) {
      print('MongoDB upsert error: $e');
    }
  }

  Future<void> insertWeatherLog(Map<String, dynamic> log) async {
    try {
      final url = Uri.parse('${Env.baseUrl}/weather-log');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode(log),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to store weather log: ${response.statusCode}');
      }
    } catch (e) {
      print('MongoDB insert error: $e');
    }
  }

  Future<void> insertPlacesLog(Map<String, dynamic> log) async {
    try {
      final url = Uri.parse('${Env.baseUrl}/places-log');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode(log),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to store places log: ${response.statusCode}');
      }
    } catch (e) {
      print('MongoDB places insert error: $e');
    }
  }

  // New method to manually refresh places data
  Future<bool> refreshPlacesData(
    double lat,
    double lon, {
    int radius = 5000,
    String category = 'all',
  }) async {
    try {
      final url = Uri.parse('${Env.baseUrl}/places/refresh');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'lat': lat,
          'lon': lon,
          'radius': radius,
          'category': category,
        }),
      );

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        print('Places data refreshed: ${responseData['message']}');
        return true;
      }
      return false;
    } catch (e) {
      print('Places refresh error: $e');
      return false;
    }
  }

  // New method to manually collect data for a location (admin use)
  Future<bool> collectPlacesData(
    double lat,
    double lon, {
    int radius = 5000,
    String category = 'all',
  }) async {
    try {
      final url = Uri.parse('${Env.baseUrl}/places/collect');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'lat': lat,
          'lon': lon,
          'radius': radius,
          'category': category,
        }),
      );

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        print('Data collection completed: ${responseData['message']}');
        return true;
      }
      return false;
    } catch (e) {
      print('Data collection error: $e');
      return false;
    }
  }

  static Future<void> storeNewsData(Map<String, dynamic> newsData) async {
    try {
      final url = Uri.parse('${Env.baseUrl}/news-log');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode(newsData),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to store news data: ${response.statusCode}');
      }
    } catch (e) {
      print('MongoDB news storage error: $e');
    }
  }
}
