import { Label, Verdict, WashSettings } from '../core/laundry-api';

const MIN_CONFIDENCE = 0.6;
const MIN_DELICATE_PERCENT = 30;
const DELICATE_FIBERS = ['wool', 'silk', 'cashmere'];
const SPECIALIST_FIBERS = ['leather', 'suede'];
const STRUCTURED_GARMENTS = ['blazer', 'suit', 'coat'];

/** De menos a más grave. */
const VERDICTS: Verdict[] = ['Home', 'HomeCareful', 'DryCleanRecommended', 'DryCleanRequired'];

const VERDICT_LABELS: Record<Verdict, string> = {
  Home: 'Lavar en casa',
  HomeCareful: 'Lavar en casa con cuidado',
  DryCleanRecommended: 'Mejor llevar a la tintorería',
  DryCleanRequired: 'Tintorería obligatoria',
};

const FIBER_NAMES: Record<string, string> = {
  wool: 'lana',
  silk: 'seda',
  cashmere: 'cachemir',
  leather: 'cuero',
  suede: 'ante',
};

const SPIN: Record<WashSettings['cycle'], number> = {
  normal: 1200,
  mild: 800,
  very_mild: 600,
  hand: 400,
};

export type LabelAdvice =
  | { needs_retake: true; message: string }
  | {
      needs_retake: false;
      verdict: Verdict;
      verdict_label: string;
      reasons: string[];
      dry_clean_reasons: string[];
      settings: WashSettings | null;
      tips: string[];
    };

/**
 * Reglas de lavado: decide si una prenda se lava en casa, con cuidado o en la
 * tintorería, y con qué ajustes. La IA solo lee la etiqueta; esto decide.
 */
export function advise(label: Label): LabelAdvice {
  if (!label.readable || (label.confidence ?? 0) < MIN_CONFIDENCE) {
    return {
      needs_retake: true,
      message: 'No se lee bien la etiqueta. Haz otra foto más cerca y con más luz.',
    };
  }

  let verdict: Verdict = 'Home';
  const reasons: string[] = [];
  const dryCleanReasons: string[] = [];
  const tips: string[] = [];

  const raise = (level: Verdict, reason: string) => {
    if (rank(level) > rank(verdict)) {
      verdict = level;
    }
    reasons.push(reason);
    if (rank(level) >= rank('DryCleanRecommended')) {
      dryCleanReasons.push(reason);
    }
  };

  const method = label.wash?.method ?? null;

  // Símbolos de lavado
  if (method === 'none') {
    const dryClean = label.professional?.dry_clean;
    if (dryClean === 'P' || dryClean === 'F' || label.professional?.wet_clean === true) {
      raise('DryCleanRequired', 'La etiqueta prohíbe lavar con agua y pide limpieza profesional.');
    } else {
      raise('DryCleanRecommended', 'La etiqueta prohíbe lavar con agua.');
    }
  } else if (method === 'hand') {
    raise('HomeCareful', 'Solo admite lavado a mano.');
    tips.push('Si tu lavadora tiene programa "lana" o "lavado a mano", puedes usarlo.');
  } else if (label.wash?.cycle === 'very_mild') {
    raise('HomeCareful', 'Pide un programa muy delicado.');
  }

  // Tejidos
  for (const fiber of label.fibers ?? []) {
    const percent = fiber.percent ?? 100;

    if (SPECIALIST_FIBERS.includes(fiber.name)) {
      raise(
        'DryCleanRequired',
        `Contiene ${fiberName(fiber.name)}: necesita una tintorería especializada.`,
      );
      continue;
    }
    if (
      !DELICATE_FIBERS.includes(fiber.name) ||
      percent < MIN_DELICATE_PERCENT ||
      method === 'none'
    ) {
      continue;
    }
    if (method === null) {
      raise(
        'DryCleanRecommended',
        `Es ${percent}% ${fiberName(fiber.name)} y la etiqueta no dice cómo lavarla.`,
      );
    } else {
      raise(
        'HomeCareful',
        `Es ${percent}% ${fiberName(fiber.name)}: usa el programa de lana o delicado.`,
      );
      tips.push('Usa detergente para lana o prendas delicadas.');
    }
  }

  // Tipo de prenda
  const type = label.garment?.type ?? null;
  if (type !== null && STRUCTURED_GARMENTS.includes(type)) {
    raise(
      'DryCleanRecommended',
      'Tiene estructura interna (entretelas, hombreras) que se deforma en la lavadora.',
    );
  }
  if (type === 'down_jacket') {
    raise('HomeCareful', 'Es de plumas: necesita aclarado extra y secado lento.');
    if ((label.tumble_dry ?? 'none') !== 'none') {
      tips.push(
        'Sécala a baja temperatura con 2-3 pelotas de tenis para que no se apelmace el plumón.',
      );
    }
  }
  if (label.garment?.embellishments) {
    raise('HomeCareful', 'Tiene adornos (lentejuelas, pedrería, estampados).');
    tips.push('Lávala del revés y dentro de una bolsa de red.');
  }

  const settings = washSettings(label, verdict, tips);

  return {
    needs_retake: false,
    verdict,
    verdict_label: VERDICT_LABELS[verdict],
    reasons,
    dry_clean_reasons: dryCleanReasons,
    settings,
    tips: [...new Set(tips)],
  };
}

export function rank(verdict: Verdict): number {
  return VERDICTS.indexOf(verdict);
}

function washSettings(label: Label, verdict: Verdict, tips: string[]): WashSettings | null {
  const wash = label.wash;
  const method = wash?.method ?? null;

  if (method === 'none' || verdict === 'DryCleanRequired') {
    return null;
  }

  const missing = Object.entries({
    temperatura: wash?.max_temp,
    lejía: label.bleach,
    secadora: label.tumble_dry,
    plancha: label.iron,
  })
    .filter(([, value]) => value === null || value === undefined)
    .map(([name]) => name);
  if (missing.length) {
    tips.push(`La etiqueta no indica ${missing.join(', ')}: he elegido la opción más segura.`);
  }

  const careful = rank(verdict) >= rank('HomeCareful');
  const cycle: WashSettings['cycle'] =
    method === 'hand' ? 'hand' : (wash?.cycle ?? (careful ? 'mild' : 'normal'));

  return {
    method: method ?? 'machine',
    cycle,
    max_temp: wash?.max_temp ?? 30,
    max_spin: SPIN[cycle],
    bleach: label.bleach ?? 'none',
    tumble_dry: label.tumble_dry ?? 'none',
    natural_dry: label.natural_dry ?? null,
    iron: label.iron ?? 'low',
  };
}

function fiberName(fiber: string): string {
  return FIBER_NAMES[fiber] ?? fiber;
}
