import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GarmentType, Label } from '../../core/laundry-api';
import { FIBERS, GARMENTS } from '../../core/texts';
import { CareSymbol } from '../care-symbol/care-symbol';

type Professional = 'P' | 'F' | 'W' | 'none' | null;

interface Choice<T> {
  value: T;
  symbol: string | null;
  text: string;
}

const UNKNOWN = 'No indica';

/**
 * Formulario para marcar a mano los símbolos de la etiqueta,
 * o corregir los que la IA haya leído mal.
 */
@Component({
  selector: 'app-label-editor',
  imports: [FormsModule, CareSymbol],
  templateUrl: './label-editor.html',
  styleUrl: './label-editor.scss',
})
export class LabelEditor implements OnInit {
  readonly label = input<Label | null>(null);
  readonly save = output<Label>();
  readonly cancel = output<void>();

  protected readonly draft = signal<Label>(emptyLabel());

  protected readonly garments = Object.entries(GARMENTS) as [GarmentType, string][];
  protected readonly fibers = Object.entries(FIBERS);

  protected readonly washMethods: Choice<NonNullable<Label['wash']>['method']>[] = [
    { value: 'machine', symbol: 'wash-machine', text: 'Lavadora' },
    { value: 'hand', symbol: 'wash-hand', text: 'A mano' },
    { value: 'none', symbol: 'wash-none', text: 'No lavar' },
    { value: null, symbol: null, text: UNKNOWN },
  ];
  protected readonly temperatures: Choice<number | null>[] = [
    ...[30, 40, 50, 60, 70, 95].map((temp) => ({ value: temp, symbol: `temp-${temp}`, text: `${temp}°` })),
    { value: null, symbol: null, text: UNKNOWN },
  ];
  protected readonly cycles: Choice<'normal' | 'mild' | 'very_mild' | null>[] = [
    { value: 'normal', symbol: 'cycle-normal', text: 'Sin raya' },
    { value: 'mild', symbol: 'cycle-mild', text: '1 raya' },
    { value: 'very_mild', symbol: 'cycle-very_mild', text: '2 rayas' },
    { value: null, symbol: null, text: UNKNOWN },
  ];
  protected readonly bleaches: Choice<Label['bleach']>[] = [
    { value: 'any', symbol: 'bleach-any', text: 'Cualquiera' },
    { value: 'oxygen_only', symbol: 'bleach-oxygen_only', text: 'Sin cloro' },
    { value: 'none', symbol: 'bleach-none', text: 'No' },
    { value: null, symbol: null, text: UNKNOWN },
  ];
  protected readonly tumbleDries: Choice<Label['tumble_dry']>[] = [
    { value: 'low', symbol: 'tumble-low', text: 'Baja' },
    { value: 'normal', symbol: 'tumble-normal', text: 'Normal' },
    { value: 'none', symbol: 'tumble-none', text: 'No' },
    { value: null, symbol: null, text: UNKNOWN },
  ];
  protected readonly naturalDries: Choice<Label['natural_dry']>[] = [
    { value: 'line', symbol: 'dry-line', text: 'Tendida' },
    { value: 'drip_line', symbol: 'dry-drip_line', text: 'Sin escurrir' },
    { value: 'flat', symbol: 'dry-flat', text: 'Horizontal' },
    { value: 'drip_flat', symbol: 'dry-drip_flat', text: 'Horiz. sin escurrir' },
    { value: null, symbol: null, text: UNKNOWN },
  ];
  protected readonly irons: Choice<Label['iron']>[] = [
    { value: 'low', symbol: 'iron-low', text: 'Baja' },
    { value: 'medium', symbol: 'iron-medium', text: 'Media' },
    { value: 'high', symbol: 'iron-high', text: 'Alta' },
    { value: 'none', symbol: 'iron-none', text: 'No' },
    { value: null, symbol: null, text: UNKNOWN },
  ];
  protected readonly professionals: Choice<Professional>[] = [
    { value: 'P', symbol: 'pro-P', text: 'Tintorería' },
    { value: 'F', symbol: 'pro-F', text: 'Tintorería suave' },
    { value: 'W', symbol: 'pro-W', text: 'Limpieza en húmedo' },
    { value: 'none', symbol: 'pro-none', text: 'No limpiar en seco' },
    { value: null, symbol: null, text: UNKNOWN },
  ];

  ngOnInit(): void {
    const label = this.label();
    if (label) {
      this.draft.set(normalize(label));
    }
  }

  protected wash(): NonNullable<Label['wash']> {
    return this.draft().wash!;
  }

  protected professional(): Professional {
    const pro = this.draft().professional;
    return pro?.wet_clean ? 'W' : (pro?.dry_clean ?? null);
  }

  protected setWash(changes: Partial<NonNullable<Label['wash']>>): void {
    this.draft.update((label) => {
      const wash = { ...label.wash!, ...changes };
      if (wash.method === 'none' || wash.method === null) {
        wash.max_temp = null;
        wash.cycle = null;
      }
      if (wash.method === 'hand') {
        wash.cycle = null;
        wash.max_temp = wash.max_temp !== null && wash.max_temp > 40 ? 40 : wash.max_temp;
      }
      return { ...label, wash };
    });
  }

  protected set<K extends 'bleach' | 'tumble_dry' | 'natural_dry' | 'iron'>(key: K, value: Label[K]): void {
    this.draft.update((label) => ({ ...label, [key]: value }));
  }

  protected setProfessional(value: Professional): void {
    const professional =
      value === 'W' ? { dry_clean: null, wet_clean: true } : { dry_clean: value, wet_clean: null };
    this.draft.update((label) => ({ ...label, professional }));
  }

  protected setGarment(changes: Partial<NonNullable<Label['garment']>>): void {
    this.draft.update((label) => ({ ...label, garment: { ...label.garment!, ...changes } }));
  }

  protected addFiber(): void {
    this.draft.update((label) => ({ ...label, fibers: [...label.fibers, { name: 'cotton', percent: null }] }));
  }

  protected updateFiber(index: number, changes: Partial<Label['fibers'][number]>): void {
    this.draft.update((label) => ({
      ...label,
      fibers: label.fibers.map((fiber, i) => (i === index ? { ...fiber, ...changes } : fiber)),
    }));
  }

  protected removeFiber(index: number): void {
    this.draft.update((label) => ({ ...label, fibers: label.fibers.filter((_, i) => i !== index) }));
  }

  protected percent(value: string | number | null): number | null {
    const number = Number(value);
    return value === '' || value === null || Number.isNaN(number) ? null : Math.round(number);
  }

  protected submit(): void {
    // Si lo marcas tú, la lectura es segura.
    this.save.emit({ ...this.draft(), readable: true, confidence: 1 });
  }
}

function emptyLabel(): Label {
  return {
    readable: true,
    confidence: 1,
    wash: { method: null, max_temp: null, cycle: null },
    bleach: null,
    tumble_dry: null,
    natural_dry: null,
    iron: null,
    professional: { dry_clean: null, wet_clean: null },
    fibers: [],
    garment: { type: null, embellishments: false },
    notes: [],
  };
}

function normalize(label: Label): Label {
  const empty = emptyLabel();
  return {
    ...label,
    wash: label.wash ?? empty.wash,
    professional: label.professional ?? empty.professional,
    garment: label.garment ?? empty.garment,
  };
}
