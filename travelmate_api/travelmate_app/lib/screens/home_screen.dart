import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:travelmate_app/providers/location_provider.dart';
import 'package:travelmate_app/screens/weather_screen.dart';
import 'package:travelmate_app/screens/places_screen.dart';
import 'package:travelmate_app/screens/currency_screen.dart';
import 'package:travelmate_app/widgets/app_bar.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key}); // Added const constructor

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  final List<Widget> _screens = const [ // Added const
    WeatherScreen(),
    PlacesScreen(),
    CurrencyScreen(),
  ];

  @override
  void initState() {
    super.initState();
    Provider.of<LocationProvider>(context, listen: false).getCurrentLocation();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const TravelMateAppBar(), // Added const
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: Colors.green,
        unselectedItemColor: Colors.grey,
        items: const [ // Added const
          BottomNavigationBarItem(icon: Icon(Icons.cloud), label: 'Weather'),
          BottomNavigationBarItem(icon: Icon(Icons.place), label: 'Places'),
          BottomNavigationBarItem(icon: Icon(Icons.currency_exchange), label: 'Currency'),
        ],
        onTap: (index) => setState(() => _currentIndex = index),
      ),
    );
  }
}