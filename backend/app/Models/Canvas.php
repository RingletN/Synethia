<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'segments', 'bg_color', 'width', 'height'])]
 
class Canvas extends Model
{
    protected $casts = [
        'segments' => 'array',
    ];
 
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}