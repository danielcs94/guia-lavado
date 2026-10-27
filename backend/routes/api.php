<?php

use App\Http\Controllers\ApplianceController;
use App\Http\Controllers\LabelController;
use App\Http\Controllers\LoadController;
use Illuminate\Support\Facades\Route;

Route::post('/labels/scan', [LabelController::class, 'scan']);
Route::post('/labels/advice', [LabelController::class, 'advise']);

Route::post('/loads/plan', [LoadController::class, 'plan']);

Route::get('/appliances', [ApplianceController::class, 'index']);
Route::post('/appliances', [ApplianceController::class, 'store']);
Route::post('/appliances/scan', [ApplianceController::class, 'scan']);
Route::put('/appliances/{appliance}', [ApplianceController::class, 'update']);
Route::delete('/appliances/{appliance}', [ApplianceController::class, 'destroy']);
