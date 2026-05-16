<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->unique()->constrained()->cascadeOnDelete();

            // Из SettingsPanel: bpm (40–180), duration в секундах (5–90)
            $table->unsignedSmallInteger('bpm')->default(80);
            $table->unsignedSmallInteger('duration')->default(8); // секунды

            // 'major' или 'minor'
            $table->string('scale', 10)->default('major');

            // Smoothing (0–100)
            $table->unsignedSmallInteger('smoothing')->default(30);

            // Эффекты (0.00–1.00)
            $table->decimal('reverb', 4, 2)->default(0.00);
            $table->decimal('delay', 4, 2)->default(0.00);
            $table->decimal('distortion', 4, 2)->default(0.00);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_settings');
    }
};