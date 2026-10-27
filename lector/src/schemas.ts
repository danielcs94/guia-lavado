/**
 * Qué tiene que devolver la IA al leer una etiqueta o el panel de un electrodoméstico.
 * Todos los campos obligatorios y sin propiedades extra (structured outputs).
 */

type Schema = Record<string, unknown>;

const object = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
const nullableEnum = (values: (string | number)[]): Schema => nullable({ type: 'string', enum: values });

const FIBERS = [
  'cotton', 'polyester', 'wool', 'silk', 'linen', 'viscose', 'elastane', 'polyamide',
  'acrylic', 'cashmere', 'leather', 'suede', 'down', 'modal', 'lyocell', 'other',
];

const GARMENTS = [
  'tshirt', 'shirt', 'sweater', 'trousers', 'jeans', 'dress', 'skirt', 'blazer', 'suit',
  'coat', 'down_jacket', 'underwear', 'sportswear', 'bedding', 'towel', 'other',
];

const CATEGORIES = [
  'cotton', 'synthetic', 'mixed', 'delicate', 'wool', 'hand_wash', 'silk', 'quick', 'eco',
  'bedding', 'down', 'sportswear', 'jeans', 'shirts', 'rinse_spin', 'drain', 'steam', 'other',
];

export const LABEL_PROMPT = `Eres un experto en etiquetas de cuidado textil (símbolos ISO 3758 / GINETEX).
Transcribe lo que indica la etiqueta de la foto.

Primero, en symbols, describe uno a uno los símbolos de izquierda a derecha: su forma, qué tiene dentro
(números, puntos, letras), cuántas rayas tiene debajo y si está tachado con una X. Una X encima significa "no".
Después rellena el resto de campos a partir de esa descripción.

- Rellena cada campo solo con lo que veas. Si un símbolo no aparece o no se distingue, usa null: no lo deduzcas del tejido.
- wash: barreño = method "machine"; mano dentro del barreño = "hand"; barreño tachado = "none".
  max_temp es el número dentro del barreño, o los puntos (1=30, 2=40, 3=50, 4=60, 5=70, 6=95).
  cycle: sin raya debajo = "normal", una raya = "mild", dos rayas = "very_mild".
- bleach: triángulo vacío = "any", triángulo con dos rayas = "oxygen_only", tachado = "none".
- tumble_dry (círculo dentro de un cuadrado): 1 punto = "low", 2 puntos = "normal", tachado = "none".
- natural_dry (cuadrado): línea curva arriba = "line", tres líneas verticales = "drip_line",
  una línea horizontal = "flat", dos líneas horizontales = "drip_flat".
- iron: 1 punto = "low", 2 = "medium", 3 = "high", tachada = "none".
- professional: P o F en un círculo = dry_clean; círculo tachado = dry_clean "none"; W en un círculo = wet_clean true.
- fibers: composición del tejido exterior; si hay relleno de plumas, añádelo como "down". Usa "other" si no está en la lista.
- garment: solo si la foto muestra la prenda; si solo se ve la etiqueta, null.
- notes: otras instrucciones escritas (p. ej. "lavar del revés"), traducidas al español.
- readable = false si la foto no es una etiqueta de ropa o no se puede leer. confidence: de 0 a 1, cuánto te fías de tu lectura.`;

export const LABEL_SCHEMA = object({
  symbols: { type: 'array', items: { type: 'string' } },
  readable: { type: 'boolean' },
  confidence: { type: 'number' },
  wash: nullable(
    object({
      method: nullableEnum(['machine', 'hand', 'none']),
      max_temp: nullable({ type: 'integer', enum: [30, 40, 50, 60, 70, 95] }),
      cycle: nullableEnum(['normal', 'mild', 'very_mild']),
    }),
  ),
  bleach: nullableEnum(['any', 'oxygen_only', 'none']),
  tumble_dry: nullableEnum(['normal', 'low', 'none']),
  natural_dry: nullableEnum(['line', 'drip_line', 'flat', 'drip_flat']),
  iron: nullableEnum(['high', 'medium', 'low', 'none']),
  professional: nullable(
    object({
      dry_clean: nullableEnum(['P', 'F', 'none']),
      wet_clean: nullable({ type: 'boolean' }),
    }),
  ),
  fibers: {
    type: 'array',
    items: object({
      name: { type: 'string', enum: FIBERS },
      percent: nullable({ type: 'integer' }),
    }),
  },
  garment: nullable(
    object({
      type: nullableEnum(GARMENTS),
      embellishments: { type: 'boolean' },
    }),
  ),
  notes: { type: 'array', items: { type: 'string' } },
});

export const APPLIANCE_PROMPT = `Lee el panel de mandos de la lavadora, secadora o lavadora-secadora de la foto.

- kind: "washer", "dryer" o "washer_dryer".
- brand y model: solo si aparecen en la foto; si no, null.
- programs: todos los programas del selector. name es el texto tal como aparece; si es solo un icono,
  ponle un nombre corto en español. category es el tipo de programa (usa "other" si no encaja).
  max_temp: la temperatura máxima del programa solo si el panel la indica; si no, null.
- temperatures: temperaturas seleccionables en °C (0 si hay opción de agua fría). Lista vacía si no se ven.
- spin_speeds: velocidades de centrifugado seleccionables en rpm. Lista vacía si no se ven.
- readable = false si la foto no es un panel de electrodoméstico o no se puede leer. confidence: de 0 a 1.`;

export const APPLIANCE_SCHEMA = object({
  readable: { type: 'boolean' },
  confidence: { type: 'number' },
  kind: { type: 'string', enum: ['washer', 'dryer', 'washer_dryer'] },
  brand: nullable({ type: 'string' }),
  model: nullable({ type: 'string' }),
  programs: {
    type: 'array',
    items: object({
      name: { type: 'string' },
      category: { type: 'string', enum: CATEGORIES },
      max_temp: nullable({ type: 'integer' }),
    }),
  },
  temperatures: { type: 'array', items: { type: 'integer' } },
  spin_speeds: { type: 'array', items: { type: 'integer' } },
});
