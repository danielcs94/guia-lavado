<?php

namespace App\Laundry;

enum Verdict: int
{
    case Home = 0;
    case HomeCareful = 1;
    case DryCleanRecommended = 2;
    case DryCleanRequired = 3;

    public function label(): string
    {
        return match ($this) {
            self::Home => 'Lavar en casa',
            self::HomeCareful => 'Lavar en casa con cuidado',
            self::DryCleanRecommended => 'Mejor llevar a la tintorería',
            self::DryCleanRequired => 'Tintorería obligatoria',
        };
    }
}
