<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class CheckUniqueController extends Controller
{
    public function check(Request $request)
    {
        $request->validate([
            'nickname' => 'nullable|string',
            'email'    => 'nullable|email',
        ]);

        $userId = $request->user()?->id; // для исключения самого себя при обновлении

        $response = [];

        if ($request->has('nickname')) {
            $exists = User::where('nickname', $request->nickname)
                ->when($userId, fn($q) => $q->where('id', '!=', $userId))
                ->exists();
            $response['nickname'] = $exists ? 'Этот псевдоним уже занят' : null;
        }

        if ($request->has('email')) {
            $exists = User::where('email', $request->email)
                ->when($userId, fn($q) => $q->where('id', '!=', $userId))
                ->exists();
            $response['email'] = $exists ? 'Этот email уже зарегистрирован' : null;
        }

        return response()->json($response);
    }
}