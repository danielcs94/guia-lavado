import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(err: HttpErrorResponse): string {
  if (err.status === 0) {
    return 'No hay conexión con el servidor. ¿Está arrancado el backend?';
  }
  if (err.status === 422 && err.error?.errors) {
    return Object.values(err.error.errors as Record<string, string[]>).flat().join(' ');
  }
  return err.error?.message ?? `Error inesperado (${err.status}).`;
}
