import { Appliance, ClothColor, Label, PlanItem } from '../core/laundry-api';
import { americana, borrosa, camiseta, jerseyLana } from './fixtures';
import { planLoads } from './load-planner';

const washer: Appliance = {
  id: 1,
  name: 'Lavadora',
  kind: 'washer',
  brand: null,
  model: null,
  programs: [
    { name: 'Algodón', category: 'cotton', max_temp: 90 },
    { name: 'Lana', category: 'wool', max_temp: 40 },
  ],
  temperatures: [20, 30, 40, 60, 90],
  spin_speeds: [400, 800, 1200],
};

function item(id: string, label: Label, color: ClothColor): PlanItem {
  return { id, label, color, garment_type: null };
}

function withGarment(type: NonNullable<Label['garment']>['type'], maxTemp?: number): Label {
  const label = camiseta();
  label.garment!.type = type;
  if (maxTemp) label.wash!.max_temp = maxTemp;
  return label;
}

function many(prefix: string, count: number, label: Label, color: ClothColor): PlanItem[] {
  return Array.from({ length: count }, (_, i) => item(`${prefix}${i + 1}`, label, color));
}

describe('planLoads', () => {
  it('separa la ropa clara de la oscura', () => {
    const plan = planLoads(
      [
        item('blanca', camiseta(), 'white'),
        item('gris', camiseta(), 'light'),
        item('negra', camiseta(), 'dark'),
      ],
      [],
    );
    expect(plan.loads).toHaveLength(2);
    expect(plan.loads[0].item_ids).toEqual(['blanca', 'gris']);
    expect(plan.loads[0].title).toBe('Ropa blanca y clara');
    expect(plan.loads[1].item_ids).toEqual(['negra']);
  });

  it('cada lavadora usa los ajustes de su prenda más delicada', () => {
    const synthetic = camiseta();
    synthetic.wash = { method: 'machine', max_temp: 30, cycle: 'mild' };

    const plan = planLoads(
      [item('algodon', camiseta(), 'dark'), item('sintetica', synthetic, 'dark')],
      [],
    );

    expect(plan.loads).toHaveLength(1);
    expect(plan.loads[0].settings).toEqual({
      cycle: 'mild',
      max_temp: 30,
      max_spin: 800,
      bleach: 'none',
    });
  });

  it('la lana va a una colada delicada con programa lana', () => {
    const plan = planLoads(
      [item('camiseta', camiseta(), 'dark'), item('jersey', jerseyLana(), 'dark')],
      [washer],
    );

    expect(plan.loads[0].kind).toBe('normal');
    expect(plan.loads[1].kind).toBe('delicate');
    expect(plan.loads[1].wash[0].program).toBe('Lana');
    expect(plan.loads[1].air_dry.map((dry) => dry.id)).toEqual(['jersey']);
  });

  it('a mano si la lavadora no tiene programa de lana', () => {
    const onlyCotton = {
      ...washer,
      programs: [{ name: 'Algodón', category: 'cotton', max_temp: 90 }],
    };

    const plan = planLoads([item('jersey', jerseyLana(), 'dark')], [onlyCotton]);

    expect(plan.loads).toEqual([]);
    expect(plan.hand_wash[0].id).toBe('jersey');
  });

  it('lo de tintorería y lo que no se lee se queda fuera', () => {
    const plan = planLoads(
      [item('americana', americana(), 'dark'), item('borrosa', borrosa(), 'dark')],
      [],
    );

    expect(plan.loads).toEqual([]);
    expect(plan.dry_clean[0].id).toBe('americana');
    expect(plan.dry_clean[0].reasons).toEqual([
      'La etiqueta prohíbe lavar con agua y pide limpieza profesional.',
      'Tiene estructura interna (entretelas, hombreras) que se deforma en la lavadora.',
    ]);
    expect(plan.needs_retake).toEqual(['borrosa']);
    expect(plan.summary).toBe('2 prendas: Ninguna lavadora, 1 a la tintorería, 1 sin leer.');
  });

  it('parte la colada si no cabe', () => {
    const plan = planLoads(many('vaquero-', 12, withGarment('jeans'), 'dark'), []);

    expect(plan.loads).toHaveLength(2);
    expect(plan.loads[0].weight_kg).toBeLessThanOrEqual(7);
    expect(plan.loads[0].item_ids.length + plan.loads[1].item_ids.length).toBe(12);
  });

  it('pocas toallas van con el resto y muchas van aparte', () => {
    const towel = withGarment('towel', 60);

    const few = planLoads([item('camiseta', camiseta(), 'white'), item('t1', towel, 'white')], []);
    expect(few.loads).toHaveLength(1);
    expect(few.loads[0].settings.max_temp).toBe(40);

    const lots = planLoads(
      [...many('v', 4, withGarment('jeans'), 'white'), ...many('t', 4, towel, 'white')],
      [],
    );
    expect(lots.loads).toHaveLength(2);
    expect(lots.loads[1].kind).toBe('towels');
    expect(lots.loads[1].settings.max_temp).toBe(60);
  });

  it('muchas toallas se juntan con una colada casi vacía en vez de hacer dos pequeñas', () => {
    const plan = planLoads(
      [item('camiseta', camiseta(), 'white'), ...many('t', 4, withGarment('towel', 60), 'white')],
      [],
    );

    expect(plan.loads).toHaveLength(1);
    expect(plan.loads[0].kind).toBe('normal');
  });

  it('avisa cuando la lavadora va medio vacía', () => {
    const plan = planLoads([item('camiseta', camiseta(), 'dark')], []);
    expect(plan.loads[0].tips[0]).toContain('medio vacía');
  });
});
