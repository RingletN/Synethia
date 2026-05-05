<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfilePhotoController extends Controller
{
public function upload(Request $request)
{
    $request->validate([
        'photo' => 'required|image|max:2048',
    ]);

    $user = $request->user();

    // Удаляем старое фото
    if ($user->profile_photo && Storage::disk('public')->exists(str_replace('/storage/', '', $user->profile_photo))) {
        Storage::disk('public')->delete(str_replace('/storage/', '', $user->profile_photo));
    }

    // Сохраняем новое
    $path = $request->file('photo')->store('profile_photos', 'public');
    
    // Проверим, что файл действительно сохранился
    if (!$path || !Storage::disk('public')->exists($path)) {
        return response()->json(['message' => 'Не удалось сохранить файл'], 500);
    }

    $user->profile_photo = '/storage/' . $path;
    $user->save();

    // Возвращаем полный URL (для проверки)
    return response()->json([
        'photo_url' => $user->profile_photo,
        'full_url' => asset($user->profile_photo) // для отладки
    ]);
}

    public function destroy(Request $request)
    {
        $user = $request->user();
        if ($user->profile_photo && Storage::disk('public')->exists(str_replace('/storage/', '', $user->profile_photo))) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $user->profile_photo));
        }
        $user->profile_photo = null;
        $user->save();

        return response()->json(['message' => 'Фото удалено']);
    }
}