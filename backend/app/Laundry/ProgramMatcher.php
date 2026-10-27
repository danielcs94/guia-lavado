<?php

namespace App\Laundry;

use App\Models\Appliance;

/**
 * Traduce los ajustes genéricos del motor a un programa concreto de cada
 * electrodoméstico guardado.
 */
final class ProgramMatcher
{
    /**
     * Tipos de cuidado de más a menos delicado, con sus categorías de programa por orden de preferencia.
     */
    public const CARE_CATEGORIES = [
        'down' => ['down', 'delicate', 'synthetic'],
        'silk' => ['silk', 'hand_wash', 'delicate', 'wool'],
        'wool' => ['wool', 'hand_wash', 'delicate'],
        'hand' => ['hand_wash', 'wool', 'silk', 'delicate'],
        'very_mild' => ['delicate', 'wool', 'hand_wash'],
        'mild' => ['synthetic', 'delicate', 'mixed'],
        'towels' => ['cotton', 'bedding', 'mixed'],
        'normal' => ['cotton', 'mixed', 'eco'],
    ];

    /**
     * @param  iterable<Appliance>  $appliances
     */
    public function match(array $label, ?array $settings, iterable $appliances): array
    {
        if ($settings === null) {
            return [];
        }

        $suggestions = [];

        foreach ($appliances as $appliance) {
            if ($this->washes($appliance)) {
                $suggestions[] = $this->washSuggestion($this->careOf($label, $settings), $settings, $appliance);
            }
            if ($this->dries($appliance)) {
                $suggestions[] = $this->drySuggestion($settings['tumble_dry'], $appliance);
            }
        }

        return $suggestions;
    }

    /**
     * Sugerencias de lavado de una colada con varias prendas.
     *
     * @param  iterable<Appliance>  $appliances
     */
    public function matchWash(string $care, array $settings, iterable $appliances): array
    {
        $suggestions = [];
        foreach ($appliances as $appliance) {
            if ($this->washes($appliance)) {
                $suggestions[] = $this->washSuggestion($care, $settings, $appliance);
            }
        }

        return $suggestions;
    }

    /**
     * @param  iterable<Appliance>  $appliances
     */
    public function matchDry(string $tumbleDry, iterable $appliances): array
    {
        $suggestions = [];
        foreach ($appliances as $appliance) {
            if ($this->dries($appliance)) {
                $suggestions[] = $this->drySuggestion($tumbleDry, $appliance);
            }
        }

        return $suggestions;
    }

    /**
     * ¿Alguna lavadora tiene un programa de estas categorías?
     *
     * @param  iterable<Appliance>  $appliances
     */
    public function anyWasherHas(iterable $appliances, array $categories): bool
    {
        foreach ($appliances as $appliance) {
            if ($this->washes($appliance) && $this->findProgram($appliance, $categories)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Tipo de cuidado de una prenda (clave de CARE_CATEGORIES).
     */
    public function careOf(array $label, array $settings): string
    {
        $fibers = array_column($label['fibers'] ?? [], 'percent', 'name');
        $isMostly = fn (string $fiber) => array_key_exists($fiber, $fibers) && ($fibers[$fiber] ?? 100) >= 30;
        $garment = $label['garment']['type'] ?? null;

        return match (true) {
            $garment === 'down_jacket' => 'down',
            $isMostly('silk') => 'silk',
            $isMostly('wool'), $isMostly('cashmere') => 'wool',
            $settings['cycle'] === 'hand' => 'hand',
            $settings['cycle'] === 'very_mild' => 'very_mild',
            $settings['cycle'] === 'mild' => 'mild',
            in_array($garment, ['towel', 'bedding'], true) => 'towels',
            default => 'normal',
        };
    }

    private function washes(Appliance $appliance): bool
    {
        return in_array($appliance->kind, ['washer', 'washer_dryer'], true);
    }

    private function dries(Appliance $appliance): bool
    {
        return in_array($appliance->kind, ['dryer', 'washer_dryer'], true);
    }

    private function washSuggestion(string $care, array $settings, Appliance $appliance): array
    {
        $program = $this->findProgram($appliance, self::CARE_CATEGORIES[$care]);
        $maxTemp = min($settings['max_temp'], $program['max_temp'] ?? PHP_INT_MAX);
        $temperature = $this->highestUpTo($appliance->temperatures, $maxTemp);
        $spin = $this->highestUpTo($appliance->spin_speeds, $settings['max_spin']);

        return [
            'appliance_id' => $appliance->id,
            'appliance_name' => $appliance->name,
            'step' => 'wash',
            'program' => $program['name'] ?? null,
            'temperature' => $temperature,
            'spin' => $spin,
            'message' => $program
                ? "Programa «{$program['name']}» a {$this->format($temperature, $maxTemp, '°')} y {$this->format($spin, $settings['max_spin'], ' rpm')} como máximo."
                : "No encuentro un programa adecuado: usa uno delicado a {$maxTemp}° y {$settings['max_spin']} rpm como máximo.",
        ];
    }

    private function drySuggestion(string $tumbleDry, Appliance $appliance): array
    {
        $base = [
            'appliance_id' => $appliance->id,
            'appliance_name' => $appliance->name,
            'step' => 'dry',
            'temperature' => null,
            'spin' => null,
        ];

        if ($tumbleDry === 'none') {
            return $base + ['program' => null, 'message' => 'No la metas en la secadora.'];
        }

        $categories = $tumbleDry === 'low'
            ? ['delicate', 'synthetic', 'wool', 'mixed']
            : ['cotton', 'mixed', 'synthetic'];
        $program = $this->findProgram($appliance, $categories);
        $heat = $tumbleDry === 'low' ? 'a baja temperatura' : 'a temperatura normal';

        return $base + [
            'program' => $program['name'] ?? null,
            'message' => $program
                ? "Programa «{$program['name']}» {$heat}."
                : "Sécala {$heat}.",
        ];
    }

    private function findProgram(Appliance $appliance, array $categories): ?array
    {
        foreach ($categories as $category) {
            foreach ($appliance->programs as $program) {
                if (ProgramCategory::of($program) === $category) {
                    return $program;
                }
            }
        }

        return null;
    }

    private function highestUpTo(array $available, int $limit): ?int
    {
        $allowed = array_filter($available, fn (int $value) => $value <= $limit);

        return $allowed ? max($allowed) : null;
    }

    private function format(?int $value, int $fallback, string $unit): string
    {
        return ($value ?? $fallback).$unit;
    }
}
