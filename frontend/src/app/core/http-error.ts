import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(err: HttpErrorResponse): string {
  if (err.status === 0) {
    return 'No hay conexión. Revisa que tengas internet.';
  }
  if (err.status === 401) {
    return 'El código de acceso no es correcto. Vuelve a hacer la foto para escribirlo otra vez.';
  }
  return err.error?.message ?? `Error inesperado (${err.status}).`;
}
