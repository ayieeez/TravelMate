const axios = require('axios');
const Place = require('../models/Place');

class PlacesDataService {
  constructor() {
    this.lastRequestTime = 0;
    this.RATE_LIMIT_INTERVAL = 1200;
  }

  async collectAndStoreData(lat, lon, radius, category) {
    console.log(`Collecting data for ${category} within ${radius}m of ${lat}, ${lon}`);
    
    // Check if we have recent data for this location
    const existingData = await this.checkExistingData(lat, lon, radius, category);
    if (existingData.length > 0) {
      console.log(`Found ${existingData.length} existing places in database`);
      return existingData;
    }

    // Collect fresh data from external APIs
    const collectedPlaces = [];
    
    try {
      // Collect from Overpass API
      const overpassPlaces = await this.collectFromOverpass(lat, lon, radius, category);
      collectedPlaces.push(...overpassPlaces);
      
      // Collect from Nominatim API  
      const nominatimPlaces = await this.collectFromNominatim(lat, lon, radius, category);
      collectedPlaces.push(...nominatimPlaces);
      
      // Remove duplicates and store in MongoDB
      const uniquePlaces = this.removeDuplicates(collectedPlaces);
      const storedPlaces = await this.storePlaces(uniquePlaces, lat, lon, radius, category);
      
      console.log(`Stored ${storedPlaces.length} new places in database`);
      return storedPlaces;
      
    } catch (error) {
      console.error('Data collection failed:', error);
      throw error;
    }
  }

  async checkExistingData(lat, lon, radius, category) {
    try {
      // Ensure geospatial index exists before querying
      await this.ensureGeospatialIndex();
      
      // Look for places within the search area that were collected recently (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      let existingPlaces;
      try {
        existingPlaces = await Place.find({
          $and: [
            {
              location: {
                $near: {
                  $geometry: { type: 'Point', coordinates: [lon, lat] },
                  $maxDistance: radius
                }
              }
            },
            { category: category === 'all' ? { $exists: true } : category },
            { created_at: { $gte: oneDayAgo } }
          ]
        }).limit(50);
      } catch (geoQueryError) {
        console.log('Geospatial query failed in checkExistingData, using fallback');
        
        // Fallback: Get recent places and filter manually
        existingPlaces = await Place.find({
          $and: [
            { category: category === 'all' ? { $exists: true } : category },
            { created_at: { $gte: oneDayAgo } }
          ]
        }).limit(100);
        
        // Manual distance filtering
        existingPlaces = existingPlaces.filter(place => {
          if (!place.location || !place.location.coordinates) return false;
          const distance = this.calculateDistance(
            lat, lon,
            place.location.coordinates[1], place.location.coordinates[0]
          );
          return distance <= radius;
        }).slice(0, 50);
      }

      return existingPlaces;
    } catch (error) {
      console.error('Database query failed:', error);
      return [];
    }
  }

  async collectFromOverpass(lat, lon, radius, category) {
    const places = [];
    
    try {
      await this.rateLimitCheck();
      
      const searchTags = this.getSearchTags(category);
      const tagQueries = searchTags.split('|').map(tag => 
        `nwr[${tag}](around:${radius},${lat},${lon})`
      ).join(';\n        ');
      
      const overpassQuery = `
        [out:json][timeout:60];
        (
          ${tagQueries};
        );
        out center meta;
      `;

      const response = await axios.post(
        'https://overpass-api.de/api/interpreter',
        overpassQuery,
        {
          headers: { 
            'Content-Type': 'text/plain',
            'User-Agent': 'TravelMate App (com.travelmate.app)'
          },
          timeout: 30000
        }
      );

      if (response.data?.elements) {
        response.data.elements.forEach(element => {
          if (element.tags?.name) {
            const place = this.processOverpassElement(element, lat, lon);
            if (place) places.push(place);
          }
        });
      }
      
    } catch (error) {
      console.error('Overpass API error:', error.message);
    }
    
    return places;
  }

  async collectFromNominatim(lat, lon, radius, category) {
    const places = [];
    
    try {
      await this.rateLimitCheck();
      
      const viewboxSize = Math.min(radius / 111320, 0.3);
      const url = `https://nominatim.openstreetmap.org/search?format=json&lat=${lat}&lon=${lon}&addressdetails=1&extratags=1&limit=20&bounded=1&viewbox=${parseFloat(lon)-viewboxSize},${parseFloat(lat)-viewboxSize},${parseFloat(lon)+viewboxSize},${parseFloat(lat)+viewboxSize}`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'TravelMate App (com.travelmate.app)' },
        timeout: 15000
      });

      if (response.data) {
        response.data.forEach(place => {
          if (place.display_name && place.lat && place.lon) {
            const processedPlace = this.processNominatimPlace(place, lat, lon);
            if (processedPlace) places.push(processedPlace);
          }
        });
      }
      
    } catch (error) {
      console.error('Nominatim API error:', error.message);
    }
    
    return places;
  }

  processOverpassElement(element, searchLat, searchLon) {
    const elementLat = element.lat || element.center?.lat || 0;
    const elementLon = element.lon || element.center?.lon || 0;
    
    const distance = this.calculateDistance(searchLat, searchLon, elementLat, elementLon);
    const placeType = this.determineType(element.tags);
    
    return {
      name: element.tags.name,
      address: this.formatAddress(element.tags),
      type: placeType,
      category: this.mapToCategory(placeType),
      location: {
        type: 'Point',
        coordinates: [elementLon, elementLat]
      },
      distance: distance,
      rating: element.tags.stars ? parseFloat(element.tags.stars) : null,
      opening_hours: element.tags.opening_hours || null,
      source: 'overpass',
      source_id: element.id?.toString(),
      tags: element.tags,
      search_center: { latitude: searchLat, longitude: searchLon }
    };
  }

  processNominatimPlace(place, searchLat, searchLon) {
    const distance = this.calculateDistance(
      searchLat, searchLon, 
      parseFloat(place.lat), parseFloat(place.lon)
    );
    
    return {
      name: place.name || place.display_name?.split(',')[0] || 'Unnamed Place',
      address: this.formatNominatimAddress(place),
      type: place.type || place.class || 'attraction',
      category: this.mapToCategory(place.type || place.class || 'attraction'),
      location: {
        type: 'Point',
        coordinates: [parseFloat(place.lon), parseFloat(place.lat)]
      },
      distance: distance,
      rating: null,
      opening_hours: place.extratags?.opening_hours || null,
      source: 'nominatim',
      source_id: place.place_id?.toString(),
      tags: place.extratags || {},
      search_center: { latitude: searchLat, longitude: searchLon }
    };
  }

  async storePlaces(places, searchLat, searchLon, radius, category) {
    const storedPlaces = [];
    
    for (const place of places) {
      try {
        place.search_radius = radius;
        place.category = category === 'all' ? place.category : category;
        
        // Upsert: update if exists, insert if new
        const stored = await Place.findOneAndUpdate(
          {
            name: place.name,
            'location.coordinates': place.location.coordinates
          },
          { ...place, updated_at: new Date() },
          { upsert: true, new: true }
        );
        
        storedPlaces.push(stored);
      } catch (error) {
        console.error(`Failed to store place ${place.name}:`, error.message);
      }
    }
    
    return storedPlaces;
  }

  removeDuplicates(places) {
    const seen = new Set();
    return places.filter(place => {
      const key = `${place.name.toLowerCase()}_${place.location.coordinates[0].toFixed(3)}_${place.location.coordinates[1].toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Helper methods
  getSearchTags(category) {
    const tags = {
      'tourism': 'tourism=attraction|tourism=museum|tourism=gallery|tourism=viewpoint|historic=monument|tourism=zoo|tourism=theme_park|historic=castle',
      'restaurant': 'amenity=restaurant|amenity=cafe|amenity=fast_food|amenity=bar|amenity=pub|amenity=food_court|amenity=ice_cream',
      'accommodation': 'tourism=hotel|tourism=guest_house|tourism=hostel|tourism=motel|tourism=resort|amenity=homestay',
      'shopping': 'shop=mall|shop=supermarket|shop=convenience|shop=department_store|amenity=marketplace',
      'entertainment': 'amenity=cinema|amenity=theatre|leisure=amusement_arcade|tourism=theme_park|leisure=bowling_alley',
      'healthcare': 'amenity=hospital|amenity=clinic|amenity=pharmacy|amenity=dentist',
      'transport': 'amenity=fuel|public_transport=station|railway=station|aeroway=aerodrome'
    };
    
    return tags[category] || 'tourism=attraction|amenity=restaurant|shop=mall|leisure=park|tourism=museum';
  }

  determineType(tags) {
    if (tags.amenity) {
      if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(tags.amenity)) return 'restaurant';
      if (['cinema', 'theatre'].includes(tags.amenity)) return 'entertainment';
      if (['hospital', 'clinic', 'pharmacy'].includes(tags.amenity)) return 'healthcare';
      if (['fuel', 'bus_station'].includes(tags.amenity)) return 'transport';
      if (['homestay'].includes(tags.amenity)) return 'accommodation';
    }
    if (tags.tourism) {
      if (['hotel', 'guest_house', 'hostel', 'motel', 'resort'].includes(tags.tourism)) return 'accommodation';
      return 'tourism';
    }
    if (tags.shop) return 'shopping';
    if (tags.leisure) return 'entertainment';
    if (tags.historic) return 'tourism';
    return 'attraction';
  }

  mapToCategory(type) {
    const mapping = {
      'restaurant': 'restaurant',
      'accommodation': 'accommodation', 
      'tourism': 'tourism',
      'shopping': 'shopping',
      'entertainment': 'entertainment',
      'healthcare': 'healthcare',
      'transport': 'transport'
    };
    return mapping[type] || 'tourism';
  }

  formatAddress(tags) {
    if (tags['addr:full']) return tags['addr:full'];
    
    const parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:city'] || tags['addr:town'],
      tags['addr:postcode']
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  }

  formatNominatimAddress(place) {
    if (place.address) {
      const addr = place.address;
      return [addr.house_number, addr.road, addr.city || addr.town, addr.country]
        .filter(Boolean).join(', ');
    }
    return place.display_name || 'Address not available';
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
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

  async rateLimitCheck() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.RATE_LIMIT_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_INTERVAL - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  // Ensure geospatial index exists for MongoDB queries
  async ensureGeospatialIndex() {
    try {
      // Check if the index already exists
      const indexes = await Place.collection.getIndexes();
      const hasGeoIndex = Object.keys(indexes).some(indexName => 
        indexes[indexName].some(field => field[0] === 'location' && field[1] === '2dsphere')
      );

      if (!hasGeoIndex) {
        console.log('Creating geospatial index for location field...');
        await Place.collection.createIndex({ location: '2dsphere' });
        console.log('✅ Geospatial index created successfully');
      }
    } catch (error) {
      console.error('Failed to create geospatial index:', error.message);
      // Continue without index - will use alternative query approach
    }
  }
}

module.exports = new PlacesDataService();
