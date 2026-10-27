import { advise } from './advisor';
import { americana, borrosa, camiseta, jerseyLana } from './fixtures';

function verdictOf(label: ReturnType<typeof camiseta>) {
  const advice = advise(label);
  return advice.needs_retake ? null : advice.verdict;
}

describe('advise', () => {
  it.each([
    ['camiseta de algodón', camiseta, 'Home'],
    ['jersey de lana', jerseyLana, 'HomeCareful'],
    ['americana', americana, 'DryCleanRequired'],
  ])('da el veredicto correcto: %s', (_, fixture, verdict) => {
    expect(verdictOf(fixture())).toBe(verdict);
  });

  it('pide otra foto si no se lee la etiqueta', () => {
    expect(advise(borrosa()).needs_retake).toBe(true);
  });

  it('no da ajustes de lavado si es tintorería obligatoria', () => {
    const advice = advise(americana());
    expect(!advice.needs_retake && advice.settings).toBeNull();
  });

  it('un adorno de cuero obliga a tintorería especializada', () => {
    const label = camiseta();
    label.fibers.push({ name: 'leather', percent: 5 });
    expect(verdictOf(label)).toBe('DryCleanRequired');
  });

  it('un poco de lana no la hace delicada', () => {
    const label = camiseta();
    label.fibers = [
      { name: 'cotton', percent: 90 },
      { name: 'wool', percent: 10 },
    ];
    expect(verdictOf(label)).toBe('Home');
  });

  it('seda sin instrucciones de lavado va a la tintorería', () => {
    const label = camiseta();
    label.wash = { method: null, max_temp: null, cycle: null };
    label.fibers = [{ name: 'silk', percent: 100 }];
    expect(verdictOf(label)).toBe('DryCleanRecommended');
  });

  it('si faltan símbolos elige lo más seguro', () => {
    const label = camiseta();
    label.wash!.max_temp = null;
    label.tumble_dry = null;

    const advice = advise(label);
    if (advice.needs_retake) throw new Error('debería leerse');

    expect(advice.settings!.max_temp).toBe(30);
    expect(advice.settings!.tumble_dry).toBe('none');
    expect(advice.tips[0]).toContain('temperatura, secadora');
  });
});
