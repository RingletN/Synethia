<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();
        return response()->json($users);
    }

    public function show($id)
    {
        $user = User::findOrFail($id);
        return response()->json($user);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'nickname' => 'required|string|max:255|unique:users',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:6',
            'profile_photo' => 'nullable|string|max:255',
            // 'registration_date' => 'required|date',
        ]);

        $validated['password'] = Hash::make($validated['password']);
        $validated['registration_date'] = now()->toDateString(); // текущая дата YYYY-MM-DD

        $user = User::create($validated);
        return response()->json($user, 201);
    }

    /*Обновление профиля текущего аутентифицированного пользователя*/
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate(User::updateRules($user->id));

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json($user);
    }
}