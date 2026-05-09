<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class PasswordResetController extends Controller
{
    // Шаг 1: отправить код
    public function sendCode(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        // Не раскрываем существует ли email — всегда 200
        if (!$user) {
            return response()->json(['message' => 'Если email зарегистрирован, код отправлен']);
        }

        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $request->email],
            [
                'token' => Hash::make($code), // token не используем, но поле required
                'code'  => $code,
                'created_at' => Carbon::now(),
            ]
        );

        // Отправляем письмо
        Mail::raw("Ваш код восстановления доступа: {$code}\n\nКод действителен 15 минут.", function ($message) use ($request) {
            $message->to($request->email)
                    ->subject('Восстановление доступа — Synethia');
        });

        return response()->json(['message' => 'Код отправлен']);
    }

    // Шаг 2: проверить код (без перехода, просто валидация)
    public function verifyCode(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code'  => 'required|string',
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$record || $record->code !== $request->code) {
            return response()->json(['error' => 'Неверный код'], 422);
        }

        // Проверяем не истёк ли (15 минут)
        if (Carbon::parse($record->created_at)->addMinutes(15)->isPast()) {
            return response()->json(['error' => 'Код устарел, запросите новый'], 422);
        }

        return response()->json(['valid' => true]);
    }

    // Шаг 3: сбросить пароль
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'code'     => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$record || $record->code !== $request->code) {
            return response()->json(['error' => 'Неверный код'], 422);
        }

        if (Carbon::parse($record->created_at)->addMinutes(15)->isPast()) {
            return response()->json(['error' => 'Код устарел'], 422);
        }

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['error' => 'Пользователь не найден'], 404);
        }

        $user->password = Hash::make($request->password);
        $user->save();

        // Удаляем использованный токен
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return response()->json(['message' => 'Пароль успешно изменён']);
    }
}
