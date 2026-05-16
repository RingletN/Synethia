<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('melodies', function (Blueprint $table) {
            $table->id();
            // У проекта может быть 0 или 1 мелодия (пользователь мог не генерировать)
            // При повторной генерации — перезаписываем (upsert по project_id)
            $table->foreignId('project_id')->unique()->constrained()->cascadeOnDelete();

            // Результат MelodyEngine.buildNoteEvents()
            // Формат: [{ time, freq, duration, instrument, volume }]
            $table->jsonb('events')->default('[]');

            // Общая длительность (совпадает с duration из настроек, но хранится отдельно
            // т.к. это фактическая длительность сгенерированной мелодии)
            $table->unsignedSmallInteger('total_duration')->default(8);

            $table->timestamp('generated_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('melodies');
    }
};