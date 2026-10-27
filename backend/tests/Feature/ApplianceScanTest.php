<?php

namespace Tests\Feature;

use App\Laundry\Vision\PhotoReader;
use App\Models\Appliance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Support\FakePhotoReader;
use Tests\TestCase;

class ApplianceScanTest extends TestCase
{
    use RefreshDatabase;

    private const READING = [
        'readable' => true,
        'confidence' => 0.9,
        'kind' => 'washer',
        'brand' => 'Balay',
        'model' => null,
        'programs' => [['name' => 'Algodón', 'category' => 'cotton', 'max_temp' => 90]],
        'temperatures' => [20, 40, 60, 90],
        'spin_speeds' => [800, 1200],
    ];

    public function test_scan_saves_the_appliance(): void
    {
        $this->app->instance(PhotoReader::class, new FakePhotoReader(appliance: self::READING));

        $this->postJson('/api/appliances/scan', ['photo' => UploadedFile::fake()->image('panel.jpg')])
            ->assertCreated()
            ->assertJsonPath('name', 'Lavadora Balay')
            ->assertJsonPath('programs.0.category', 'cotton');

        $this->getJson('/api/appliances')->assertJsonCount(1);
    }

    public function test_unreadable_panel_is_not_saved(): void
    {
        $this->app->instance(PhotoReader::class, new FakePhotoReader(appliance: ['readable' => false] + self::READING));

        $this->postJson('/api/appliances/scan', ['photo' => UploadedFile::fake()->image('panel.jpg')])
            ->assertUnprocessable();

        $this->assertSame(0, Appliance::count());
    }

    public function test_appliance_can_be_deleted(): void
    {
        $appliance = Appliance::create(['name' => 'Secadora', 'kind' => 'dryer'] + self::READING);

        $this->deleteJson("/api/appliances/{$appliance->id}")->assertNoContent();

        $this->assertSame(0, Appliance::count());
    }

    public function test_appliance_can_be_created_by_hand(): void
    {
        $this->postJson('/api/appliances', ['name' => 'Lavadora'] + self::READING)
            ->assertCreated()
            ->assertJsonPath('programs.0.name', 'Algodón');
    }

    public function test_appliance_can_be_corrected(): void
    {
        $appliance = Appliance::create(['name' => 'Lavadora'] + self::READING);
        $programs = [['name' => 'Lana', 'category' => 'wool', 'max_temp' => 40]];

        $this->putJson("/api/appliances/{$appliance->id}", ['name' => 'Lavadora', 'programs' => $programs] + self::READING)
            ->assertOk()
            ->assertJsonPath('programs.0.category', 'wool');
    }

    public function test_manual_appliance_needs_programs(): void
    {
        $this->postJson('/api/appliances', ['name' => 'Lavadora', 'programs' => []] + self::READING)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('programs');
    }
}
