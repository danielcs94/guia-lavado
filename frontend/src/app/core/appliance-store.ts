import { Appliance, ApplianceInput } from './laundry-api';

const STORAGE_KEY = 'guia-lavado.electrodomesticos';

/**
 * Los electrodomésticos se guardan en el propio móvil: cada persona tiene los suyos.
 */
export function loadAppliances(): Appliance[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveAppliance(input: ApplianceInput, id?: number): Appliance {
  const appliance: Appliance = { ...input, id: id ?? Date.now() };
  const others = loadAppliances().filter((item) => item.id !== appliance.id);
  write([appliance, ...others]);
  return appliance;
}

export function deleteAppliance(id: number): void {
  write(loadAppliances().filter((item) => item.id !== id));
}

function write(appliances: Appliance[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appliances));
  } catch {
    // Sin almacenamiento (modo privado): se pierden al cerrar la app.
  }
}
