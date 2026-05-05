<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nickname')->unique()->after('name')->comment('Уникальный псевдоним');
            $table->string('profile_photo')->nullable()->after('email')->comment('Фото профиля (путь)');
            $table->date('registration_date')->after('profile_photo')->comment('Дата регистрации');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['nickname', 'profile_photo', 'registration_date']);
        });
    }
};