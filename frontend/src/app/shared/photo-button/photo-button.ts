import { Component, input, output } from '@angular/core';

/**
 * Botón que abre directamente la cámara trasera del móvil
 * (en el ordenador abre el selector de archivos).
 * Con `multiple` abre la galería y deja elegir varias fotos.
 */
@Component({
  selector: 'app-photo-button',
  templateUrl: './photo-button.html',
  styleUrl: './photo-button.scss',
})
export class PhotoButton {
  readonly text = input.required<string>();
  readonly disabled = input(false);
  readonly multiple = input(false);
  readonly secondary = input(false);
  readonly photo = output<File>();
  readonly photos = output<File[]>();

  protected onChange(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    if (files.length) {
      this.photo.emit(files[0]);
      this.photos.emit(files);
    }
  }
}
