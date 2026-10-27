<?php

namespace Tests\Unit;

use App\Laundry\LaundryAdvisor;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class LaundryAdvisorTest extends TestCase
{
    public static function fixtures(): array
    {
        return [
            'camiseta de algodón' => ['camiseta', 'Home'],
            'jersey de lana' => ['jersey-lana', 'HomeCareful'],
            'americana' => ['americana', 'DryCleanRequired'],
        ];
    }

    #[DataProvider('fixtures')]
    public function test_verdict_for_sample_labels(string $fixture, string $verdict): void
    {
        $advice = (new LaundryAdvisor)->advise($this->fixture($fixture));

        $this->assertSame($verdict, $advice['verdict']);
    }

    public function test_unreadable_label_asks_for_a_new_photo(): void
    {
        $advice = (new LaundryAdvisor)->advise($this->fixture('borrosa'));

        $this->assertTrue($advice['needs_retake']);
    }

    public function test_dry_clean_required_has_no_wash_settings(): void
    {
        $advice = (new LaundryAdvisor)->advise($this->fixture('americana'));

        $this->assertNull($advice['settings']);
    }

    public function test_leather_trim_requires_specialist(): void
    {
        $label = $this->fixture('camiseta');
        $label['fibers'][] = ['name' => 'leather', 'percent' => 5];

        $this->assertSame('DryCleanRequired', (new LaundryAdvisor)->advise($label)['verdict']);
    }

    public function test_small_wool_blend_is_not_delicate(): void
    {
        $label = $this->fixture('camiseta');
        $label['fibers'] = [['name' => 'cotton', 'percent' => 90], ['name' => 'wool', 'percent' => 10]];

        $this->assertSame('Home', (new LaundryAdvisor)->advise($label)['verdict']);
    }

    public function test_silk_without_wash_instructions_goes_to_dry_cleaner(): void
    {
        $label = $this->fixture('camiseta');
        $label['wash'] = ['method' => null, 'max_temp' => null, 'cycle' => null];
        $label['fibers'] = [['name' => 'silk', 'percent' => 100]];

        $this->assertSame('DryCleanRecommended', (new LaundryAdvisor)->advise($label)['verdict']);
    }

    public function test_missing_symbols_use_safest_settings(): void
    {
        $label = $this->fixture('camiseta');
        $label['wash']['max_temp'] = null;
        $label['tumble_dry'] = null;

        $advice = (new LaundryAdvisor)->advise($label);

        $this->assertSame(30, $advice['settings']['max_temp']);
        $this->assertSame('none', $advice['settings']['tumble_dry']);
        $this->assertStringContainsString('temperatura, secadora', $advice['tips'][0]);
    }

    private function fixture(string $name): array
    {
        return json_decode(file_get_contents(__DIR__."/../Fixtures/labels/{$name}.json"), true);
    }
}
