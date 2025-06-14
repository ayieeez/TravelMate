<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use MongoDB\Client;

class CurrencyController extends Controller
{
    protected $mongo;

    public function __construct()
    {
        $this->mongo = app(Client::class);
    }

    public function getExchangeRate(Request $request)
    {
        $base = $request->query('base');
        $target = $request->query('target');

        // Validate currencies
        if (!$base || !$target) {
            return response()->json(['error' => 'Missing currency codes'], 400);
        }

        try {
            // Try to get from cache
            $cacheKey = "currency_{$base}_{$target}";
            $cached = $this->getFromCache($cacheKey);

            if ($cached) {
                return response()->json(['rate' => $cached]);
            }

            // Use Frankfurter API (no key required)
            $response = Http::get("https://api.frankfurter.app/latest", [
                'from' => $base,
                'to' => $target
            ]);

            $rate = null;

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['rates'][$target])) {
                    $rate = $data['rates'][$target];
                }
            }

            if (!$rate) {
                // Fallback to ExchangeRate-API
                $fallbackResponse = Http::get("https://open.er-api.com/v6/latest/{$base}");
                if ($fallbackResponse->successful()) {
                    $fallbackData = $fallbackResponse->json();
                    if ($fallbackData['result'] === 'success' && isset($fallbackData['rates'][$target])) {
                        $rate = $fallbackData['rates'][$target];
                    }
                }
            }

            if (!$rate) {
                // Final fallback: fixed rates for common pairs
                $rate = $this->getFixedRates($base, $target);
                if (!$rate) {
                    return response()->json(['error' => 'Currency conversion failed'], 500);
                }
            }

            // Cache for 1 hour
            $this->cacheResponse($cacheKey, $rate, 3600);

            return response()->json(['rate' => $rate]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function getFixedRates($base, $target)
    {
        $fixedRates = [
            'USD_EUR' => 0.93,
            'EUR_USD' => 1.07,
            'USD_GBP' => 0.79,
            'GBP_USD' => 1.27,
            'USD_JPY' => 147.50,
            'JPY_USD' => 0.0068,
            'USD_MYR' => 4.68,
            'MYR_USD' => 0.21
        ];

        $pair = "{$base}_{$target}";
        return $fixedRates[$pair] ?? null;
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
