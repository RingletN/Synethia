<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100)->default('Без названия');
            $table->text('description')->nullable();
            $table->timestamps(); // created_at = дата создания, updated_at = дата изменения
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};