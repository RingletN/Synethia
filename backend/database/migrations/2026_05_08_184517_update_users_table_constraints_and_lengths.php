<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // name — ограничение длины + только буквы и пробелы
            $table->string('name', 60)->change();

            // nickname — ограничение длины + уникальность уже есть
            $table->string('nickname', 30)->change();

            // email — можно чуть увеличить лимит
            $table->string('email', 255)->change();

            // profile_photo — на всякий случай
            $table->string('profile_photo')->nullable()->change();

            // registration_date — делаем not null
            $table->date('registration_date')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('name')->change();
            $table->string('nickname')->change();
            $table->string('email')->change();
            $table->date('registration_date')->nullable()->change();
        });
    }
};