<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use MongoDB\Client;

class PlacesController extends Controller
{
    protected $mongo;


    private $lastRequestTime = 0;
    private const RATE_LIMIT_INTERVAL = 1.0;

      public function __construct()
    {
        $this->mongo = app(Client::class);
    }

    public function getNearbyPlaces(Request $request)
    {
        $lat = $request->query('lat');
        $lon = $request->query('lon');

        // Validate coordinates
        if (!is_numeric($lat) || !is_numeric($lon)) {
            return response()->json(['error' => 'Invalid coordinates'], 400);
        }

        try {
            // Try to get from cache
            $cacheKey = "places_{$lat}_{$lon}";
            $cached = $this->getFromCache($cacheKey);

            if ($cached) {
                return response()->json($cached);
            }

            // ===== RATE LIMITING FOR REVERSE GEOCODING =====
            $currentTime = microtime(true);
            $elapsed = $currentTime - $this->lastRequestTime;

            if ($elapsed < self::RATE_LIMIT_INTERVAL) {
                usleep((self::RATE_LIMIT_INTERVAL - $elapsed) * 1000000);
            }
            $this->lastRequestTime = microtime(true);
            // ===== END RATE LIMITING =====

            // Step 1: Reverse geocoding to get location details
            $reverseResponse = Http::withHeaders([
                'User-Agent' => 'TravelMate App (com.travelmate.app)',
                'Accept-Language' => 'en-US,en;q=0.9'
            ])->get("https://nominatim.openstreetmap.org/reverse", [
                'format' => 'json',
                'lat' => $lat,
                'lon' => $lon,
                'zoom' => 18,
                'addressdetails' => 1
            ]);

            if (!$reverseResponse->successful()) {
                return response()->json(['error' => 'Reverse geocoding failed'], 500);
            }

            $reverseData = $reverseResponse->json();
            $address = $reverseData['address'];
            $city = $address['city'] ?? $address['town'] ?? $address['village'] ?? $address['county'] ?? null;
            $country = $address['country'] ?? null;

            if (!$city) {
                return response()->json(['error' => 'Location not recognized'], 404);
            }

            // ===== RATE LIMITING FOR PLACES SEARCH =====
            $currentTime = microtime(true);
            $elapsed = $currentTime - $this->lastRequestTime;

            if ($elapsed < self::RATE_LIMIT_INTERVAL) {
                usleep((self::RATE_LIMIT_INTERVAL - $elapsed) * 1000000);
            }
            $this->lastRequestTime = microtime(true);
            // ===== END RATE LIMITING =====

            // Step 2: Search for places in the area
            $placesResponse = Http::withHeaders([
                'User-Agent' => 'TravelMate App (com.travelmate.app)',
                'Accept-Language' => 'en-US,en;q=0.9'
            ])->get("https://nominatim.openstreetmap.org/search", [
                'format' => 'json',
                'city' => $city,
                'country' => $country,
                'tag' => 'tourism|restaurant',
                'limit' => 20
            ]);

            if (!$placesResponse->successful()) {
                return response()->json(['error' => 'Places search failed'], 500);
            }

            $places = $placesResponse->json();
            $result = [];

            foreach ($places as $place) {
                $distance = $this->calculateDistance($lat, $lon, $place['lat'], $place['lon']);
                $result[] = [
                    'name' => $place['display_name'] ? explode(',', $place['display_name'])[0] : 'Unnamed Place',
                    'address' => $place['display_name'],
                    'distance' => round($distance / 1000, 1), // Convert to km
                    'type' => $place['type'],
                    'lat' => $place['lat'],
                    'lon' => $place['lon']
                ];
            }

            // Sort by distance
            usort($result, function($a, $b) {
                return $a['distance'] <=> $b['distance'];
            });

            $placesData = array_slice($result, 0, 15); // Return top 15 results

            // Cache for 1 hour
            $this->cacheResponse($cacheKey, $placesData, 3600);

            return response()->json($placesData);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
    {
        $R = 6371000; // Earth radius in meters
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $deltaPhi = deg2rad($lat2 - $lat1);
        $deltaLambda = deg2rad($lon2 - $lon1);

        $a = sin($deltaPhi/2) * sin($deltaPhi/2) +
              cos($phi1) * cos($phi2) *
              sin($deltaLambda/2) * sin($deltaLambda/2);
        $c = 2 * atan2(sqrt($a), sqrt(1-$a));

        return $R * $c; // Distance in meters
    }

    private function getFromCache($key)
    {
        $collection = $this->mongo->travelmate_db->api_cache;
        $document = $collection->findOne(['key' => $key, 'expires_at' => ['$gt' => time()]]);

        return $document ? $document['value'] : null;
    }

    private function cacheResponse($key, $value, $ttl)
    {
        $collection = $this->mongo->travelmate_db->api_cache;
        $collection->updateOne(
            ['key' => $key],
            [
                '$set' => [
                    'value' => $value,
                    'expires_at' => time() + $ttl,
                    'created_at' => time()
                ]
            ],
            ['upsert' => true]
        );
    }
}
