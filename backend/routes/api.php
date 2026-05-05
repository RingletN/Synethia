<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ProfilePhotoController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Route::get('/users', [UserController::class, 'index']);
// Route::get('/users/{id}', [UserController::class, 'show']);
// Route::post('/users', [UserController::class, 'store']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);

        Route::put('/profile', [AuthController::class, 'updateProfile']);         // обновление данных
    Route::post('/profile/photo', [ProfilePhotoController::class, 'upload']); // загрузка фото
    Route::delete('/profile/photo', [ProfilePhotoController::class, 'destroy']); // удаление фото
    Route::post('/logout', [AuthController::class, 'logout']);
});