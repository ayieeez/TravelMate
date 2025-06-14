const axios = require('axios');

// Rate limiting variables
let lastRequestTime = 0;
const RATE_LIMIT_INTERVAL = 1000; // 1 second

exports.getNearbyPlaces = async (req, res) => {
  const { lat, lon } = req.query;
  
  try {
    // Rate limiting
    const currentTime = Date.now();
    const elapsed = currentTime - lastRequestTime;
    
    if (elapsed < RATE_LIMIT_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL - elapsed));
    }
    lastRequestTime = Date.now();
    
    // Step 1: Reverse geocoding
    const reverseResponse = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TravelMate App (com.travelmate.app)',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );
    
    const address = reverseResponse.data.address;
    const city = address.city || address.town || address.village || address.county;
    const country = address.country;
    
    if (!city) {
      return res.status(404).json({ error: "Location not recognized" });
    }
    
    // Rate limiting again
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL));
    
    // Step 2: Search for places
    const placesResponse = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&tag=tourism|restaurant&limit=20`,
      {
        headers: {
          'User-Agent': 'TravelMate App (com.travelmate.app)',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );
    
    const places = placesResponse.data.map(place => {
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lon),
        parseFloat(place.lat),
        parseFloat(place.lon)
      );
      
      return {
        name: place.display_name ? place.display_name.split(',')[0] : 'Unnamed Place',
        address: place.display_name,
        distance: (distance / 1000).toFixed(1), // Convert to km
        type: place.type
      };
    });
    
    // Sort by distance
    places.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    
    res.json(places.slice(0, 15)); // Return top 15 results
  } catch (error) {
    console.error('Places API Error:', error.response?.data || error.message);
    res.status(500).json({ error: "Places fetch failed" });
  }
};

// Haversine formula to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distance in meters
}