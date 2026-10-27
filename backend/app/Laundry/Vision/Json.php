<?php

namespace App\Laundry\Vision;

/**
 * Atajos para escribir JSON Schemas compatibles con structured outputs:
 * todos los campos obligatorios y sin propiedades extra.
 */
final class Json
{
    public static function object(array $properties): array
    {
        return [
            'type' => 'object',
            'properties' => $properties,
            'required' => array_keys($properties),
            'additionalProperties' => false,
        ];
    }

    public static function nullable(array $schema): array
    {
        return ['anyOf' => [$schema, ['type' => 'null']]];
    }

    public static function nullableEnum(array $values): array
    {
        return self::nullable(['type' => 'string', 'enum' => $values]);
    }
}
