import 'package:flutter/material.dart';

class PlaceCard extends StatelessWidget {
  final String name;
  final String address;
  final double distance;
  final String placeType;

  const PlaceCard({
    super.key,
    required this.name,
    required this.address,
    required this.distance,
    required this.placeType,
  });

  // Get icon based on place type
  IconData getPlaceIcon() {
    switch (placeType) {
      case 'restaurant':
        return Icons.restaurant;
      case 'hotel':
        return Icons.hotel;
      case 'museum':
        return Icons.museum;
      case 'park':
        return Icons.park;
      case 'cafe':
        return Icons.local_cafe;
      default:
        return Icons.place;
    }
  }

  // Get color based on place type
  Color getIconColor() {
    switch (placeType) {
      case 'restaurant':
        return Colors.red;
      case 'cafe':
        return Colors.brown;
      case 'park':
        return Colors.green;
      case 'museum':
        return Colors.purple;
      default:
        return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 3,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Place type icon
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: getIconColor().withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(
                getPlaceIcon(),
                color: getIconColor(),
                size: 24,
              ),
            ),
            
            const SizedBox(width: 16),
            
            // Place details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Place name
                  Text(
                    name,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue[800],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  
                  const SizedBox(height: 4),
                  
                  // Address
                  Text(
                    address,
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 14,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  
                  const SizedBox(height: 8),
                  
                  // Distance
                  Row(
                    children: [
                      Icon(Icons.directions_walk, 
                          color: Colors.green, size: 16),
                      const SizedBox(width: 4),
                      Text(
                        '${distance.toStringAsFixed(1)} km',
                        style: TextStyle(
                          color: Colors.green[800],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // Navigation button
            IconButton(
              icon: const Icon(Icons.directions, color: Colors.blue),
              onPressed: () {
                // Implement navigation functionality
              },
            ),
          ],
        ),
      ),
    );
  }
}