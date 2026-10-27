import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';

import { Label } from './laundry-api';

/**
 * El intermediario de Cloudflare que guarda la clave de la API y llama a Claude.
 * Con `ng serve` se usa el que arranca `npm run dev` en lector/.
 */
const READER_URL = isDevMode()
  ? `http://${location.hostname}:8787`
  : 'https://guia-lavado.danielcs94.workers.dev';

const CODE_KEY = 'guia-lavado.codigo';

export interface ApplianceReading {
  readable: boolean;
  confidence: number;
  kind: 'washer' | 'dryer' | 'washer_dryer';
  brand: string | null;
  model: string | null;
  programs: { name: string; category: string; max_temp: number | null }[];
  temperatures: number[];
  spin_speeds: number[];
}

/**
 * Manda la foto al intermediario para que la IA la lea. La primera vez pide
 * el código de acceso (para que nadie más gaste el saldo) y lo recuerda.
 */
@Injectable({ providedIn: 'root' })
export class PhotoReader {
  private readonly http = inject(HttpClient);

  readLabel(photo: Blob): Observable<Label> {
    return this.read<Label>('etiqueta', photo);
  }

  readAppliance(photo: Blob): Observable<ApplianceReading> {
    return this.read<ApplianceReading>('panel', photo);
  }

  private read<T>(what: 'etiqueta' | 'panel', photo: Blob, retry = true): Observable<T> {
    return from(toBase64(photo)).pipe(
      switchMap((image) =>
        this.http.post<T>(`${READER_URL}/${what}`, { image }, { headers: { 'X-Codigo': storedCode() } }),
      ),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401 && retry && askForCode()) {
          return this.read<T>(what, photo, false);
        }
        return throwError(() => err);
      }),
    );
  }
}

function storedCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

function askForCode(): boolean {
  const code = prompt('Escribe el código de acceso para leer fotos:')?.trim();
  if (!code) {
    return false;
  }
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    // Sin almacenamiento: lo volverá a pedir la próxima vez.
  }
  return true;
}

function toBase64(photo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(photo);
  });
}
