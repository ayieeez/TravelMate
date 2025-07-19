const axios = require('axios');
const Place = require('../models/Place');

let lastRequestTime = 0;
const RATE_LIMIT_INTERVAL = 1000;

exports.getNearbyPlaces = async (req, res) => {
  const { lat, lon, radius = 1000, category = 'all' } = req.query;

  try {
    const currentTime = Date.now();
    const elapsed = currentTime - lastRequestTime;
    if (elapsed < RATE_LIMIT_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL - elapsed));
    }
    lastRequestTime = Date.now();

    // Build search tags based on category
    let searchTags = '';
    switch (category) {
      case 'tourism':
        searchTags = 'tourism=attraction|tourism=museum|tourism=gallery|tourism=viewpoint|historic=monument';
        break;
      case 'restaurant':
        searchTags = 'amenity=restaurant|amenity=cafe|amenity=fast_food|amenity=bar|amenity=pub';
        break;
      case 'accommodation':
        searchTags = 'tourism=hotel|tourism=guest_house|tourism=hostel|tourism=motel';
        break;
      case 'shopping':
        searchTags = 'shop=*|amenity=marketplace|tourism=shopping';
        break;
      case 'entertainment':
        searchTags = 'amenity=cinema|amenity=theatre|leisure=amusement_arcade|tourism=theme_park';
        break;
      default:
        searchTags = 'tourism=*|amenity=restaurant|amenity=cafe|shop=*|leisure=*';
    }

    // Use Overpass API for better radius-based search
    const overpassQuery = `
      [out:json][timeout:25];
      (
        nwr["${searchTags.split('|').join(`"](around:${radius},${lat},${lon});
        nwr["`)}"]["name"](around:${radius},${lat},${lon});
      );
      out center meta;
    `;

    const overpassResponse = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'TravelMate App (com.travelmate.app)',
        }
      }
    );

    let places = [];
    
    if (overpassResponse.data && overpassResponse.data.elements) {
      places = overpassResponse.data.elements
        .filter(element => element.tags && element.tags.name)
        .map(element => {
          const elementLat = element.lat || element.center?.lat || 0;
          const elementLon = element.lon || element.center?.lon || 0;
          
          const distance = calculateDistance(
            parseFloat(lat),
            parseFloat(lon),
            elementLat,
            elementLon
          );

          // Determine place type
          let placeType = 'attraction';
          if (element.tags.amenity) {
            if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(element.tags.amenity)) {
              placeType = 'restaurant';
            } else if (['cinema', 'theatre'].includes(element.tags.amenity)) {
              placeType = 'entertainment';
            }
          } else if (element.tags.tourism) {
            if (['hotel', 'guest_house', 'hostel', 'motel'].includes(element.tags.tourism)) {
              placeType = 'accommodation';
            } else {
              placeType = 'tourism';
            }
          } else if (element.tags.shop) {
            placeType = 'shopping';
          }

          return {
            name: element.tags.name,
            address: element.tags['addr:full'] || element.tags['addr:street'] || `${elementLat.toFixed(4)}, ${elementLon.toFixed(4)}`,
            distance: (distance / 1000).toFixed(1),
            type: placeType,
            lat: elementLat,
            lon: elementLon,
            rating: element.tags.stars ? parseFloat(element.tags.stars) : null,
            opening_hours: element.tags.opening_hours || null,
          };
        })
        .filter(place => {
          const distance = parseFloat(place.distance) * 1000;
          return distance <= parseInt(radius);
        })
        .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
        .slice(0, 50); // Limit to 50 places
    }

    // Fallback to Nominatim if Overpass returns few results
    if (places.length < 5) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL));
      
      const nominatimResponse = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&lat=${lat}&lon=${lon}&tag=${searchTags}&limit=30&bounded=1&viewbox=${parseFloat(lon)-0.01},${parseFloat(lat)-0.01},${parseFloat(lon)+0.01},${parseFloat(lat)+0.01}`,
        {
          headers: {
            'User-Agent': 'TravelMate App (com.travelmate.app)',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        }
      );

      const nominatimPlaces = nominatimResponse.data.map(place => {
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
          type: place.type || 'attraction',
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
          rating: null,
          opening_hours: null,
        };
      }).filter(place => {
        const distance = parseFloat(place.distance) * 1000;
        return distance <= parseInt(radius);
      });

      places = [...places, ...nominatimPlaces];
    }

    // Remove duplicates and sort by distance
    const uniquePlaces = places.filter((place, index, self) =>
      index === self.findIndex(p => p.name === place.name && Math.abs(p.lat - place.lat) < 0.001)
    ).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

    // Save top places to DB
    if (uniquePlaces.length > 0) {
      await Place.insertMany(uniquePlaces.slice(0, 20).map(place => ({
        ...place,
        location: {
          type: 'Point',
          coordinates: [place.lon, place.lat]
        }
      })));
    }

    console.log(`Found ${uniquePlaces.length} places for category: ${category}, radius: ${radius}m`);
    res.json(uniquePlaces);
  } catch (error) {
    console.error('Places API Error:', error.response?.data || error.message);
    
    // Return fallback data if API fails
    res.json([
      {
        name: "Sample Tourist Attraction",
        address: "Sample Address",
        distance: "0.5",
        type: "tourism",
        lat: parseFloat(lat) + 0.001,
        lon: parseFloat(lon) + 0.001,
        rating: 4.5,
        opening_hours: "9:00-17:00"
      },
      {
        name: "Sample Restaurant",
        address: "Sample Restaurant Address", 
        distance: "0.8",
        type: "restaurant",
        lat: parseFloat(lat) + 0.002,
        lon: parseFloat(lon) + 0.002,
        rating: 4.2,
        opening_hours: "11:00-22:00"
      }
    ]);
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
