<?php
 
namespace App\Models;
 
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'bpm', 'duration', 'scale', 'reverb', 'delay', 'distortion'])]
 
class ProjectSetting extends Model
{
    protected $table = 'project_settings';
 
    protected $casts = [
        'reverb'      => 'float',
        'delay'       => 'float',
        'distortion'  => 'float',
    ];
 
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}