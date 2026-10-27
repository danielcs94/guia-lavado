<?php

namespace App\Laundry\Vision;

final class LabelSchema
{
    public const FIBERS = [
        'cotton', 'polyester', 'wool', 'silk', 'linen', 'viscose', 'elastane', 'polyamide',
        'acrylic', 'cashmere', 'leather', 'suede', 'down', 'modal', 'lyocell', 'other',
    ];

    public const GARMENTS = [
        'tshirt', 'shirt', 'sweater', 'trousers', 'jeans', 'dress', 'skirt', 'blazer', 'suit',
        'coat', 'down_jacket', 'underwear', 'sportswear', 'bedding', 'towel', 'other',
    ];

    public const PROMPT = <<<'TXT'
        Eres un experto en etiquetas de cuidado textil (símbolos ISO 3758 / GINETEX).
        Transcribe lo que indica la etiqueta de la foto.

        Primero, en symbols, describe uno a uno los símbolos de izquierda a derecha: su forma, qué tiene dentro
        (números, puntos, letras), cuántas rayas tiene debajo y si está tachado con una X. Una X encima significa "no".
        Después rellena el resto de campos a partir de esa descripción.

        - Rellena cada campo solo con lo que veas. Si un símbolo no aparece o no se distingue, usa null: no lo deduzcas del tejido.
        - wash: barreño = method "machine"; mano dentro del barreño = "hand"; barreño tachado = "none".
          max_temp es el número dentro del barreño, o los puntos (1=30, 2=40, 3=50, 4=60, 5=70, 6=95).
          cycle: sin raya debajo = "normal", una raya = "mild", dos rayas = "very_mild".
        - bleach: triángulo vacío = "any", triángulo con dos rayas = "oxygen_only", tachado = "none".
        - tumble_dry (círculo dentro de un cuadrado): 1 punto = "low", 2 puntos = "normal", tachado = "none".
        - natural_dry (cuadrado): línea curva arriba = "line", tres líneas verticales = "drip_line",
          una línea horizontal = "flat", dos líneas horizontales = "drip_flat".
        - iron: 1 punto = "low", 2 = "medium", 3 = "high", tachada = "none".
        - professional: P o F en un círculo = dry_clean; círculo tachado = dry_clean "none"; W en un círculo = wet_clean true.
        - fibers: composición del tejido exterior; si hay relleno de plumas, añádelo como "down". Usa "other" si no está en la lista.
        - garment: solo si la foto muestra la prenda; si solo se ve la etiqueta, null.
        - notes: otras instrucciones escritas (p. ej. "lavar del revés"), traducidas al español.
        - readable = false si la foto no es una etiqueta de ropa o no se puede leer. confidence: de 0 a 1, cuánto te fías de tu lectura.
        TXT;

    public static function schema(): array
    {
        return Json::object([
            'symbols' => ['type' => 'array', 'items' => ['type' => 'string']],
            'readable' => ['type' => 'boolean'],
            'confidence' => ['type' => 'number'],
            'wash' => Json::nullable(Json::object([
                'method' => Json::nullableEnum(['machine', 'hand', 'none']),
                'max_temp' => Json::nullable(['type' => 'integer', 'enum' => [30, 40, 50, 60, 70, 95]]),
                'cycle' => Json::nullableEnum(['normal', 'mild', 'very_mild']),
            ])),
            'bleach' => Json::nullableEnum(['any', 'oxygen_only', 'none']),
            'tumble_dry' => Json::nullableEnum(['normal', 'low', 'none']),
            'natural_dry' => Json::nullableEnum(['line', 'drip_line', 'flat', 'drip_flat']),
            'iron' => Json::nullableEnum(['high', 'medium', 'low', 'none']),
            'professional' => Json::nullable(Json::object([
                'dry_clean' => Json::nullableEnum(['P', 'F', 'none']),
                'wet_clean' => Json::nullable(['type' => 'boolean']),
            ])),
            'fibers' => ['type' => 'array', 'items' => Json::object([
                'name' => ['type' => 'string', 'enum' => self::FIBERS],
                'percent' => Json::nullable(['type' => 'integer']),
            ])],
            'garment' => Json::nullable(Json::object([
                'type' => Json::nullableEnum(self::GARMENTS),
                'embellishments' => ['type' => 'boolean'],
            ])),
            'notes' => ['type' => 'array', 'items' => ['type' => 'string']],
        ]);
    }
}
