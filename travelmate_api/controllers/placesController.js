const axios = require('axios');
const Place = require('../models/Place');

let lastRequestTime = 0;
const RATE_LIMIT_INTERVAL = 1000;

exports.getNearbyPlaces = async (req, res) => {
  const { lat, lon } = req.query;

  try {
    const currentTime = Date.now();
    const elapsed = currentTime - lastRequestTime;
    if (elapsed < RATE_LIMIT_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL - elapsed));
    }
    lastRequestTime = Date.now();

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
    if (!city) return res.status(404).json({ error: "Location not recognized" });

    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL));

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
        name: place.display_name?.split(',')[0] || 'Unnamed Place',
        address: place.display_name,
        distance: (distance / 1000).toFixed(1),
        type: place.type,
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon)
      };
    });

    // Save top 10 places to DB
    await Place.insertMany(places.slice(0, 10));

    res.json(places.slice(0, 15));
  } catch (error) {
    console.error('Places API Error:', error.response?.data || error.message);
    res.status(500).json({ error: "Places fetch failed" });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
