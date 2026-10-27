import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Appliance, ApplianceInput, Program } from '../../core/laundry-api';
import { APPLIANCE_KINDS, PROGRAM_CATEGORIES } from '../../core/texts';

/**
 * Formulario para dar de alta un electrodoméstico a mano
 * o corregir los programas que haya leído la IA.
 */
@Component({
  selector: 'app-appliance-editor',
  imports: [FormsModule],
  templateUrl: './appliance-editor.html',
  styleUrl: './appliance-editor.scss',
})
export class ApplianceEditor implements OnInit {
  readonly appliance = input<Appliance | null>(null);
  readonly saving = input(false);
  readonly save = output<ApplianceInput>();
  readonly cancel = output<void>();

  protected readonly kinds = Object.entries(APPLIANCE_KINDS);
  protected readonly categories = Object.entries(PROGRAM_CATEGORIES);

  protected readonly name = signal('');
  protected readonly kind = signal<Appliance['kind']>('washer');
  protected readonly programs = signal<Program[]>([{ name: '', category: 'cotton', max_temp: null }]);
  protected readonly temperatures = signal('20, 30, 40, 60, 90');
  protected readonly spinSpeeds = signal('400, 800, 1000, 1200');

  ngOnInit(): void {
    const appliance = this.appliance();
    if (appliance) {
      this.name.set(appliance.name);
      this.kind.set(appliance.kind);
      this.programs.set(appliance.programs);
      this.temperatures.set(appliance.temperatures.join(', '));
      this.spinSpeeds.set(appliance.spin_speeds.join(', '));
    }
  }

  protected addProgram(): void {
    this.programs.update((programs) => [...programs, { name: '', category: 'other', max_temp: null }]);
  }

  protected updateProgram(index: number, changes: Partial<Program>): void {
    this.programs.update((programs) =>
      programs.map((program, i) => (i === index ? { ...program, ...changes } : program)),
    );
  }

  protected removeProgram(index: number): void {
    this.programs.update((programs) => programs.filter((_, i) => i !== index));
  }

  protected temperature(value: string | number | null): number | null {
    const number = Number(value);
    return value === '' || value === null || Number.isNaN(number) ? null : Math.round(number);
  }

  protected submit(): void {
    const appliance = this.appliance();
    this.save.emit({
      name: this.name().trim(),
      kind: this.kind(),
      brand: appliance?.brand ?? null,
      model: appliance?.model ?? null,
      programs: this.programs().map((program) => ({ ...program, name: program.name.trim() })),
      temperatures: parseNumbers(this.temperatures()),
      spin_speeds: parseNumbers(this.spinSpeeds()),
    });
  }
}

/** "20, 30 40" → [20, 30, 40] */
function parseNumbers(text: string): number[] {
  return text
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
}
