import 'package:flutter/material.dart';

class TravelMateAppBar extends StatelessWidget implements PreferredSizeWidget {
  const TravelMateAppBar({super.key}); // Added const constructor

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: const Text( // Added const
        'TravelMate',
        style: TextStyle(
          color: Colors.blue,
          fontWeight: FontWeight.bold,
        ),
      ),
      actions: const [ // Added const
        IconButton(icon: Icon(Icons.location_on), onPressed: null),
      ],
    );
  }
}