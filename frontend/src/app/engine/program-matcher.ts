import { Appliance, ApplianceSuggestion, Label, Program, WashSettings } from '../core/laundry-api';
import { categoryOf } from './program-category';

export type Care = 'down' | 'silk' | 'wool' | 'hand' | 'very_mild' | 'mild' | 'towels' | 'normal';

/**
 * Tipos de cuidado de más a menos delicado, con sus categorías de programa por orden de preferencia.
 */
export const CARE_CATEGORIES: Record<Care, string[]> = {
  down: ['down', 'delicate', 'synthetic'],
  silk: ['silk', 'hand_wash', 'delicate', 'wool'],
  wool: ['wool', 'hand_wash', 'delicate'],
  hand: ['hand_wash', 'wool', 'silk', 'delicate'],
  very_mild: ['delicate', 'wool', 'hand_wash'],
  mild: ['synthetic', 'delicate', 'mixed'],
  towels: ['cotton', 'bedding', 'mixed'],
  normal: ['cotton', 'mixed', 'eco'],
};

/** Los ajustes que necesita el matcher (los de una prenda o los de una colada entera). */
type Limits = Pick<WashSettings, 'max_temp' | 'max_spin'>;

/**
 * Traduce los ajustes genéricos del motor a un programa concreto de cada
 * electrodoméstico guardado.
 */
export function matchAppliances(
  label: Label,
  settings: WashSettings | null,
  appliances: Appliance[],
): ApplianceSuggestion[] {
  if (settings === null) {
    return [];
  }

  const care = careOf(label, settings);
  return appliances.flatMap((appliance) => [
    ...(washes(appliance) ? [washSuggestion(care, settings, appliance)] : []),
    ...(dries(appliance) ? [drySuggestion(settings.tumble_dry, appliance)] : []),
  ]);
}

/** Sugerencias de lavado de una colada con varias prendas. */
export function matchWash(
  care: Care,
  settings: Limits,
  appliances: Appliance[],
): ApplianceSuggestion[] {
  return appliances.filter(washes).map((appliance) => washSuggestion(care, settings, appliance));
}

export function matchDry(
  tumbleDry: WashSettings['tumble_dry'],
  appliances: Appliance[],
): ApplianceSuggestion[] {
  return appliances.filter(dries).map((appliance) => drySuggestion(tumbleDry, appliance));
}

/** ¿Alguna lavadora tiene un programa de estas categorías? */
export function anyWasherHas(appliances: Appliance[], categories: string[]): boolean {
  return appliances.some(
    (appliance) => washes(appliance) && findProgram(appliance, categories) !== null,
  );
}

/** Tipo de cuidado de una prenda (clave de CARE_CATEGORIES). */
export function careOf(label: Label, settings: Pick<WashSettings, 'cycle'>): Care {
  const isMostly = (name: string) =>
    label.fibers.some((fiber) => fiber.name === name && (fiber.percent ?? 100) >= 30);
  const garment = label.garment?.type ?? null;

  if (garment === 'down_jacket') return 'down';
  if (isMostly('silk')) return 'silk';
  if (isMostly('wool') || isMostly('cashmere')) return 'wool';
  if (settings.cycle === 'hand') return 'hand';
  if (settings.cycle === 'very_mild') return 'very_mild';
  if (settings.cycle === 'mild') return 'mild';
  if (garment === 'towel' || garment === 'bedding') return 'towels';
  return 'normal';
}

function washes(appliance: Appliance): boolean {
  return appliance.kind === 'washer' || appliance.kind === 'washer_dryer';
}

function dries(appliance: Appliance): boolean {
  return appliance.kind === 'dryer' || appliance.kind === 'washer_dryer';
}

function washSuggestion(care: Care, settings: Limits, appliance: Appliance): ApplianceSuggestion {
  const program = findProgram(appliance, CARE_CATEGORIES[care]);
  const maxTemp = Math.min(settings.max_temp, program?.max_temp ?? Infinity);
  const temperature = highestUpTo(appliance.temperatures, maxTemp);
  const spin = highestUpTo(appliance.spin_speeds, settings.max_spin);

  return {
    appliance_id: appliance.id,
    appliance_name: appliance.name,
    step: 'wash',
    program: program?.name ?? null,
    temperature,
    spin,
    message: program
      ? `Programa «${program.name}» a ${temperature ?? maxTemp}° y ${spin ?? settings.max_spin} rpm como máximo.`
      : `No encuentro un programa adecuado: usa uno delicado a ${maxTemp}° y ${settings.max_spin} rpm como máximo.`,
  };
}

function drySuggestion(
  tumbleDry: WashSettings['tumble_dry'],
  appliance: Appliance,
): ApplianceSuggestion {
  const base = {
    appliance_id: appliance.id,
    appliance_name: appliance.name,
    step: 'dry' as const,
    temperature: null,
    spin: null,
  };

  if (tumbleDry === 'none') {
    return { ...base, program: null, message: 'No la metas en la secadora.' };
  }

  const categories =
    tumbleDry === 'low'
      ? ['delicate', 'synthetic', 'wool', 'mixed']
      : ['cotton', 'mixed', 'synthetic'];
  const program = findProgram(appliance, categories);
  const heat = tumbleDry === 'low' ? 'a baja temperatura' : 'a temperatura normal';

  return {
    ...base,
    program: program?.name ?? null,
    message: program ? `Programa «${program.name}» ${heat}.` : `Sécala ${heat}.`,
  };
}

function findProgram(appliance: Appliance, categories: string[]): Program | null {
  for (const category of categories) {
    const program = appliance.programs.find((candidate) => categoryOf(candidate) === category);
    if (program) {
      return program;
    }
  }
  return null;
}

function highestUpTo(available: number[], limit: number): number | null {
  const allowed = available.filter((value) => value <= limit);
  return allowed.length ? Math.max(...allowed) : null;
}
