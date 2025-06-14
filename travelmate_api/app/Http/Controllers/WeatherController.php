<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use MongoDB\Client;

class WeatherController extends Controller
{
    protected $mongo;

    public function __construct()
    {
        $this->mongo = app(Client::class);
    }

    public function getWeather(Request $request)
    {
        $lat = $request->query('lat');
        $lon = $request->query('lon');

        // Validate coordinates
        if (!is_numeric($lat) || !is_numeric($lon)) {
            return response()->json(['error' => 'Invalid coordinates'], 400);
        }

        try {
            // Try to get from cache
            $cacheKey = "weather_{$lat}_{$lon}";
            $cached = $this->getFromCache($cacheKey);

            if ($cached) {
                return response()->json($cached);
            }

            // Get from API
            $response = Http::get("https://api.openweathermap.org/data/2.5/weather", [
                'lat' => $lat,
                'lon' => $lon,
                'units' => 'metric',
                'appid' => env('OPENWEATHER_API_KEY')
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $weatherData = [
                    'temp' => $data['main']['temp'],
                    'description' => $data['weather'][0]['description'],
                    'icon' => $data['weather'][0]['icon'],
                    'humidity' => $data['main']['humidity'],
                    'city' => $data['name'],
                    'country' => $data['sys']['country'] ?? null,
                ];

                // Cache for 10 minutes
                $this->cacheResponse($cacheKey, $weatherData, 600);

                return response()->json($weatherData);
            }

            return response()->json(['error' => 'Weather API failed'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
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
