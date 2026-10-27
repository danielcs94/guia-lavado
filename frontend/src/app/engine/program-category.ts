import { Program } from '../core/laundry-api';

/** Por orden: el primero que coincide gana («Eco 40-60» es eco, no algodón). */
const KEYWORDS: [string, string[]][] = [
  ['rinse_spin', ['aclar', 'rinse']],
  ['drain', ['desag', 'centrif', 'drain', 'spin']],
  ['eco', ['eco']],
  ['quick', ['rapid', 'quick', 'express', 'mini']],
  ['down', ['plum', 'down']],
  ['bedding', ['edred', 'cama', 'sabana', 'duvet', 'bedding']],
  ['silk', ['seda', 'silk']],
  ['wool', ['lana', 'wool']],
  ['hand_wash', ['mano', 'hand']],
  ['delicate', ['delicad', 'delicate', 'fino']],
  ['synthetic', ['sintet', 'synthetic']],
  ['mixed', ['variad', 'mixt', 'mix']],
  ['sportswear', ['deport', 'sport']],
  ['jeans', ['vaquer', 'jean', 'denim']],
  ['shirts', ['camisa', 'shirt']],
  ['steam', ['vapor', 'steam']],
  ['cotton', ['algod', 'cotton']],
];

/**
 * Deduce la categoría de un programa por su nombre, para cuando la IA
 * lee bien el panel pero no sabe clasificar los programas.
 */
export function guessCategory(name: string): string {
  const plain = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return KEYWORDS.find(([, words]) => words.some((word) => plain.includes(word)))?.[0] ?? 'other';
}

export function categoryOf(program: Program): string {
  return program.category === 'other' ? guessCategory(program.name) : program.category;
}
