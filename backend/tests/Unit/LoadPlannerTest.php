<?php

namespace Tests\Unit;

use App\Laundry\LaundryAdvisor;
use App\Laundry\LoadPlanner;
use App\Laundry\ProgramMatcher;
use App\Models\Appliance;
use Tests\TestCase;

class LoadPlannerTest extends TestCase
{
    public function test_separates_light_and_dark_clothes(): void
    {
        $plan = $this->plan([
            $this->item('blanca', 'camiseta', 'white'),
            $this->item('gris', 'camiseta', 'light'),
            $this->item('negra', 'camiseta', 'dark'),
        ]);

        $this->assertCount(2, $plan['loads']);
        $this->assertSame(['blanca', 'gris'], $plan['loads'][0]['item_ids']);
        $this->assertSame('Ropa blanca y clara', $plan['loads'][0]['title']);
        $this->assertSame(['negra'], $plan['loads'][1]['item_ids']);
    }

    public function test_load_uses_most_delicate_settings_of_its_items(): void
    {
        $synthetic = $this->label('camiseta');
        $synthetic['wash'] = ['method' => 'machine', 'max_temp' => 30, 'cycle' => 'mild'];

        $plan = $this->plan([
            $this->item('algodon', 'camiseta', 'dark'),
            ['id' => 'sintetica', 'label' => $synthetic, 'color' => 'dark'],
        ]);

        $this->assertCount(1, $plan['loads']);
        $this->assertSame(['cycle' => 'mild', 'max_temp' => 30, 'max_spin' => 800, 'bleach' => 'none'], $plan['loads'][0]['settings']);
    }

    public function test_wool_goes_to_delicate_load_with_wool_program(): void
    {
        $plan = $this->plan([
            $this->item('camiseta', 'camiseta', 'dark'),
            $this->item('jersey', 'jersey-lana', 'dark'),
        ], [$this->washer()]);

        $this->assertSame('normal', $plan['loads'][0]['kind']);
        $this->assertSame('delicate', $plan['loads'][1]['kind']);
        $this->assertSame('Lana', $plan['loads'][1]['wash'][0]['program']);
        $this->assertSame(['jersey'], array_column($plan['loads'][1]['air_dry'], 'id'));
    }

    public function test_hand_wash_when_washer_has_no_wool_program(): void
    {
        $washer = $this->washer();
        $washer->programs = [['name' => 'Algodón', 'category' => 'cotton', 'max_temp' => 90]];

        $plan = $this->plan([$this->item('jersey', 'jersey-lana', 'dark')], [$washer]);

        $this->assertSame([], $plan['loads']);
        $this->assertSame('jersey', $plan['hand_wash'][0]['id']);
    }

    public function test_dry_clean_and_unreadable_items_stay_out_of_loads(): void
    {
        $plan = $this->plan([
            $this->item('americana', 'americana', 'dark'),
            $this->item('borrosa', 'borrosa', 'dark'),
        ]);

        $this->assertSame([], $plan['loads']);
        $this->assertSame('americana', $plan['dry_clean'][0]['id']);
        $this->assertSame([
            'La etiqueta prohíbe lavar con agua y pide limpieza profesional.',
            'Tiene estructura interna (entretelas, hombreras) que se deforma en la lavadora.',
        ], $plan['dry_clean'][0]['reasons']);
        $this->assertSame(['borrosa'], $plan['needs_retake']);
        $this->assertSame('2 prendas: Ninguna lavadora, 1 a la tintorería, 1 sin leer.', $plan['summary']);
    }

    public function test_splits_load_when_it_does_not_fit(): void
    {
        $jeans = $this->label('camiseta');
        $jeans['garment']['type'] = 'jeans';
        $items = array_map(fn ($i) => ['id' => "vaquero-{$i}", 'label' => $jeans, 'color' => 'dark'], range(1, 12));

        $plan = $this->plan($items);

        $this->assertCount(2, $plan['loads']);
        $this->assertLessThanOrEqual(7, $plan['loads'][0]['weight_kg']);
        $this->assertSame(12, count($plan['loads'][0]['item_ids']) + count($plan['loads'][1]['item_ids']));
    }

    public function test_few_towels_join_normal_load_and_many_get_their_own(): void
    {
        $towel = $this->label('camiseta');
        $towel['garment']['type'] = 'towel';
        $towel['wash']['max_temp'] = 60;

        $few = $this->plan([$this->item('camiseta', 'camiseta', 'white'), ['id' => 't1', 'label' => $towel, 'color' => 'white']]);
        $this->assertCount(1, $few['loads']);
        $this->assertSame(40, $few['loads'][0]['settings']['max_temp']);

        $shirt = $this->label('camiseta');
        $shirt['garment']['type'] = 'jeans';
        $many = $this->plan([
            ...array_map(fn ($i) => ['id' => "v{$i}", 'label' => $shirt, 'color' => 'white'], range(1, 4)),
            ...array_map(fn ($i) => ['id' => "t{$i}", 'label' => $towel, 'color' => 'white'], range(1, 4)),
        ]);
        $this->assertCount(2, $many['loads']);
        $this->assertSame('towels', $many['loads'][1]['kind']);
        $this->assertSame(60, $many['loads'][1]['settings']['max_temp']);
    }

    public function test_many_towels_join_a_nearly_empty_load_instead_of_two_small_ones(): void
    {
        $towel = $this->label('camiseta');
        $towel['garment']['type'] = 'towel';
        $towel['wash']['max_temp'] = 60;

        $plan = $this->plan([
            $this->item('camiseta', 'camiseta', 'white'),
            ...array_map(fn ($i) => ['id' => "t{$i}", 'label' => $towel, 'color' => 'white'], range(1, 4)),
        ]);

        $this->assertCount(1, $plan['loads']);
        $this->assertSame('normal', $plan['loads'][0]['kind']);
    }

    public function test_small_load_gets_efficiency_tip(): void
    {
        $plan = $this->plan([$this->item('camiseta', 'camiseta', 'dark')]);

        $this->assertStringContainsString('medio vacía', $plan['loads'][0]['tips'][0]);
    }

    private function plan(array $items, array $appliances = []): array
    {
        return (new LoadPlanner(new LaundryAdvisor, new ProgramMatcher))->plan($items, $appliances);
    }

    private function item(string $id, string $fixture, string $color): array
    {
        return ['id' => $id, 'label' => $this->label($fixture), 'color' => $color];
    }

    private function label(string $fixture): array
    {
        return json_decode(file_get_contents(__DIR__."/../Fixtures/labels/{$fixture}.json"), true);
    }

    private function washer(): Appliance
    {
        return new Appliance([
            'name' => 'Lavadora',
            'kind' => 'washer',
            'programs' => [
                ['name' => 'Algodón', 'category' => 'cotton', 'max_temp' => 90],
                ['name' => 'Lana', 'category' => 'wool', 'max_temp' => 40],
            ],
            'temperatures' => [20, 30, 40, 60, 90],
            'spin_speeds' => [400, 800, 1200],
        ]);
    }
}
