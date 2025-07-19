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
}
