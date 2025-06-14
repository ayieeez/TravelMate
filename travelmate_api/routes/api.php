<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\WeatherController;
use App\Http\Controllers\PlacesController;
use App\Http\Controllers\CurrencyController;

Route::get('/weather', [WeatherController::class, 'getWeather']);
Route::get('/places', [PlacesController::class, 'getNearbyPlaces']);
Route::get('/currency', [CurrencyController::class, 'getExchangeRate']);

Route::middleware('auth:api')->get('/user', function (Request $request) {
    return $request->user();
});
