<?php

namespace App\Laundry;

use Illuminate\Support\Str;

/**
 * Deduce la categoría de un programa por su nombre, para cuando la IA
 * lee bien el panel pero no sabe clasificar los programas.
 */
final class ProgramCategory
{
    /** Por orden: el primero que coincide gana («Eco 40-60» es eco, no algodón). */
    private const KEYWORDS = [
        'rinse_spin' => ['aclar', 'rinse'],
        'drain' => ['desag', 'centrif', 'drain', 'spin'],
        'eco' => ['eco'],
        'quick' => ['rapid', 'quick', 'express', 'mini'],
        'down' => ['plum', 'down'],
        'bedding' => ['edred', 'cama', 'sabana', 'duvet', 'bedding'],
        'silk' => ['seda', 'silk'],
        'wool' => ['lana', 'wool'],
        'hand_wash' => ['mano', 'hand'],
        'delicate' => ['delicad', 'delicate', 'fino'],
        'synthetic' => ['sintet', 'synthetic'],
        'mixed' => ['variad', 'mixt', 'mix'],
        'sportswear' => ['deport', 'sport'],
        'jeans' => ['vaquer', 'jean', 'denim'],
        'shirts' => ['camisa', 'shirt'],
        'steam' => ['vapor', 'steam'],
        'cotton' => ['algod', 'cotton'],
    ];

    public static function guess(string $name): string
    {
        $name = Str::lower(Str::ascii($name));

        foreach (self::KEYWORDS as $category => $keywords) {
            if (Str::contains($name, $keywords)) {
                return $category;
            }
        }

        return 'other';
    }

    public static function of(array $program): string
    {
        return $program['category'] === 'other' ? self::guess($program['name']) : $program['category'];
    }
}
