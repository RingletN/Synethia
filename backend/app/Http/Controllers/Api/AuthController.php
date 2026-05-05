<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'nickname' => 'required|string|max:255|unique:users',
                'email' => 'required|email|unique:users',
                'password' => 'required|string|min:6',
            ]);

            $validated['password'] = Hash::make($validated['password']);
            $validated['registration_date'] = now()->toDateString();

            $user = User::create($validated);

            auth()->login($user); // сессия

            return response()->json([
                'user' => $user,
                'message' => 'Регистрация успешна'
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Ошибка регистрации',
                'error' => $e->getMessage()
            ], 422);
        }
    }

    public function login(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
            ]);

            $user = User::where('email', $request->email)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                return response()->json([
                    'message' => 'Неверный email или пароль'
                ], 401);
            }

            auth()->login($user);

            return response()->json([
                'user' => $user,
                'message' => 'Вход выполнен успешно'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Ошибка входа',
                'error' => $e->getMessage()
            ], 422);
        }
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $rules = [
            'name' => 'sometimes|string|max:255',
            'nickname' => 'sometimes|string|max:255|unique:users,nickname,' . $user->id,
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'sometimes|string|min:6',
        ];

        $validated = $request->validate($rules);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'user' => $user,
            'message' => 'Профиль обновлён'
        ]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user() ?? auth()->user());
    }

    public function logout(Request $request)
    {
        auth()->logout();
        return response()->json(['message' => 'Вы вышли из аккаунта']);
    }
}