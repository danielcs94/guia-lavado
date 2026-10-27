import { Label } from '../core/laundry-api';

/** Lecturas de ejemplo (las mismas que usan los tests del backend). */
export const camiseta = (): Label => ({
  readable: true,
  confidence: 0.95,
  wash: { method: 'machine', max_temp: 40, cycle: 'normal' },
  bleach: 'none',
  tumble_dry: 'low',
  natural_dry: null,
  iron: 'medium',
  professional: { dry_clean: null, wet_clean: null },
  fibers: [{ name: 'cotton', percent: 100 }],
  garment: { type: 'tshirt', embellishments: false },
  notes: [],
});

export const jerseyLana = (): Label => ({
  readable: true,
  confidence: 0.9,
  wash: { method: 'hand', max_temp: 30, cycle: null },
  bleach: 'none',
  tumble_dry: 'none',
  natural_dry: 'flat',
  iron: 'low',
  professional: { dry_clean: 'P', wet_clean: null },
  fibers: [{ name: 'wool', percent: 100 }],
  garment: { type: 'sweater', embellishments: false },
  notes: ['Lavar del revés'],
});

export const americana = (): Label => ({
  readable: true,
  confidence: 0.85,
  wash: { method: 'none', max_temp: null, cycle: null },
  bleach: 'none',
  tumble_dry: 'none',
  natural_dry: null,
  iron: 'medium',
  professional: { dry_clean: 'P', wet_clean: null },
  fibers: [
    { name: 'wool', percent: 70 },
    { name: 'polyester', percent: 30 },
  ],
  garment: { type: 'blazer', embellishments: false },
  notes: [],
});

export const borrosa = (): Label => ({
  readable: false,
  confidence: 0.2,
  wash: null,
  bleach: null,
  tumble_dry: null,
  natural_dry: null,
  iron: null,
  professional: null,
  fibers: [],
  garment: null,
  notes: [],
});
