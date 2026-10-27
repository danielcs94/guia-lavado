<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Appliance extends Model
{
    protected $fillable = ['name', 'kind', 'brand', 'model', 'programs', 'temperatures', 'spin_speeds'];

    protected function casts(): array
    {
        return [
            'programs' => 'array',
            'temperatures' => 'array',
            'spin_speeds' => 'array',
        ];
    }
}
