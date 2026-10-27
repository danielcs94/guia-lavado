<?php

namespace Tests\Feature;

use App\Laundry\Vision\PhotoReader;
use App\Laundry\Vision\PhotoReadException;
use App\Models\Appliance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Support\FakePhotoReader;
use Tests\TestCase;

class LabelScanTest extends TestCase
{
    use RefreshDatabase;

    public function test_scan_returns_label_advice_and_program_for_saved_washer(): void
    {
        $this->fakeLabel('jersey-lana');
        Appliance::create([
            'name' => 'Lavadora', 'kind' => 'washer',
            'programs' => [['name' => 'Lana', 'category' => 'wool', 'max_temp' => 40]],
            'temperatures' => [20, 30, 40], 'spin_speeds' => [400, 800],
        ]);

        $this->postJson('/api/labels/scan', ['photo' => UploadedFile::fake()->image('etiqueta.jpg')])
            ->assertOk()
            ->assertJsonPath('advice.verdict', 'HomeCareful')
            ->assertJsonPath('advice.appliances.0.program', 'Lana')
            ->assertJsonPath('label.fibers.0.name', 'wool');
    }

    public function test_garment_type_from_user_overrides_reading(): void
    {
        $this->fakeLabel('camiseta');

        $this->postJson('/api/labels/scan', [
            'photo' => UploadedFile::fake()->image('etiqueta.jpg'),
            'garment_type' => 'blazer',
        ])->assertJsonPath('advice.verdict', 'DryCleanRecommended');
    }

    public function test_photo_is_required(): void
    {
        $this->postJson('/api/labels/scan')->assertUnprocessable()->assertJsonValidationErrors('photo');
    }

    public function test_reader_errors_are_returned_as_json(): void
    {
        $this->app->instance(PhotoReader::class, new class implements PhotoReader
        {
            public function readLabel(string $path): array
            {
                throw new PhotoReadException('Falta ANTHROPIC_API_KEY en el .env del backend.');
            }

            public function readAppliance(string $path): array
            {
                return [];
            }
        });

        $this->postJson('/api/labels/scan', ['photo' => UploadedFile::fake()->image('etiqueta.jpg')])
            ->assertStatus(502)
            ->assertJsonPath('message', 'Falta ANTHROPIC_API_KEY en el .env del backend.');
    }

    public function test_advice_endpoint_recalculates_without_photo(): void
    {
        $label = json_decode(file_get_contents(base_path('tests/Fixtures/labels/camiseta.json')), true);

        $this->postJson('/api/labels/advice', ['label' => $label])
            ->assertOk()
            ->assertJsonPath('advice.verdict', 'Home');
    }

    private function fakeLabel(string $fixture): void
    {
        $label = json_decode(file_get_contents(base_path("tests/Fixtures/labels/{$fixture}.json")), true);
        $this->app->instance(PhotoReader::class, new FakePhotoReader(label: $label));
    }
}
