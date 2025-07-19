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

    // Use Overpass API for better radius-based search with real places
    const overpassQuery = `
      [out:json][timeout:60];
      (
        nwr[${searchTags.replace(/\|/g, '](around:' + radius + ',' + lat + ',' + lon + ');nwr[')}](around:${radius},${lat},${lon});
        nwr["name"](around:${radius},${lat},${lon});
      );
      out center meta;
    `;

    console.log(`Searching for real places with radius: ${radius}m, category: ${category}`);
    
    const overpassResponse = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'TravelMate App (com.travelmate.app)',
        },
        timeout: 30000 // 30 second timeout
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

    // Fallback to Nominatim for more real places if Overpass returns few results
    if (places.length < 10) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_INTERVAL));
      
      console.log(`Overpass returned ${places.length} places, trying Nominatim for more real places...`);
      
      // Multiple Nominatim searches for comprehensive results
      const searches = [];
      
      // Search by category with larger area
      const viewboxSize = Math.min(radius / 111320, 0.5); // Convert to degrees, max 0.5 degrees
      searches.push(
        axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&lat=${lat}&lon=${lon}&addressdetails=1&extratags=1&limit=50&bounded=1&viewbox=${parseFloat(lon)-viewboxSize},${parseFloat(lat)-viewboxSize},${parseFloat(lon)+viewboxSize},${parseFloat(lat)+viewboxSize}`,
          {
            headers: {
              'User-Agent': 'TravelMate App (com.travelmate.app)',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          }
        )
      );

      // Category-specific searches for real places
      const categoryQueries = {
        'tourism': 'tourism=attraction,museum,gallery,viewpoint,zoo,theme_park',
        'restaurant': 'amenity=restaurant,cafe,fast_food,bar,pub',
        'accommodation': 'tourism=hotel,guest_house,hostel',
        'shopping': 'shop=mall,supermarket,department_store',
        'entertainment': 'amenity=cinema,theatre,leisure=bowling_alley,amusement_arcade',
        'all': 'tourism=attraction,museum,gallery&amenity=restaurant,cafe,cinema'
      };

      const categoryQuery = categoryQueries[category] || categoryQueries['all'];
      searches.push(
        axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${categoryQuery}&lat=${lat}&lon=${lon}&addressdetails=1&limit=30&bounded=1&viewbox=${parseFloat(lon)-viewboxSize},${parseFloat(lat)-viewboxSize},${parseFloat(lon)+viewboxSize},${parseFloat(lat)+viewboxSize}`,
          {
            headers: {
              'User-Agent': 'TravelMate App (com.travelmate.app)',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          }
        )
      );

      try {
        const responses = await Promise.all(searches);
        const allNominatimData = responses.flatMap(response => response.data);

        const nominatimPlaces = allNominatimData
          .filter(place => place.display_name && place.lat && place.lon)
          .map(place => {
            const distance = calculateDistance(
              parseFloat(lat),
              parseFloat(lon),
              parseFloat(place.lat),
              parseFloat(place.lon)
            );

            // Get proper place name
            let placeName = place.display_name?.split(',')[0] || 'Unnamed Place';
            if (place.name) placeName = place.name;
            if (place.address?.amenity) placeName = place.address.amenity;
            if (place.address?.tourism) placeName = place.address.tourism;

            // Get proper address
            let address = place.display_name;
            if (place.address) {
              const addr = place.address;
              address = [addr.house_number, addr.road, addr.city || addr.town || addr.village, addr.country]
                .filter(Boolean)
                .join(', ');
            }

            return {
              name: placeName,
              address: address || place.display_name,
              distance: (distance / 1000).toFixed(1),
              type: place.type || place.class || 'attraction',
              lat: parseFloat(place.lat),
              lon: parseFloat(place.lon),
              rating: null,
              opening_hours: place.extratags?.opening_hours || null,
            };
          })
          .filter(place => {
            const distance = parseFloat(place.distance) * 1000;
            return distance <= parseInt(radius) && place.name !== 'Unnamed Place';
          });

        places = [...places, ...nominatimPlaces];
        console.log(`Added ${nominatimPlaces.length} real places from Nominatim`);
      } catch (nominatimError) {
        console.error('Nominatim search failed:', nominatimError.message);
      }
    }

    // Remove duplicates and sort by distance
    const uniquePlaces = places.filter((place, index, self) =>
      index === self.findIndex(p => 
        p.name === place.name && 
        Math.abs(p.lat - place.lat) < 0.001 &&
        Math.abs(p.lon - place.lon) < 0.001
      )
    ).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

    // Save top places to DB
    if (uniquePlaces.length > 0) {
      try {
        await Place.insertMany(uniquePlaces.slice(0, 30).map(place => ({
          ...place,
          location: {
            type: 'Point',
            coordinates: [place.lon, place.lat]
          }
        })));
      } catch (dbError) {
        console.log('Database save failed:', dbError.message);
      }
    }

    console.log(`Found ${uniquePlaces.length} REAL places for category: ${category}, radius: ${radius}m`);
    
    // Return real places only - NO FAKE DATA
    if (uniquePlaces.length === 0) {
      console.log('No real places found in the specified area');
      res.json([]);
    } else {
      res.json(uniquePlaces.slice(0, 100)); // Return up to 100 real places
    }
  } catch (error) {
    console.error('Places API Error:', error.response?.data || error.message);
    
    // Even on error, try to return empty array instead of fake data
    res.status(500).json({ 
      error: "Failed to fetch real places", 
      message: "Please try increasing the search radius or check your internet connection",
      places: []
    });
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
