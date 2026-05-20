<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['user_id', 'title', 'description', 'is_favorite'])]

class Project extends Model
{
    use HasFactory;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function canvas(): HasOne
    {
        return $this->hasOne(Canvas::class);
    }

    public function settings(): HasOne
    {
        return $this->hasOne(ProjectSetting::class);
    }

    public function melody(): HasOne
    {
        return $this->hasOne(Melody::class);
    }
}