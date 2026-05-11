<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'nickname', 'email', 'password', 
    'profile_photo', 'registration_date'])]
#[Hidden(['password', 'remember_token'])]

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'registration_date' => 'date',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'registration_date' => 'date',
        ];
    }

    public static function rules($id = null): array
    {
        return [
            'name'     => 'required|string|min:2|max:60|regex:/^[а-яА-Яa-zA-Z\s]+$/u',
            'nickname' => [
                'required', 'string', 'min:2', 'max:30',
                'regex:/^[a-zA-Z0-9_-]+$/',
                $id ? Rule::unique('users', 'nickname')->ignore($id) 
                    : Rule::unique('users', 'nickname'),
            ],
            'email' => [
                'required', 'email', 'max:255',
                $id ? Rule::unique('users', 'email')->ignore($id)
                    : Rule::unique('users', 'email'),
            ],
            'password' => ['sometimes', 'string', 'min:8', 'regex:/^[a-zA-Z0-9!@#$%^&*()\-_=+\[\]{};:,.<>?]+$/'],
        ];
    }

    public static function updateRules($id): array
    {
        return [
            'name'     => 'sometimes|string|min:2|max:60|regex:/^[а-яА-Яa-zA-Z\s]+$/u',
            'nickname' => [
                'sometimes', 'string', 'min:2', 'max:30',
                'regex:/^[a-zA-Z0-9_-]+$/',
                Rule::unique('users', 'nickname')->ignore($id),
            ],
            'email' => [
                'sometimes', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($id),
            ],
            'password' => ['sometimes', 'string', 'min:8', 'regex:/^[a-zA-Z0-9!@#$%^&*()\-_=+\[\]{};:,.<>?]+$/'],
        ];
    }
}
