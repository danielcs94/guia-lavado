import { Appliance, Label } from '../core/laundry-api';
import { advise } from './advisor';
import { americana, camiseta, jerseyLana } from './fixtures';
import { guessCategory } from './program-category';
import { matchAppliances } from './program-matcher';

const washerDryer: Appliance = {
  id: 1,
  name: 'Lavadora-secadora de prueba',
  kind: 'washer_dryer',
  brand: null,
  model: null,
  programs: [
    { name: 'Algodón', category: 'cotton', max_temp: 90 },
    { name: 'Sintéticos', category: 'synthetic', max_temp: 60 },
    { name: 'Lana', category: 'wool', max_temp: 40 },
  ],
  temperatures: [0, 20, 30, 40, 60, 90],
  spin_speeds: [0, 400, 800, 1000, 1200, 1400],
};

function suggestionsFor(label: Label, appliances = [washerDryer]) {
  const advice = advise(label);
  return advice.needs_retake ? [] : matchAppliances(label, advice.settings, appliances);
}

describe('matchAppliances', () => {
  it('camiseta de algodón: programa algodón con los límites de la etiqueta', () => {
    const [wash, dry] = suggestionsFor(camiseta());
    expect(wash.program).toBe('Algodón');
    expect(wash.temperature).toBe(40);
    expect(wash.spin).toBe(1200);
    expect(dry.program).toBe('Sintéticos');
  });

  it('jersey de lana: programa lana y nada de secadora', () => {
    const [wash, dry] = suggestionsFor(jerseyLana());
    expect(wash.program).toBe('Lana');
    expect(wash.temperature).toBe(30);
    expect(wash.spin).toBe(400);
    expect(dry.program).toBeNull();
    expect(dry.message).toBe('No la metas en la secadora.');
  });

  it('lo que va a la tintorería no tiene sugerencias', () => {
    expect(suggestionsFor(americana())).toEqual([]);
  });

  it('deduce la categoría por el nombre cuando la lectura dice «other»', () => {
    const whirlpool: Appliance = {
      ...washerDryer,
      name: 'Whirlpool',
      kind: 'washer',
      programs: [
        { name: 'Eco 40-60', category: 'other', max_temp: null },
        { name: 'Algodón', category: 'other', max_temp: null },
        { name: 'Lana', category: 'other', max_temp: null },
      ],
      temperatures: [],
      spin_speeds: [],
    };

    const [wash] = suggestionsFor(jerseyLana(), [whirlpool]);
    expect(wash.program).toBe('Lana');
    expect(wash.message).toBe('Programa «Lana» a 30° y 400 rpm como máximo.');
  });

  it('adivina categorías aunque lleven tildes', () => {
    expect(guessCategory('Eco 40-60')).toBe('eco');
    expect(guessCategory('SINTÉTICOS')).toBe('synthetic');
    expect(guessCategory('Edredón')).toBe('bedding');
    expect(guessCategory('Turbo')).toBe('other');
  });
});
