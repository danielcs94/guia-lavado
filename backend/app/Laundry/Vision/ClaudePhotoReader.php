<?php

namespace App\Laundry\Vision;

use Anthropic\Beta\Messages\BetaBase64ImageSource;
use Anthropic\Beta\Messages\BetaImageBlockParam;
use Anthropic\Beta\Messages\BetaJSONOutputFormat;
use Anthropic\Beta\Messages\BetaOutputConfig;
use Anthropic\Beta\Messages\BetaTextBlockParam;
use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\RateLimitException;
use JsonException;

final class ClaudePhotoReader implements PhotoReader
{
    /** Lado largo máximo: más resolución no mejora la lectura y encarece la petición. */
    private const MAX_SIDE = 1568;

    public function __construct(
        private readonly ?Client $client,
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
        if ($this->client === null) {
            throw new PhotoReadException('Falta ANTHROPIC_API_KEY en el .env del backend.');
        }

        try {
            $message = $this->client->beta->messages->create(
                maxTokens: 16000,
                messages: [[
                    'role' => 'user',
                    'content' => [
                        BetaImageBlockParam::with(
                            source: BetaBase64ImageSource::with(data: JpegImage::base64($path, self::MAX_SIDE), mediaType: 'image/jpeg'),
                        ),
                        BetaTextBlockParam::with(text: $prompt),
                    ],
                ]],
                model: $this->model,
                outputConfig: BetaOutputConfig::with(
                    effort: 'medium',
                    format: BetaJSONOutputFormat::with(schema: $schema),
                ),
                fallbacks: 'default',
                betas: ['server-side-fallback-2026-07-01'],
            );
        } catch (AuthenticationException) {
            throw new PhotoReadException('La API key de Anthropic no es válida.');
        } catch (RateLimitException) {
            throw new PhotoReadException('Demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo.');
        } catch (APIConnectionException) {
            throw new PhotoReadException('No se pudo conectar con la IA. Revisa la conexión a internet.');
        } catch (APIException $e) {
            throw new PhotoReadException('La IA devolvió un error: '.$e->getMessage(), previous: $e);
        }

        if ($message->stopReason === 'refusal') {
            throw new PhotoReadException('La IA no ha querido procesar esta foto. Prueba con otra.');
        }
        if ($message->stopReason === 'max_tokens') {
            throw new PhotoReadException('La respuesta de la IA se ha cortado. Vuelve a intentarlo.');
        }

        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                try {
                    return json_decode($block->text, true, flags: JSON_THROW_ON_ERROR);
                } catch (JsonException $e) {
                    throw new PhotoReadException('La IA devolvió una lectura que no es JSON válido.', previous: $e);
                }
            }
        }

        throw new PhotoReadException('La IA no devolvió ninguna lectura.');
    }
}
