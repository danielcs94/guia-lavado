import {
  Appliance,
  ClothColor,
  LoadPlan,
  PlanItem,
  WashLoad,
  WashSettings,
} from '../core/laundry-api';
import { LabelAdvice, advise } from './advisor';
import { Care, anyWasherHas, careOf, matchDry, matchWash } from './program-matcher';

type Kind = WashLoad['kind'];
type Tone = WashLoad['tone'];

interface Piece {
  id: string;
  color: ClothColor;
  care: Care;
  settings: WashSettings;
  weight: number;
}

/** Lo que pesa en seco cada prenda, aproximadamente (kg). */
const WEIGHTS: Record<string, number> = {
  tshirt: 0.2,
  shirt: 0.25,
  sweater: 0.5,
  trousers: 0.5,
  jeans: 0.7,
  dress: 0.35,
  skirt: 0.3,
  blazer: 0.8,
  suit: 1.2,
  coat: 1.5,
  down_jacket: 0.9,
  underwear: 0.08,
  sportswear: 0.25,
  bedding: 1.0,
  towel: 0.6,
  other: 0.4,
};

/** Carga máxima por tipo de colada (kg), pensando en una lavadora normal de 7 kg. */
const CAPACITY: Record<Kind, number> = { normal: 7, towels: 7, delicate: 2.5, down: 2 };

/** Por debajo de esta parte de la capacidad la colada se considera pequeña. */
const SMALL_FILL = 0.35;

/** Kilos de toallas y sábanas a partir de los que merece la pena lavarlas aparte. */
const MIN_TOWEL_LOAD = 2;

/** Temperatura que basta para la ropa del día a día. */
const EVERYDAY_TEMP = 40;

const CARE_ORDER: Care[] = [
  'down',
  'silk',
  'wool',
  'hand',
  'very_mild',
  'mild',
  'towels',
  'normal',
];
const CYCLE_ORDER: WashSettings['cycle'][] = ['hand', 'very_mild', 'mild', 'normal'];
const BLEACH_ORDER: WashSettings['bleach'][] = ['none', 'oxygen_only', 'any'];
const GROUP_ORDER = [
  'normal-light',
  'normal-dark',
  'towels-light',
  'towels-dark',
  'delicate-light',
  'delicate-dark',
  'down-light',
  'down-dark',
];

/**
 * Reparte un montón de ropa en el menor número de lavadoras posible
 * sin juntar lo que no se debe juntar (colores, tejidos delicados, toallas).
 */
export function planLoads(
  items: PlanItem[],
  appliances: Appliance[],
): LoadPlan & { advice: Record<string, LabelAdvice> } {
  const handInMachine =
    appliances.length === 0 || anyWasherHas(appliances, ['hand_wash', 'wool', 'silk']);

  const advice: Record<string, LabelAdvice> = {};
  const retake: string[] = [];
  const dryClean: LoadPlan['dry_clean'] = [];
  const handWash: LoadPlan['hand_wash'] = [];
  let groups: Record<string, Piece[]> = {};

  for (const item of items) {
    const result = advise(item.label);
    advice[item.id] = result;

    if (result.needs_retake) {
      retake.push(item.id);
      continue;
    }

    const settings = result.settings;
    if (settings === null || result.verdict === 'DryCleanRecommended') {
      dryClean.push({
        id: item.id,
        required: settings === null,
        reasons: result.dry_clean_reasons,
      });
      continue;
    }

    const care = careOf(item.label, settings);
    if (settings.cycle === 'hand' && !handInMachine) {
      handWash.push({ id: item.id, max_temp: settings.max_temp });
      continue;
    }

    const kind: Kind =
      care === 'down'
        ? 'down'
        : ['silk', 'wool', 'hand', 'very_mild'].includes(care)
          ? 'delicate'
          : care === 'towels'
            ? 'towels'
            : 'normal';
    const tone: Tone = item.color === 'white' || item.color === 'light' ? 'light' : 'dark';

    (groups[`${kind}-${tone}`] ??= []).push({
      id: item.id,
      color: item.color,
      care,
      settings,
      weight: WEIGHTS[item.label.garment?.type ?? 'other'] ?? WEIGHTS['other'],
    });
  }

  groups = mergeSmallTowelGroups(groups);

  const loads = GROUP_ORDER.filter((key) => groups[key]?.length).flatMap((key) => {
    const [kind, tone] = key.split('-') as [Kind, Tone];
    return split(groups[key], CAPACITY[kind]).map((part) => load(kind, tone, part, appliances));
  });

  return {
    loads,
    hand_wash: handWash,
    dry_clean: dryClean,
    needs_retake: retake,
    advice,
    summary: summary(items.length, loads.length, handWash.length, dryClean.length, retake.length),
  };
}

/**
 * Toallas aparte solo si compensa: si hay pocas, o si el resto de la ropa de ese
 * color no llena ni media lavadora, va todo junto.
 */
function mergeSmallTowelGroups(groups: Record<string, Piece[]>): Record<string, Piece[]> {
  for (const tone of ['light', 'dark']) {
    const towels = groups[`towels-${tone}`] ?? [];
    const others = groups[`normal-${tone}`] ?? [];
    const othersFill = sumWeight(others) / CAPACITY.normal;
    const fewTowels = sumWeight(towels) < MIN_TOWEL_LOAD;

    if (towels.length && (fewTowels || (others.length && othersFill < SMALL_FILL))) {
      groups[`normal-${tone}`] = [...others, ...towels];
      delete groups[`towels-${tone}`];
    }
  }
  return groups;
}

/** Reparte las prendas en lavadoras que no pasen de la capacidad (primero las más pesadas). */
function split(group: Piece[], capacity: number): Piece[][] {
  const parts: Piece[][] = [];
  for (const item of [...group].sort((a, b) => b.weight - a.weight)) {
    const part = parts.find((candidate) => sumWeight(candidate) + item.weight <= capacity);
    if (part) {
      part.push(item);
    } else {
      parts.push([item]);
    }
  }
  return parts;
}

function load(kind: Kind, tone: Tone, items: Piece[], appliances: Appliance[]): WashLoad {
  const care = strictest(
    items.map((item) => item.care),
    CARE_ORDER,
  );
  const all = items.map((item) => item.settings);
  const maxTemp = Math.min(...all.map((settings) => settings.max_temp));
  const temperature = kind === 'towels' ? Math.min(maxTemp, 60) : Math.min(maxTemp, EVERYDAY_TEMP);

  const settings: WashLoad['settings'] = {
    cycle: strictest(
      all.map((s) => s.cycle),
      CYCLE_ORDER,
    ),
    max_temp: temperature,
    max_spin: Math.min(...all.map((s) => s.max_spin)),
    bleach: strictest(
      all.map((s) => s.bleach),
      BLEACH_ORDER,
    ),
  };

  const weight = sumWeight(items);
  const capacity = CAPACITY[kind];

  const dryer = items.filter((item) => item.settings.tumble_dry !== 'none');
  const airDry = items.filter((item) => item.settings.tumble_dry === 'none');
  const tumbleDry: WashSettings['tumble_dry'] = dryer.length
    ? dryer.some((item) => item.settings.tumble_dry === 'low')
      ? 'low'
      : 'normal'
    : 'none';

  return {
    title: title(kind, tone),
    kind,
    tone,
    item_ids: items.map((item) => item.id),
    weight_kg: Math.round(weight * 10) / 10,
    capacity_kg: capacity,
    fill: Math.round(Math.min(weight / capacity, 1) * 100) / 100,
    settings,
    wash: matchWash(care, settings, appliances),
    dryer_ids: dryer.map((item) => item.id),
    air_dry: airDry.map((item) => ({ id: item.id, natural_dry: item.settings.natural_dry })),
    dry: dryer.length ? matchDry(tumbleDry, appliances) : [],
    tumble_dry: tumbleDry,
    tips: tips(kind, tone, items, settings, maxTemp, weight / capacity),
  };
}

function tips(
  kind: Kind,
  tone: Tone,
  items: Piece[],
  settings: WashLoad['settings'],
  labelMaxTemp: number,
  fill: number,
): string[] {
  const tips: string[] = [];
  const colors = [...new Set(items.map((item) => item.color))];

  if (fill < SMALL_FILL) {
    tips.push(
      kind === 'delicate' && items.length <= 2
        ? 'Son muy pocas prendas: a mano gastas menos agua y luz que poniendo la lavadora.'
        : 'Va medio vacía: si no corre prisa, espera a juntar más ropa de este tipo, o usa un programa rápido o de media carga.',
    );
  }

  if (kind === 'normal' && labelMaxTemp > EVERYDAY_TEMP) {
    tips.push('A 40° basta para la ropa del día a día y gastas mucha menos luz que a 60°.');
  }

  if (kind === 'normal' && items.some((item) => item.care === 'towels')) {
    tips.push('Las toallas sueltan pelusa: si te importa, lávalas aparte cuando tengas más.');
  }

  if (
    tone === 'light' &&
    colors.length === 1 &&
    colors[0] === 'white' &&
    settings.bleach !== 'none'
  ) {
    tips.push(
      settings.bleach === 'any'
        ? 'Si quieres blanquear, todas admiten lejía.'
        : 'Si quieres blanquear, usa blanqueante con oxígeno activo (sin cloro).',
    );
  }

  if (tone === 'light' && colors.length > 1) {
    tips.push('Juntas blancos con claros: añade una toallita atrapacolor por si acaso.');
  }

  if (tone === 'dark') {
    tips.push('Dale la vuelta a la ropa oscura para que los colores aguanten más.');
  }

  if (kind === 'delicate') {
    tips.push('Usa detergente para delicados o lana, y una bolsa de red si tienes.');
  }

  if (kind === 'down') {
    tips.push('Pon un aclarado extra para que no queden restos de jabón en el plumón.');
  }

  return tips;
}

function strictest<T>(values: T[], order: T[]): T {
  return order.find((value) => values.includes(value)) ?? order[order.length - 1];
}

function sumWeight(items: Piece[]): number {
  return items.reduce((total, item) => total + item.weight, 0);
}

function title(kind: Kind, tone: Tone): string {
  const light = tone === 'light';
  switch (kind) {
    case 'normal':
      return light ? 'Ropa blanca y clara' : 'Ropa oscura y de color';
    case 'towels':
      return light ? 'Toallas y sábanas claras' : 'Toallas y sábanas oscuras';
    case 'delicate':
      return light ? 'Delicada clara' : 'Delicada oscura';
    case 'down':
      return light ? 'Plumíferos claros' : 'Plumíferos oscuros';
  }
}

function summary(
  items: number,
  loads: number,
  hand: number,
  dryClean: number,
  retake: number,
): string {
  const parts = [
    loads === 0 ? 'Ninguna lavadora' : loads === 1 ? '1 lavadora' : `${loads} lavadoras`,
  ];
  if (hand) {
    parts.push(hand === 1 ? '1 prenda a mano' : `${hand} prendas a mano`);
  }
  if (dryClean) {
    parts.push(dryClean === 1 ? '1 a la tintorería' : `${dryClean} a la tintorería`);
  }
  if (retake) {
    parts.push(retake === 1 ? '1 sin leer' : `${retake} sin leer`);
  }

  return `${items === 1 ? '1 prenda' : `${items} prendas`}: ${parts.join(', ')}.`;
}
