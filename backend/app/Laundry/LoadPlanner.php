<?php

namespace App\Laundry;

use App\Models\Appliance;

/**
 * Reparte un montón de ropa en el menor número de lavadoras posible
 * sin juntar lo que no se debe juntar (colores, tejidos delicados, toallas).
 */
final class LoadPlanner
{
    public const COLORS = ['white', 'light', 'dark', 'color'];

    /** Lo que pesa en seco cada prenda, aproximadamente (kg). */
    private const WEIGHTS = [
        'tshirt' => 0.2, 'shirt' => 0.25, 'sweater' => 0.5, 'trousers' => 0.5, 'jeans' => 0.7,
        'dress' => 0.35, 'skirt' => 0.3, 'blazer' => 0.8, 'suit' => 1.2, 'coat' => 1.5,
        'down_jacket' => 0.9, 'underwear' => 0.08, 'sportswear' => 0.25, 'bedding' => 1.0,
        'towel' => 0.6, 'other' => 0.4,
    ];

    /** Carga máxima por tipo de colada (kg), pensando en una lavadora normal de 7 kg. */
    private const CAPACITY = ['normal' => 7.0, 'towels' => 7.0, 'delicate' => 2.5, 'down' => 2.0];

    /** Por debajo de esta parte de la capacidad la colada se considera pequeña. */
    private const SMALL_FILL = 0.35;

    /** Kilos de toallas y sábanas a partir de los que merece la pena lavarlas aparte. */
    private const MIN_TOWEL_LOAD = 2.0;

    /** Temperatura que basta para la ropa del día a día. */
    private const EVERYDAY_TEMP = 40;

    private const CARE_ORDER = ['down', 'silk', 'wool', 'hand', 'very_mild', 'mild', 'towels', 'normal'];
    private const CYCLE_ORDER = ['hand', 'very_mild', 'mild', 'normal'];
    private const BLEACH_ORDER = ['none', 'oxygen_only', 'any'];

    public function __construct(
        private readonly LaundryAdvisor $advisor,
        private readonly ProgramMatcher $matcher,
    ) {}

    /**
     * @param  array<array{id: string, label: array, color: string}>  $items
     * @param  iterable<Appliance>  $appliances
     */
    public function plan(array $items, iterable $appliances): array
    {
        $appliances = collect($appliances);
        $handInMachine = $appliances->isEmpty()
            || $this->matcher->anyWasherHas($appliances, ['hand_wash', 'wool', 'silk']);

        $advice = [];
        $retake = [];
        $dryClean = [];
        $handWash = [];
        $groups = [];

        foreach ($items as $item) {
            $result = $this->advisor->advise($item['label']);
            $advice[$item['id']] = $result;

            if ($result['needs_retake']) {
                $retake[] = $item['id'];
                continue;
            }

            $settings = $result['settings'];
            if ($settings === null || $result['verdict'] === Verdict::DryCleanRecommended->name) {
                $dryClean[] = ['id' => $item['id'], 'required' => $settings === null, 'reasons' => $result['dry_clean_reasons']];
                continue;
            }

            $care = $this->matcher->careOf($item['label'], $settings);
            if ($settings['cycle'] === 'hand' && ! $handInMachine) {
                $handWash[] = ['id' => $item['id'], 'max_temp' => $settings['max_temp']];
                continue;
            }

            $kind = match ($care) {
                'down' => 'down',
                'silk', 'wool', 'hand', 'very_mild' => 'delicate',
                'towels' => 'towels',
                default => 'normal',
            };
            $tone = in_array($item['color'], ['white', 'light'], true) ? 'light' : 'dark';

            $groups["{$kind}-{$tone}"][] = [
                'id' => $item['id'],
                'color' => $item['color'],
                'care' => $care,
                'settings' => $settings,
                'weight' => self::WEIGHTS[$item['label']['garment']['type'] ?? 'other'] ?? self::WEIGHTS['other'],
            ];
        }

        $groups = $this->mergeSmallTowelGroups($groups);

        $loads = [];
        foreach ($this->sortGroups($groups) as $key => $group) {
            [$kind, $tone] = explode('-', $key);
            foreach ($this->split($group, self::CAPACITY[$kind]) as $part) {
                $loads[] = $this->load($kind, $tone, $part, $appliances);
            }
        }

        return [
            'loads' => $loads,
            'hand_wash' => $handWash,
            'dry_clean' => $dryClean,
            'needs_retake' => $retake,
            'advice' => $advice,
            'summary' => $this->summary(count($items), count($loads), count($handWash), count($dryClean), count($retake)),
        ];
    }

    /**
     * Toallas aparte solo si compensa: si hay pocas, o si el resto de la ropa de ese
     * color no llena ni media lavadora, va todo junto.
     */
    private function mergeSmallTowelGroups(array $groups): array
    {
        foreach (['light', 'dark'] as $tone) {
            $towels = $groups["towels-{$tone}"] ?? [];
            $others = $groups["normal-{$tone}"] ?? [];
            $othersFill = array_sum(array_column($others, 'weight')) / self::CAPACITY['normal'];
            $fewTowels = array_sum(array_column($towels, 'weight')) < self::MIN_TOWEL_LOAD;

            if ($towels && ($fewTowels || ($others && $othersFill < self::SMALL_FILL))) {
                $groups["normal-{$tone}"] = [...($groups["normal-{$tone}"] ?? []), ...$towels];
                unset($groups["towels-{$tone}"]);
            }
        }

        return $groups;
    }

    private function sortGroups(array $groups): array
    {
        $order = ['normal-light', 'normal-dark', 'towels-light', 'towels-dark', 'delicate-light', 'delicate-dark', 'down-light', 'down-dark'];

        return array_filter(array_replace(array_fill_keys($order, null), $groups));
    }

    /**
     * Reparte las prendas en lavadoras que no pasen de la capacidad (primero las más pesadas).
     */
    private function split(array $group, float $capacity): array
    {
        usort($group, fn ($a, $b) => $b['weight'] <=> $a['weight']);

        $parts = [];
        foreach ($group as $item) {
            foreach ($parts as &$part) {
                if (array_sum(array_column($part, 'weight')) + $item['weight'] <= $capacity) {
                    $part[] = $item;
                    continue 2;
                }
            }
            unset($part);
            $parts[] = [$item];
        }

        return $parts;
    }

    private function load(string $kind, string $tone, array $items, $appliances): array
    {
        $care = $this->strictest(array_column($items, 'care'), self::CARE_ORDER);
        $all = array_column($items, 'settings');
        $maxTemp = min(array_column($all, 'max_temp'));
        $temperature = $kind === 'towels' ? min($maxTemp, 60) : min($maxTemp, self::EVERYDAY_TEMP);

        $settings = [
            'cycle' => $this->strictest(array_column($all, 'cycle'), self::CYCLE_ORDER),
            'max_temp' => $temperature,
            'max_spin' => min(array_column($all, 'max_spin')),
            'bleach' => $this->strictest(array_column($all, 'bleach'), self::BLEACH_ORDER),
        ];

        $weight = array_sum(array_column($items, 'weight'));
        $capacity = self::CAPACITY[$kind];

        $dryer = array_values(array_filter($items, fn ($item) => $item['settings']['tumble_dry'] !== 'none'));
        $airDry = array_values(array_filter($items, fn ($item) => $item['settings']['tumble_dry'] === 'none'));
        $tumbleDry = $dryer
            ? (in_array('low', array_column(array_column($dryer, 'settings'), 'tumble_dry'), true) ? 'low' : 'normal')
            : 'none';

        return [
            'title' => $this->title($kind, $tone),
            'kind' => $kind,
            'tone' => $tone,
            'item_ids' => array_column($items, 'id'),
            'weight_kg' => round($weight, 1),
            'capacity_kg' => $capacity,
            'fill' => round(min($weight / $capacity, 1), 2),
            'settings' => $settings,
            'wash' => $this->matcher->matchWash($care, $settings, $appliances),
            'dryer_ids' => array_column($dryer, 'id'),
            'air_dry' => array_map(fn ($item) => ['id' => $item['id'], 'natural_dry' => $item['settings']['natural_dry']], $airDry),
            'dry' => $dryer ? $this->matcher->matchDry($tumbleDry, $appliances) : [],
            'tumble_dry' => $tumbleDry,
            'tips' => $this->tips($kind, $tone, $items, $settings, $maxTemp, $weight / $capacity),
        ];
    }

    private function tips(string $kind, string $tone, array $items, array $settings, int $labelMaxTemp, float $fill): array
    {
        $tips = [];
        $colors = array_unique(array_column($items, 'color'));

        if ($fill < self::SMALL_FILL) {
            $tips[] = $kind === 'delicate' && count($items) <= 2
                ? 'Son muy pocas prendas: a mano gastas menos agua y luz que poniendo la lavadora.'
                : 'Va medio vacía: si no corre prisa, espera a juntar más ropa de este tipo, o usa un programa rápido o de media carga.';
        }

        if ($kind === 'normal' && $labelMaxTemp > self::EVERYDAY_TEMP) {
            $tips[] = 'A 40° basta para la ropa del día a día y gastas mucha menos luz que a 60°.';
        }

        if ($kind === 'normal' && in_array('towels', array_column($items, 'care'), true)) {
            $tips[] = 'Las toallas sueltan pelusa: si te importa, lávalas aparte cuando tengas más.';
        }

        if ($tone === 'light' && $colors === ['white'] && $settings['bleach'] !== 'none') {
            $tips[] = $settings['bleach'] === 'any'
                ? 'Si quieres blanquear, todas admiten lejía.'
                : 'Si quieres blanquear, usa blanqueante con oxígeno activo (sin cloro).';
        }

        if ($tone === 'light' && count($colors) > 1) {
            $tips[] = 'Juntas blancos con claros: añade una toallita atrapacolor por si acaso.';
        }

        if ($tone === 'dark') {
            $tips[] = 'Dale la vuelta a la ropa oscura para que los colores aguanten más.';
        }

        if ($kind === 'delicate') {
            $tips[] = 'Usa detergente para delicados o lana, y una bolsa de red si tienes.';
        }

        if ($kind === 'down') {
            $tips[] = 'Pon un aclarado extra para que no queden restos de jabón en el plumón.';
        }

        return $tips;
    }

    private function strictest(array $values, array $order): string
    {
        foreach ($order as $value) {
            if (in_array($value, $values, true)) {
                return $value;
            }
        }

        return end($order);
    }

    private function title(string $kind, string $tone): string
    {
        return match ($kind) {
            'normal' => $tone === 'light' ? 'Ropa blanca y clara' : 'Ropa oscura y de color',
            'towels' => $tone === 'light' ? 'Toallas y sábanas claras' : 'Toallas y sábanas oscuras',
            'delicate' => $tone === 'light' ? 'Delicada clara' : 'Delicada oscura',
            'down' => $tone === 'light' ? 'Plumíferos claros' : 'Plumíferos oscuros',
        };
    }

    private function summary(int $items, int $loads, int $hand, int $dryClean, int $retake): string
    {
        $parts = [match ($loads) {
            0 => 'Ninguna lavadora',
            1 => '1 lavadora',
            default => "{$loads} lavadoras",
        }];
        if ($hand) {
            $parts[] = $hand === 1 ? '1 prenda a mano' : "{$hand} prendas a mano";
        }
        if ($dryClean) {
            $parts[] = $dryClean === 1 ? '1 a la tintorería' : "{$dryClean} a la tintorería";
        }
        if ($retake) {
            $parts[] = $retake === 1 ? '1 sin leer' : "{$retake} sin leer";
        }

        $prendas = $items === 1 ? '1 prenda' : "{$items} prendas";

        return "{$prendas}: ".implode(', ', $parts).'.';
    }
}
