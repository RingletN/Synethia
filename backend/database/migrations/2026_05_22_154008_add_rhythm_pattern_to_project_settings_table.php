<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            $table->string('rhythm_pattern', 20)->default('disco')->after('scale');
        });
    }

    public function down(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            $table->dropColumn('rhythm_pattern');
        });
    }
};