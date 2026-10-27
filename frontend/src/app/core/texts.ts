import { GarmentType, WashSettings } from './laundry-api';

export const GARMENTS: Record<GarmentType, string> = {
  tshirt: 'Camiseta',
  shirt: 'Camisa',
  sweater: 'Jersey',
  trousers: 'Pantalón',
  jeans: 'Vaqueros',
  dress: 'Vestido',
  skirt: 'Falda',
  blazer: 'Americana',
  suit: 'Traje',
  coat: 'Abrigo',
  down_jacket: 'Plumífero',
  underwear: 'Ropa interior',
  sportswear: 'Ropa de deporte',
  bedding: 'Ropa de cama',
  towel: 'Toalla',
  other: 'Otra',
};

export const FIBERS: Record<string, string> = {
  cotton: 'algodón',
  polyester: 'poliéster',
  wool: 'lana',
  silk: 'seda',
  linen: 'lino',
  viscose: 'viscosa',
  elastane: 'elastano',
  polyamide: 'poliamida',
  acrylic: 'acrílico',
  cashmere: 'cachemir',
  leather: 'cuero',
  suede: 'ante',
  down: 'plumón',
  modal: 'modal',
  lyocell: 'lyocell',
  other: 'otro',
};

export const CYCLES: Record<WashSettings['cycle'], string> = {
  normal: 'Programa normal',
  mild: 'Programa suave',
  very_mild: 'Programa muy delicado',
  hand: 'A mano (o programa lana / lavado a mano)',
};

export const BLEACH: Record<WashSettings['bleach'], string> = {
  any: 'Se puede usar',
  oxygen_only: 'Solo sin cloro (oxígeno activo)',
  none: 'No',
};

export const TUMBLE_DRY: Record<WashSettings['tumble_dry'], string> = {
  normal: 'Sí, temperatura normal',
  low: 'Sí, a baja temperatura',
  none: 'No',
};

export const NATURAL_DRY: Record<NonNullable<WashSettings['natural_dry']>, string> = {
  line: 'Tendida',
  drip_line: 'Tendida, sin escurrir',
  flat: 'En horizontal',
  drip_flat: 'En horizontal, sin escurrir',
};

export const IRON: Record<WashSettings['iron'], string> = {
  high: 'Alta (hasta 200°)',
  medium: 'Media (hasta 150°)',
  low: 'Baja (hasta 110°)',
  none: 'No planchar',
};

export const APPLIANCE_KINDS: Record<string, string> = {
  washer: 'Lavadora',
  dryer: 'Secadora',
  washer_dryer: 'Lavadora-secadora',
};

export const PROGRAM_CATEGORIES: Record<string, string> = {
  cotton: 'Algodón',
  synthetic: 'Sintéticos',
  mixed: 'Mixto',
  delicate: 'Delicado',
  wool: 'Lana',
  hand_wash: 'Lavado a mano',
  silk: 'Seda',
  quick: 'Rápido',
  eco: 'Eco',
  bedding: 'Ropa de cama',
  down: 'Plumas',
  sportswear: 'Deporte',
  jeans: 'Vaqueros',
  shirts: 'Camisas',
  rinse_spin: 'Aclarado y centrifugado',
  drain: 'Desagüe',
  steam: 'Vapor',
  other: 'Otro',
};
