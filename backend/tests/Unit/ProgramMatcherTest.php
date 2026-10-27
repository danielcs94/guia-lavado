<?php

namespace Tests\Unit;

use App\Laundry\LaundryAdvisor;
use App\Laundry\ProgramMatcher;
use App\Models\Appliance;
use Tests\TestCase;

class ProgramMatcherTest extends TestCase
{
    public function test_cotton_tshirt_uses_cotton_program_capped_at_label_limits(): void
    {
        [$wash, $dry] = $this->suggestionsFor('camiseta');

        $this->assertSame('Algodón', $wash['program']);
        $this->assertSame(40, $wash['temperature']);
        $this->assertSame(1200, $wash['spin']);
        $this->assertSame('Sintéticos', $dry['program']);
    }

    public function test_wool_sweater_uses_wool_program_and_no_dryer(): void
    {
        [$wash, $dry] = $this->suggestionsFor('jersey-lana');

        $this->assertSame('Lana', $wash['program']);
        $this->assertSame(30, $wash['temperature']);
        $this->assertSame(400, $wash['spin']);
        $this->assertNull($dry['program']);
        $this->assertSame('No la metas en la secadora.', $dry['message']);
    }

    public function test_dry_clean_only_gets_no_suggestions(): void
    {
        $this->assertSame([], $this->suggestionsFor('americana'));
    }

    public function test_guesses_category_from_program_name_when_reading_says_other(): void
    {
        $washer = new Appliance([
            'name' => 'Whirlpool',
            'kind' => 'washer',
            'programs' => [
                ['name' => 'Eco 40-60', 'category' => 'other', 'max_temp' => null],
                ['name' => 'Algodón', 'category' => 'other', 'max_temp' => null],
                ['name' => 'Lana', 'category' => 'other', 'max_temp' => null],
            ],
            'temperatures' => [],
            'spin_speeds' => [],
        ]);
        $label = json_decode(file_get_contents(__DIR__.'/../Fixtures/labels/jersey-lana.json'), true);
        $advice = (new LaundryAdvisor)->advise($label);

        [$wash] = (new ProgramMatcher)->match($label, $advice['settings'], [$washer]);

        $this->assertSame('Lana', $wash['program']);
        $this->assertSame('Programa «Lana» a 30° y 400 rpm como máximo.', $wash['message']);
    }

    private function suggestionsFor(string $fixture): array
    {
        $label = json_decode(file_get_contents(__DIR__."/../Fixtures/labels/{$fixture}.json"), true);
        $advice = (new LaundryAdvisor)->advise($label);

        return (new ProgramMatcher)->match($label, $advice['settings'], [$this->washerDryer()]);
    }

    private function washerDryer(): Appliance
    {
        return new Appliance([
            'name' => 'Lavadora-secadora de prueba',
            'kind' => 'washer_dryer',
            'programs' => [
                ['name' => 'Algodón', 'category' => 'cotton', 'max_temp' => 90],
                ['name' => 'Sintéticos', 'category' => 'synthetic', 'max_temp' => 60],
                ['name' => 'Lana', 'category' => 'wool', 'max_temp' => 40],
            ],
            'temperatures' => [0, 20, 30, 40, 60, 90],
            'spin_speeds' => [0, 400, 800, 1000, 1200, 1400],
        ]);
    }
}
