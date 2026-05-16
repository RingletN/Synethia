<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'events', 'total_duration', 'generated_at'])]
 
class Melody extends Model
{
    protected $casts = [
        'events'       => 'array',
        'generated_at' => 'datetime',
    ];
 
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}