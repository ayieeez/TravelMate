import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:travelmate_app/providers/location_provider.dart';
import 'package:travelmate_app/screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized(); // Add this
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (ctx) => LocationProvider(),
      child: MaterialApp(
        title: 'TravelMate',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primarySwatch: Colors.blue,
          scaffoldBackgroundColor: Colors.white,
          fontFamily: 'Poppins',
          textTheme: const TextTheme(
            titleMedium: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            bodyMedium: TextStyle(color: Colors.grey),
          ),
          appBarTheme: const AppBarTheme(
            color: Colors.white,
            elevation: 0,
            iconTheme: IconThemeData(color: Colors.blue),
          ),
        ),
        home: HomeScreen(),
      ),
    );
  }
}