import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { compressImage } from '../../core/image';
import { errorMessage } from '../../core/http-error';
import { Appliance, ApplianceInput, LaundryApi } from '../../core/laundry-api';
import { APPLIANCE_KINDS } from '../../core/texts';
import { ApplianceEditor } from '../../shared/appliance-editor/appliance-editor';
import { PhotoButton } from '../../shared/photo-button/photo-button';

@Component({
  selector: 'app-appliances',
  imports: [FormsModule, ApplianceEditor, PhotoButton],
  templateUrl: './appliances.html',
  styleUrl: './appliances.scss',
})
export class Appliances implements OnInit {
  private readonly api = inject(LaundryApi);

  protected readonly kinds = APPLIANCE_KINDS;
  protected readonly appliances = signal<Appliance[]>([]);
  protected readonly name = signal('');
  protected readonly scanning = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly expandedId = signal<number | null>(null);
  /** 'new' = alta manual; un electrodoméstico = editándolo; null = sin editor. */
  protected readonly editing = signal<Appliance | 'new' | null>(null);
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.api.appliances().subscribe({
      next: (appliances) => this.appliances.set(appliances),
      error: (err: HttpErrorResponse) => this.errorMessage.set(errorMessage(err)),
    });
  }

  protected async onPhoto(file: File): Promise<void> {
    this.scanning.set(true);
    this.errorMessage.set('');

    const photo = await compressImage(file);
    this.api.scanAppliance(photo, this.name()).subscribe({
      next: (appliance) => {
        this.appliances.update((list) => [appliance, ...list]);
        this.expandedId.set(appliance.id);
        this.name.set('');
        this.scanning.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(errorMessage(err));
        this.scanning.set(false);
      },
    });
  }

  protected edit(appliance: Appliance | 'new'): void {
    this.errorMessage.set('');
    this.editing.set(appliance);
    window.scrollTo({ top: 0 });
  }

  protected onSave(input: ApplianceInput): void {
    const editing = this.editing();
    this.saving.set(true);
    this.errorMessage.set('');

    const request =
      editing === 'new' || editing === null
        ? this.api.createAppliance(input)
        : this.api.updateAppliance(editing.id, input);

    request.subscribe({
      next: (saved) => {
        this.appliances.update((list) =>
          list.some((item) => item.id === saved.id)
            ? list.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...list],
        );
        this.expandedId.set(saved.id);
        this.editing.set(null);
        this.saving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(errorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected toggle(id: number): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  protected remove(appliance: Appliance): void {
    if (!confirm(`¿Borrar «${appliance.name}»?`)) {
      return;
    }

    this.api.deleteAppliance(appliance.id).subscribe({
      next: () => this.appliances.update((list) => list.filter((item) => item.id !== appliance.id)),
      error: (err: HttpErrorResponse) => this.errorMessage.set(errorMessage(err)),
    });
  }
}
