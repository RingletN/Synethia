<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('canvases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->unique()->constrained()->cascadeOnDelete();
            // Сегменты рисунка из DrawingEngine.getAllSegments()
            // Формат: [{ points: [{x, y}], color, lineWidth, isErase, instrument }]
            $table->jsonb('segments')->default('[]');
            $table->string('bg_color', 20)->default('#4D4DFF');
            $table->unsignedInteger('width')->default(750);
            $table->unsignedInteger('height')->default(600);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('canvases');
    }
};