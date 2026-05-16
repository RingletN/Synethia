<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ProfilePhotoController;
use App\Http\Controllers\Api\PasswordResetController;
 use App\Http\Controllers\Api\ProjectController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::post('/forgot-password/send-code',   [PasswordResetController::class, 'sendCode']);
Route::post('/forgot-password/verify-code', [PasswordResetController::class, 'verifyCode']);
Route::post('/forgot-password/reset',       [PasswordResetController::class, 'resetPassword']);

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

    Route::get('/projects',        [ProjectController::class, 'index']);
    Route::get('/projects/{id}',   [ProjectController::class, 'show']);
    Route::post('/projects',       [ProjectController::class, 'store']);
    Route::delete('/projects/{id}',[ProjectController::class, 'destroy']);
});