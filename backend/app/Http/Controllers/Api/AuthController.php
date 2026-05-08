<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), User::rules());

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors'  => $validator->errors()
            ], 422);
        }

        try {
            $validated = $validator->validated(); // или $request->all(), но лучше validated()
            $validated['password'] = Hash::make($validated['password']);
            $validated['registration_date'] = now()->toDateString();

            $user = User::create($validated);

            auth()->login($user);

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

        $validator = Validator::make($request->all(), User::rules($user->id));

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors'  => $validator->errors()
            ], 422);
        }

        try {
            $validated = $validator->validated();

            if (isset($validated['password'])) {
                $validated['password'] = Hash::make($validated['password']);
            }

            $user->update($validated);

            return response()->json([
                'user' => $user,
                'message' => 'Профиль обновлён'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Ошибка обновления профиля',
                'error' => $e->getMessage()
            ], 422);
        }
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