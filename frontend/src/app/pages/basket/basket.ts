import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Basket as BasketStore, BasketItem } from '../../core/basket';
import { ClothColor, GarmentType, Label } from '../../core/laundry-api';
import { CYCLES, FIBERS, GARMENTS, NATURAL_DRY, TUMBLE_DRY } from '../../core/texts';
import { CareSymbol } from '../../shared/care-symbol/care-symbol';
import { LabelEditor } from '../../shared/label-editor/label-editor';
import { PhotoButton } from '../../shared/photo-button/photo-button';

const COLORS: { value: ClothColor; text: string }[] = [
  { value: 'white', text: 'Blanco' },
  { value: 'light', text: 'Claro' },
  { value: 'dark', text: 'Oscuro' },
  { value: 'color', text: 'De color' },
];

/**
 * Modo colada: fotos de varias prendas → en cuántas lavadoras y cómo.
 */
@Component({
  selector: 'app-basket',
  imports: [FormsModule, RouterLink, CareSymbol, LabelEditor, PhotoButton],
  templateUrl: './basket.html',
  styleUrl: './basket.scss',
})
export class Basket {
  protected readonly basket = inject(BasketStore);

  /** Prenda cuyos símbolos se están corrigiendo, o 'new' para una a mano. */
  protected readonly editing = signal<string | 'new' | null>(null);
  protected readonly editingLabel = computed(() => {
    const id = this.editing();
    return this.basket.items().find((item) => item.id === id)?.label ?? null;
  });

  protected readonly colors = COLORS;
  protected readonly garments = Object.entries(GARMENTS) as [GarmentType, string][];
  protected readonly texts = { CYCLES, NATURAL_DRY, TUMBLE_DRY };

  private readonly byId = computed(() => new Map(this.basket.items().map((item, index) => [item.id, { item, index }])));

  protected name(id: string): string {
    const entry = this.byId().get(id);
    if (!entry) {
      return 'Prenda';
    }
    const { item, index } = entry;
    const garment = item.garmentType ? GARMENTS[item.garmentType] : `Prenda ${index + 1}`;
    const fiber = item.label?.fibers[0];
    return fiber ? `${garment} de ${FIBERS[fiber.name] ?? fiber.name}` : garment;
  }

  protected kilos(value: number): string {
    return value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  }

  protected thumb(id: string): string | null {
    return this.byId().get(id)?.item.thumb ?? null;
  }

  protected setColor(item: BasketItem, color: ClothColor): void {
    this.basket.update(item.id, { color });
  }

  protected setGarment(item: BasketItem, garmentType: GarmentType | null): void {
    this.basket.update(item.id, { garmentType });
  }

  protected startEditing(id: string | 'new'): void {
    this.editing.set(id);
    window.scrollTo({ top: 0 });
  }

  protected onLabelEdited(label: Label): void {
    const id = this.editing();
    if (id === 'new') {
      this.basket.addManual(label);
    } else if (id) {
      this.basket.update(id, { label, status: 'ready', error: null, garmentType: label.garment?.type ?? null });
    }
    this.editing.set(null);
  }

  protected clear(): void {
    if (confirm('¿Vaciar la colada?')) {
      this.basket.clear();
    }
  }

  protected makePlan(): void {
    this.basket.makePlan();
  }
}
