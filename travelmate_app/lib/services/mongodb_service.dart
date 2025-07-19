import 'package:mongo_dart/mongo_dart.dart';
import 'package:travelmate_app/config/env.dart';

class MongoDBService {
  static final MongoDBService _instance = MongoDBService._internal();
  factory MongoDBService() => _instance;
  MongoDBService._internal();

  Db? _db;

  Future<Db> get database async {
    if (_db != null) return _db!;
    _db = await _initDB();
    return _db!;
  }

  Future<Db> _initDB() async {
    final db = Db(Env.mongoDbUrl);
    await db.open();
    return db;
  }

  Future<void> upsertRecentLocation(Map<String, dynamic> location) async {
    try {
      final db = await database;
      final collection = db.collection('recent_locations');
      await collection.update(
        where.eq('locKey', location['locKey']),
        location,
        upsert: true,
      );
    } catch (e) {
      print('MongoDB upsert error: $e');
    }
  }

  Future<void> insertWeatherLog(Map<String, dynamic> log) async {
    try {
      final db = await database;
      final collection = db.collection('weather_logs');
      await collection.insert(log);
    } catch (e) {
      print('MongoDB insert error: $e');
    }
  }

  Future<void> close() async {
    if (_db != null) await _db!.close();
  }
}