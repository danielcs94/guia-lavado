import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { errorMessage } from './http-error';
import { compressImage, thumbnail } from './image';
import { ClothColor, GarmentType, Label, LaundryApi, LoadPlan } from './laundry-api';

export interface BasketItem {
  id: string;
  thumb: string | null;
  status: 'waiting' | 'reading' | 'ready' | 'error';
  error: string | null;
  label: Label | null;
  color: ClothColor | null;
  garmentType: GarmentType | null;
}

const STORAGE_KEY = 'guia-lavado.colada';

/**
 * La ropa sucia de la colada. Vive fuera de la página para que las fotos
 * se sigan leyendo aunque cambies de pestaña, y se guarda en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class Basket {
  private readonly api = inject(LaundryApi);
  private readonly photos = new Map<string, File>();
  private reading = false;

  readonly items = signal<BasketItem[]>(restore());
  readonly plan = signal<LoadPlan | null>(null);
  readonly planning = signal(false);
  readonly planError = signal('');

  readonly pending = computed(() => this.items().filter((item) => item.status === 'waiting' || item.status === 'reading').length);
  readonly missingColor = computed(() => this.items().filter((item) => item.status === 'ready' && !item.color).length);
  readonly canPlan = computed(
    () => this.items().some((item) => item.status === 'ready') && this.pending() === 0 && this.missingColor() === 0,
  );

  constructor() {
    effect(() => save(this.items()));
  }

  async addPhotos(files: File[]): Promise<void> {
    for (const file of files) {
      const id = newId();
      this.photos.set(id, file);
      this.add({ id, thumb: await thumbnail(file), status: 'waiting', error: null, label: null, color: null, garmentType: null });
    }
    this.readNext();
  }

  addManual(label: Label): void {
    this.add({ id: newId(), thumb: null, status: 'ready', error: null, label, color: null, garmentType: label.garment?.type ?? null });
  }

  update(id: string, changes: Partial<BasketItem>): void {
    this.items.update((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    this.plan.set(null);
  }

  remove(id: string): void {
    this.photos.delete(id);
    this.items.update((items) => items.filter((item) => item.id !== id));
    this.plan.set(null);
  }

  clear(): void {
    this.photos.clear();
    this.items.set([]);
    this.plan.set(null);
    this.planError.set('');
  }

  makePlan(): void {
    const items = this.items()
      .filter((item) => item.status === 'ready')
      .map((item) => ({ id: item.id, label: item.label!, color: item.color!, garment_type: item.garmentType }));

    this.planning.set(true);
    this.planError.set('');
    this.api.planLoads(items).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.planning.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.planError.set(errorMessage(err));
        this.planning.set(false);
      },
    });
  }

  private add(item: BasketItem): void {
    this.items.update((items) => [...items, item]);
    this.plan.set(null);
  }

  /**
   * Lee las fotos de una en una: el modelo local solo puede con una a la vez.
   */
  private async readNext(): Promise<void> {
    const next = this.items().find((item) => item.status === 'waiting');
    if (this.reading || !next) {
      return;
    }

    const file = this.photos.get(next.id);
    if (!file) {
      this.update(next.id, { status: 'error', error: 'Se ha perdido la foto. Hazla otra vez.' });
      this.readNext();
      return;
    }

    this.reading = true;
    this.update(next.id, { status: 'reading' });
    const photo = await compressImage(file);

    this.api.scanLabel(photo).subscribe({
      next: ({ label, advice }) => {
        this.photos.delete(next.id);
        this.update(next.id, {
          status: advice.needs_retake ? 'error' : 'ready',
          error: advice.needs_retake ? advice.message : null,
          label,
          garmentType: label.garment?.type ?? null,
        });
        this.reading = false;
        this.readNext();
      },
      error: (err: HttpErrorResponse) => {
        this.update(next.id, { status: 'error', error: errorMessage(err) });
        this.reading = false;
        this.readNext();
      },
    });
  }
}

/** crypto.randomUUID no existe en http:// (el iPhone entra por la IP del Mac). */
function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function restore(): BasketItem[] {
  try {
    const items: BasketItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    // Las fotos no se guardan: lo que estaba a medio leer hay que repetirlo.
    return items.map((item) =>
      item.status === 'ready' || item.status === 'error'
        ? item
        : { ...item, status: 'error', error: 'Se cerró la app antes de leerla. Hazle otra foto.' },
    );
  } catch {
    return [];
  }
}

function save(items: BasketItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado): la colada solo dura mientras la app está abierta.
  }
}
