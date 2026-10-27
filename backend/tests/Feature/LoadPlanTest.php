<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoadPlanTest extends TestCase
{
    use RefreshDatabase;

    public function test_plans_loads_and_applies_garment_override(): void
    {
        $label = json_decode(file_get_contents(__DIR__.'/../Fixtures/labels/camiseta.json'), true);

        $this->postJson('/api/loads/plan', ['items' => [
            ['id' => 'a', 'label' => $label, 'color' => 'white'],
            ['id' => 'b', 'label' => $label, 'color' => 'dark', 'garment_type' => 'blazer'],
        ]])
            ->assertOk()
            ->assertJsonPath('loads.0.item_ids', ['a'])
            ->assertJsonPath('dry_clean.0.id', 'b')
            ->assertJsonPath('advice.b.verdict', 'DryCleanRecommended');
    }

    public function test_color_is_required(): void
    {
        $this->postJson('/api/loads/plan', ['items' => [['id' => 'a', 'label' => ['readable' => true]]]])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Indica el color de todas las prendas.');
    }
}
