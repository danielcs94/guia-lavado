<?php

namespace App\Laundry;

final class LaundryAdvisor
{
    private const MIN_CONFIDENCE = 0.6;
    private const MIN_DELICATE_PERCENT = 30;
    private const DELICATE_FIBERS = ['wool', 'silk', 'cashmere'];
    private const SPECIALIST_FIBERS = ['leather', 'suede'];
    private const STRUCTURED_GARMENTS = ['blazer', 'suit', 'coat'];

    private Verdict $verdict;
    private array $reasons;
    private array $dryCleanReasons;
    private array $tips;

    public function advise(array $label): array
    {
        $this->verdict = Verdict::Home;
        $this->reasons = [];
        $this->dryCleanReasons = [];
        $this->tips = [];

        if (!($label['readable'] ?? false) || ($label['confidence'] ?? 0) < self::MIN_CONFIDENCE) {
            return [
                'needs_retake' => true,
                'message' => 'No se lee bien la etiqueta. Haz otra foto más cerca y con más luz.',
            ];
        }

        $this->checkWashSymbols($label);
        $this->checkFibers($label);
        $this->checkGarment($label);

        return [
            'needs_retake' => false,
            'verdict' => $this->verdict->name,
            'verdict_label' => $this->verdict->label(),
            'reasons' => $this->reasons,
            'dry_clean_reasons' => $this->dryCleanReasons,
            'settings' => $this->washSettings($label),
            'tips' => array_values(array_unique($this->tips)),
        ];
    }

    private function raise(Verdict $verdict, string $reason): void
    {
        if ($verdict->value > $this->verdict->value) {
            $this->verdict = $verdict;
        }
        $this->reasons[] = $reason;
        if ($verdict->value >= Verdict::DryCleanRecommended->value) {
            $this->dryCleanReasons[] = $reason;
        }
    }

    private function checkWashSymbols(array $label): void
    {
        $method = $label['wash']['method'] ?? null;
        $dryClean = $label['professional']['dry_clean'] ?? null;
        $wetClean = $label['professional']['wet_clean'] ?? null;

        if ($method === 'none') {
            if (in_array($dryClean, ['P', 'F'], true) || $wetClean === true) {
                $this->raise(Verdict::DryCleanRequired, 'La etiqueta prohíbe lavar con agua y pide limpieza profesional.');
            } else {
                $this->raise(Verdict::DryCleanRecommended, 'La etiqueta prohíbe lavar con agua.');
            }
            return;
        }

        if ($method === 'hand') {
            $this->raise(Verdict::HomeCareful, 'Solo admite lavado a mano.');
            $this->tips[] = 'Si tu lavadora tiene programa "lana" o "lavado a mano", puedes usarlo.';
        } elseif (($label['wash']['cycle'] ?? null) === 'very_mild') {
            $this->raise(Verdict::HomeCareful, 'Pide un programa muy delicado.');
        }
    }

    private function checkFibers(array $label): void
    {
        $method = $label['wash']['method'] ?? null;

        foreach ($label['fibers'] ?? [] as $fiber) {
            $name = $fiber['name'];
            $percent = $fiber['percent'] ?? 100;

            if (in_array($name, self::SPECIALIST_FIBERS, true)) {
                $this->raise(Verdict::DryCleanRequired, "Contiene {$this->fiberName($name)}: necesita una tintorería especializada.");
                continue;
            }

            if (!in_array($name, self::DELICATE_FIBERS, true) || $percent < self::MIN_DELICATE_PERCENT || $method === 'none') {
                continue;
            }

            if ($method === null) {
                $this->raise(Verdict::DryCleanRecommended, "Es {$percent}% {$this->fiberName($name)} y la etiqueta no dice cómo lavarla.");
            } else {
                $this->raise(Verdict::HomeCareful, "Es {$percent}% {$this->fiberName($name)}: usa el programa de lana o delicado.");
                $this->tips[] = 'Usa detergente para lana o prendas delicadas.';
            }
        }
    }

    private function checkGarment(array $label): void
    {
        $type = $label['garment']['type'] ?? null;

        if (in_array($type, self::STRUCTURED_GARMENTS, true)) {
            $this->raise(Verdict::DryCleanRecommended, 'Tiene estructura interna (entretelas, hombreras) que se deforma en la lavadora.');
        }

        if ($type === 'down_jacket') {
            $this->raise(Verdict::HomeCareful, 'Es de plumas: necesita aclarado extra y secado lento.');
            if (($label['tumble_dry'] ?? 'none') !== 'none') {
                $this->tips[] = 'Sécala a baja temperatura con 2-3 pelotas de tenis para que no se apelmace el plumón.';
            }
        }

        if ($label['garment']['embellishments'] ?? false) {
            $this->raise(Verdict::HomeCareful, 'Tiene adornos (lentejuelas, pedrería, estampados).');
            $this->tips[] = 'Lávala del revés y dentro de una bolsa de red.';
        }
    }

    private function washSettings(array $label): ?array
    {
        $wash = $label['wash'] ?? [];
        $method = $wash['method'] ?? null;

        if ($method === 'none' || $this->verdict === Verdict::DryCleanRequired) {
            return null;
        }

        $missing = array_filter(
            ['temperatura' => $wash['max_temp'] ?? null, 'lejía' => $label['bleach'] ?? null, 'secadora' => $label['tumble_dry'] ?? null, 'plancha' => $label['iron'] ?? null],
            fn ($value) => $value === null,
        );
        if ($missing) {
            $this->tips[] = 'La etiqueta no indica ' . implode(', ', array_keys($missing)) . ': he elegido la opción más segura.';
        }

        $careful = $this->verdict->value >= Verdict::HomeCareful->value;
        $cycle = $method === 'hand' ? 'hand' : ($wash['cycle'] ?? ($careful ? 'mild' : 'normal'));

        return [
            'method' => $method ?? 'machine',
            'cycle' => $cycle,
            'max_temp' => $wash['max_temp'] ?? 30,
            'max_spin' => match ($cycle) {
                'normal' => 1200,
                'mild' => 800,
                'very_mild' => 600,
                'hand' => 400,
            },
            'bleach' => $label['bleach'] ?? 'none',
            'tumble_dry' => $label['tumble_dry'] ?? 'none',
            'natural_dry' => $label['natural_dry'] ?? null,
            'iron' => $label['iron'] ?? 'low',
        ];
    }

    private function fiberName(string $fiber): string
    {
        return match ($fiber) {
            'wool' => 'lana',
            'silk' => 'seda',
            'cashmere' => 'cachemir',
            'leather' => 'cuero',
            'suede' => 'ante',
            default => $fiber,
        };
    }
}
