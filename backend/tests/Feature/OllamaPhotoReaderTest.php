<?php

namespace Tests\Feature;

use App\Laundry\Vision\OllamaPhotoReader;
use App\Laundry\Vision\PhotoReadException;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OllamaPhotoReaderTest extends TestCase
{
    /** Se guarda para que el archivo temporal no se borre antes de leerlo. */
    private UploadedFile $photo;

    public function test_sends_photo_and_schema_and_returns_reading(): void
    {
        $label = json_decode(file_get_contents(base_path('tests/Fixtures/labels/jersey-lana.json')), true);
        Http::fake(['localhost:11434/api/chat' => Http::response(['message' => ['content' => json_encode($label)]])]);

        $reading = $this->reader()->readLabel($this->photo());

        $this->assertSame('wool', $reading['fibers'][0]['name']);
        Http::assertSent(fn (Request $request) => $request['model'] === 'qwen3-vl:8b-instruct'
            && $request['stream'] === false
            && $request['format']['type'] === 'object'
            && count($request['messages'][0]['images']) === 1);
    }

    public function test_missing_model_explains_how_to_download_it(): void
    {
        Http::fake(['*' => Http::response(['error' => "model 'qwen3-vl:8b-instruct' not found"], 404)]);

        $this->expectException(PhotoReadException::class);
        $this->expectExceptionMessage('ollama pull qwen3-vl:8b-instruct');

        $this->reader()->readLabel($this->photo());
    }

    public function test_invalid_json_is_reported(): void
    {
        Http::fake(['*' => Http::response(['message' => ['content' => 'no es json']])]);

        $this->expectException(PhotoReadException::class);

        $this->reader()->readAppliance($this->photo());
    }

    private function reader(): OllamaPhotoReader
    {
        return new OllamaPhotoReader('http://localhost:11434', 'qwen3-vl:8b-instruct');
    }

    private function photo(): string
    {
        $this->photo = UploadedFile::fake()->image('etiqueta.jpg', 2000, 1500);

        return $this->photo->getRealPath();
    }
}
