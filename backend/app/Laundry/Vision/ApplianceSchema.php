<?php

namespace App\Laundry\Vision;

final class ApplianceSchema
{
    public const KINDS = ['washer', 'dryer', 'washer_dryer'];

    public const CATEGORIES = [
        'cotton', 'synthetic', 'mixed', 'delicate', 'wool', 'hand_wash', 'silk', 'quick', 'eco',
        'bedding', 'down', 'sportswear', 'jeans', 'shirts', 'rinse_spin', 'drain', 'steam', 'other',
    ];

    public const PROMPT = <<<'TXT'
        Lee el panel de mandos de la lavadora, secadora o lavadora-secadora de la foto.

        - kind: "washer", "dryer" o "washer_dryer".
        - brand y model: solo si aparecen en la foto; si no, null.
        - programs: todos los programas del selector. name es el texto tal como aparece; si es solo un icono,
          ponle un nombre corto en español. category es el tipo de programa (usa "other" si no encaja).
          max_temp: la temperatura máxima del programa solo si el panel la indica; si no, null.
        - temperatures: temperaturas seleccionables en °C (0 si hay opción de agua fría). Lista vacía si no se ven.
        - spin_speeds: velocidades de centrifugado seleccionables en rpm. Lista vacía si no se ven.
        - readable = false si la foto no es un panel de electrodoméstico o no se puede leer. confidence: de 0 a 1.
        TXT;

    public static function schema(): array
    {
        return Json::object([
            'readable' => ['type' => 'boolean'],
            'confidence' => ['type' => 'number'],
            'kind' => ['type' => 'string', 'enum' => self::KINDS],
            'brand' => Json::nullable(['type' => 'string']),
            'model' => Json::nullable(['type' => 'string']),
            'programs' => ['type' => 'array', 'items' => Json::object([
                'name' => ['type' => 'string'],
                'category' => ['type' => 'string', 'enum' => self::CATEGORIES],
                'max_temp' => Json::nullable(['type' => 'integer']),
            ])],
            'temperatures' => ['type' => 'array', 'items' => ['type' => 'integer']],
            'spin_speeds' => ['type' => 'array', 'items' => ['type' => 'integer']],
        ]);
    }
}
