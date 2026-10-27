import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GarmentType, LabelResult } from '../../core/laundry-api';
import { BLEACH, CYCLES, FIBERS, GARMENTS, IRON, NATURAL_DRY, TUMBLE_DRY } from '../../core/texts';

@Component({
  selector: 'app-advice-card',
  imports: [FormsModule],
  templateUrl: './advice-card.html',
  styleUrl: './advice-card.scss',
})
export class AdviceCard {
  readonly result = input.required<LabelResult>();
  readonly garmentChange = output<GarmentType | null>();

  protected readonly garments = Object.entries(GARMENTS) as [GarmentType, string][];
  protected readonly texts = { CYCLES, BLEACH, TUMBLE_DRY, NATURAL_DRY, IRON };

  protected readonly currentAdvice = computed(() => this.result().advice);
  protected readonly label = computed(() => this.result().label);
  protected readonly garmentType = computed(() => this.label().garment?.type ?? null);

  protected readonly composition = computed(() =>
    this.label()
      .fibers.map((fiber) => `${fiber.percent !== null ? fiber.percent + '% ' : ''}${FIBERS[fiber.name] ?? fiber.name}`)
      .join(', '),
  );
}
