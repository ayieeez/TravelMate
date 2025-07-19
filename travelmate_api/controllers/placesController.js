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
        searchTags = 'tourism=attraction|tourism=museum|tourism=gallery|tourism=viewpoint|historic=monument|tourism=zoo|tourism=theme_park|historic=castle|historic=archaeological_site';
        break;
      case 'restaurant':
        searchTags = 'amenity=restaurant|amenity=cafe|amenity=fast_food|amenity=bar|amenity=pub|amenity=food_court|amenity=ice_cream';
        break;
      case 'accommodation':
        searchTags = 'tourism=hotel|tourism=guest_house|tourism=hostel|tourism=motel|tourism=resort|tourism=apartment';
        break;
      case 'shopping':
        searchTags = 'shop=mall|shop=supermarket|shop=convenience|shop=department_store|amenity=marketplace|shop=clothes|shop=electronics';
        break;
      case 'entertainment':
        searchTags = 'amenity=cinema|amenity=theatre|leisure=amusement_arcade|tourism=theme_park|leisure=bowling_alley|leisure=sports_centre|amenity=nightclub';
        break;
      case 'healthcare':
        searchTags = 'amenity=hospital|amenity=clinic|amenity=pharmacy|amenity=dentist|amenity=veterinary';
        break;
      case 'education':
        searchTags = 'amenity=school|amenity=university|amenity=college|amenity=library|amenity=kindergarten';
        break;
      case 'transport':
        searchTags = 'amenity=fuel|public_transport=station|railway=station|aeroway=aerodrome|amenity=bus_station|amenity=taxi';
        break;
      default:
        searchTags = 'tourism=attraction|amenity=restaurant|amenity=cafe|shop=mall|leisure=park|tourism=museum|amenity=cinema|amenity=hospital|amenity=fuel|amenity=bank';
    }

    // Use Overpass API for better radius-based search with real places
    const tagQueries = searchTags.split('|').map(tag => `nwr[${tag}](around:${radius},${lat},${lon})`).join(';\n        ');
    
    const overpassQuery = `
      [out:json][timeout:60];
      (
        ${tagQueries};
        nwr["name"](around:${radius},${lat},${lon});
      );
      out center meta;
    `;

    console.log(`Searching for real places with radius: ${radius}m, category: ${category}`);
    console.log('Overpass query:', overpassQuery);
    
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

          // Determine place type with better logic
          let placeType = 'attraction';
          if (element.tags.amenity) {
            if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'ice_cream'].includes(element.tags.amenity)) {
              placeType = 'restaurant';
            } else if (['cinema', 'theatre', 'nightclub'].includes(element.tags.amenity)) {
              placeType = 'entertainment';
            } else if (['hospital', 'clinic', 'pharmacy', 'dentist', 'veterinary'].includes(element.tags.amenity)) {
              placeType = 'healthcare';
            } else if (['school', 'university', 'college', 'library', 'kindergarten'].includes(element.tags.amenity)) {
              placeType = 'education';
            } else if (['fuel', 'bus_station', 'taxi'].includes(element.tags.amenity)) {
              placeType = 'transport';
            } else if (['bank', 'atm', 'post_office'].includes(element.tags.amenity)) {
              placeType = 'services';
            }
          } else if (element.tags.tourism) {
            if (['hotel', 'guest_house', 'hostel', 'motel', 'resort', 'apartment'].includes(element.tags.tourism)) {
              placeType = 'accommodation';
            } else {
              placeType = 'tourism';
            }
          } else if (element.tags.shop) {
            placeType = 'shopping';
          } else if (element.tags.leisure) {
            if (['amusement_arcade', 'bowling_alley', 'sports_centre'].includes(element.tags.leisure)) {
              placeType = 'entertainment';
            } else {
              placeType = 'recreation';
            }
          } else if (element.tags.historic) {
            placeType = 'tourism';
          } else if (element.tags.railway || element.tags.public_transport || element.tags.aeroway) {
            placeType = 'transport';
          }

          // Better address formatting
          let address = '';
          if (element.tags['addr:full']) {
            address = element.tags['addr:full'];
          } else if (element.tags['addr:street']) {
            const addrParts = [
              element.tags['addr:housenumber'],
              element.tags['addr:street'],
              element.tags['addr:city'] || element.tags['addr:town'],
              element.tags['addr:postcode']
            ].filter(Boolean);
            address = addrParts.join(', ');
          } else if (element.tags['addr:city'] || element.tags['addr:town']) {
            address = element.tags['addr:city'] || element.tags['addr:town'];
          } else {
            // Fallback to coordinates only if no address info
            address = `${elementLat.toFixed(4)}, ${elementLon.toFixed(4)}`;
          }

          return {
            name: element.tags.name,
            address: address,
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
          // More strict distance filtering and quality checks
          return distance <= parseInt(radius) && 
                 place.name && 
                 place.name.length > 1 && 
                 !place.name.includes('unnamed') &&
                 !place.name.includes('FIXME');
        })
        .sort((a, b) => {
          // Sort by distance first, then by relevance (tourism attractions get priority)
          const distanceA = parseFloat(a.distance);
          const distanceB = parseFloat(b.distance);
          if (Math.abs(distanceA - distanceB) < 0.1) {
            // If distances are similar, prioritize tourism attractions
            if (a.type === 'tourism' && b.type !== 'tourism') return -1;
            if (b.type === 'tourism' && a.type !== 'tourism') return 1;
          }
          return distanceA - distanceB;
        })
        .slice(0, 50); // Limit to 50 places
    }

    // Fallback to Nominatim for more real places if Overpass returns insufficient results
    // Different thresholds based on radius - smaller areas should have fewer minimum places
    const minPlacesThreshold = radius < 1000 ? 5 : radius < 5000 ? 8 : 10;
    
    if (places.length < minPlacesThreshold) {
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

      // Category-specific searches for real places with better queries
      const categoryQueries = {
        'tourism': 'tourism=attraction,museum,gallery,viewpoint,zoo,theme_park&historic=monument,castle',
        'restaurant': 'amenity=restaurant,cafe,fast_food,bar,pub,food_court',
        'accommodation': 'tourism=hotel,guest_house,hostel,motel,resort',
        'shopping': 'shop=mall,supermarket,department_store,clothes,electronics',
        'entertainment': 'amenity=cinema,theatre,nightclub&leisure=bowling_alley,amusement_arcade,sports_centre',
        'healthcare': 'amenity=hospital,clinic,pharmacy,dentist',
        'education': 'amenity=school,university,college,library',
        'transport': 'amenity=fuel,bus_station&railway=station&public_transport=station',
        'all': 'tourism=attraction,museum&amenity=restaurant,cafe,cinema,hospital,fuel&shop=mall'
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

    // Remove duplicates with improved logic and sort by relevance
    const uniquePlaces = places.filter((place, index, self) => {
      // More sophisticated duplicate detection
      return index === self.findIndex(p => {
        const nameMatch = p.name.toLowerCase() === place.name.toLowerCase();
        const locationMatch = Math.abs(p.lat - place.lat) < 0.001 && Math.abs(p.lon - place.lon) < 0.001;
        return nameMatch || locationMatch;
      });
    }).sort((a, b) => {
      // Enhanced sorting: distance + type priority + quality score
      const distanceA = parseFloat(a.distance);
      const distanceB = parseFloat(b.distance);
      
      // Type priority (tourism > restaurant > shopping > others)
      const typePriority = { 'tourism': 1, 'restaurant': 2, 'shopping': 3, 'entertainment': 4 };
      const priorityA = typePriority[a.type] || 9;
      const priorityB = typePriority[b.type] || 9;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return distanceA - distanceB;
    });

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
      res.json({
        places: [],
        message: `No ${category === 'all' ? 'places' : category} found within ${radius}m. Try increasing the search radius.`,
        suggestions: ['Increase search radius', 'Try different category', 'Check your location']
      });
    } else {
      // Return optimized results with metadata
      const results = uniquePlaces.slice(0, 50); // Limit to 50 most relevant places
      res.json({
        places: results,
        total: results.length,
        category: category,
        radius: `${radius}m`,
        center: { lat: parseFloat(lat), lon: parseFloat(lon) }
      });
    }
  } catch (error) {
    console.error('Places API Error Details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.response?.config?.url
    });
    
    // Even on error, try to return empty array instead of fake data
    res.status(500).json({ 
      error: "Failed to fetch real places", 
      message: "Please try increasing the search radius or check your internet connection",
      places: [],
      debug: error.message
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
