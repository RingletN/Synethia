<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        
        // Главное для Sanctum SPA
        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
        ]);

        // Отключаем редирект на login для API
        $middleware->redirectGuestsTo(null);

    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Чтобы при ошибках возвращался JSON
        $exceptions->render(function (\Throwable $e) {
            if (request()->is('api/*')) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'error' => class_basename($e)
                ], 500);
            }
        });
    })->create();