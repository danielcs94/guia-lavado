import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { compressImage } from '../../core/image';
import { errorMessage } from '../../core/http-error';
import { GarmentType, Label, LabelResult, LaundryApi } from '../../core/laundry-api';
import { AdviceCard } from '../../shared/advice-card/advice-card';
import { LabelEditor } from '../../shared/label-editor/label-editor';
import { PhotoButton } from '../../shared/photo-button/photo-button';

@Component({
  selector: 'app-scan',
  imports: [RouterLink, AdviceCard, LabelEditor, PhotoButton],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class Scan {
  private readonly api = inject(LaundryApi);

  protected readonly loading = signal(false);
  protected readonly editing = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly result = signal<LabelResult | null>(null);

  protected async onPhoto(file: File): Promise<void> {
    this.loading.set(true);
    this.editing.set(false);
    this.errorMessage.set('');
    this.result.set(null);

    const photo = await compressImage(file);
    this.api.scanLabel(photo).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected onGarmentChange(garmentType: GarmentType | null): void {
    const current = this.result();
    if (current) {
      this.requestAdvice(current.label, garmentType);
    }
  }

  protected onLabelEdited(label: Label): void {
    this.editing.set(false);
    this.requestAdvice(label, label.garment?.type ?? null);
  }

  protected startEditing(): void {
    this.errorMessage.set('');
    this.editing.set(true);
    window.scrollTo({ top: 0 });
  }

  private requestAdvice(label: Label, garmentType: GarmentType | null): void {
    this.errorMessage.set('');
    this.api.advice(label, garmentType).subscribe({
      next: (result) => this.result.set(result),
      error: (err: HttpErrorResponse) => this.errorMessage.set(errorMessage(err)),
    });
  }
}
