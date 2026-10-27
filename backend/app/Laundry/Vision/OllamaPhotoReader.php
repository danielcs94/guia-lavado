<?php

namespace App\Laundry\Vision;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use JsonException;

/**
 * Lee las fotos con un modelo de visión que se ejecuta en el propio Mac (gratis).
 */
final class OllamaPhotoReader implements PhotoReader
{
    /** Un modelo local tarda más cuantos más píxeles; con esto se leen bien las etiquetas. */
    private const MAX_SIDE = 1280;

    private const TIMEOUT_SECONDS = 300;

    public function __construct(
        private readonly string $url,
        private readonly string $model,
    ) {}

    public function readLabel(string $path): array
    {
        return $this->read($path, LabelSchema::PROMPT, LabelSchema::schema());
    }

    public function readAppliance(string $path): array
    {
        return $this->read($path, ApplianceSchema::PROMPT, ApplianceSchema::schema());
    }

    private function read(string $path, string $prompt, array $schema): array
    {
        set_time_limit(self::TIMEOUT_SECONDS);

        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)->post("{$this->url}/api/chat", [
                'model' => $this->model,
                'stream' => false,
                'format' => $schema,
                'options' => ['temperature' => 0, 'num_predict' => 2048],
                'messages' => [[
                    'role' => 'user',
                    'content' => $prompt,
                    'images' => [JpegImage::base64($path, self::MAX_SIDE)],
                ]],
            ]);
        } catch (ConnectionException) {
            throw new PhotoReadException('No se pudo conectar con Ollama. ¿Está arrancado (ollama serve)?');
        }

        if ($response->notFound()) {
            throw new PhotoReadException("Falta el modelo {$this->model} en Ollama. Descárgalo con: ollama pull {$this->model}");
        }
        if ($response->failed()) {
            throw new PhotoReadException('Ollama devolvió un error: '.($response->json('error') ?? $response->status()));
        }

        try {
            return json_decode((string) $response->json('message.content'), true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new PhotoReadException('La IA devolvió una lectura que no es JSON válido.', previous: $e);
        }
    }
}
