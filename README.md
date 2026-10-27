# Guía de lavado

Haces una foto a la etiqueta de una prenda (o marcas tú los símbolos) y te dice cómo lavarla con **tu** lavadora y secadora, o si es mejor llevarla a la tintorería.

- Una IA de visión solo **lee** las fotos: la etiqueta (símbolos ISO 3758 y composición) y el panel de los electrodomésticos. Por defecto es un modelo que se ejecuta en el propio Mac con [Ollama](https://ollama.com), así que es gratis.
- Todo lo que lee la IA se puede **corregir a mano**, y también se puede usar sin foto: marcando los símbolos y metiendo los programas de la lavadora.
- **Modo colada**: haces foto a la etiqueta de varias prendas, marcas su color y te dice en cuántas lavadoras repartirlas, con qué programa, qué va a la secadora, qué se tiende y qué va a mano o a la tintorería.
- Las **decisiones** las toma un motor de reglas propio ([`LaundryAdvisor`](backend/app/Laundry/LaundryAdvisor.php)), así que las recomendaciones son coherentes y explicables.

## Arrancarlo todo

```bash
./arrancar.sh
```

Arranca Ollama, el backend (8001) y el frontend (4300), y te dice la dirección para abrirlo en el iPhone. Ctrl+C lo para todo.

## Backend (Laravel)

```bash
cd backend
cp .env.example .env   # solo la primera vez
php artisan key:generate
php artisan migrate
```

### IA para leer las fotos

**Gratis, en el Mac (por defecto):**

```bash
brew install ollama
ollama serve                         # déjalo abierto en una terminal
ollama pull qwen3-vl:8b-instruct     # unos 6 GB, solo la primera vez
```

Tarda unos 10-25 segundos por foto y acierta casi todo, pero a veces se le escapa algún detalle (las rayas bajo el barreño, los puntos de la plancha): revisa los símbolos y corrígelos si hace falta.

**De pago, con Claude (más preciso):** en `backend/.env` pon `LAUNDRY_VISION=claude` y tu clave en `ANTHROPIC_API_KEY`.

### Probar con fotos reales desde la terminal

```bash
php artisan lavado:etiqueta ~/Desktop/etiqueta.jpg
php artisan lavado:panel ~/Desktop/lavadora.jpg
```

### Arrancar la API

```bash
php artisan serve --host=0.0.0.0 --port=8001
```

(Puerto 8001 para no chocar con Madrid No Descansa, que usa el 8000.)

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/labels/scan` | `photo` (+ `garment_type` opcional) → lectura de la etiqueta y recomendación |
| `POST` | `/api/labels/advice` | `label` ya leída (+ `garment_type`) → recalcula la recomendación sin gastar IA |
| `POST` | `/api/loads/plan` | `items` (`id`, `label`, `color`: white/light/dark/color, `garment_type` opcional) → coladas |
| `GET` | `/api/appliances` | Electrodomésticos guardados |
| `POST` | `/api/appliances` | Alta manual (nombre, tipo, programas, temperaturas, centrifugados) |
| `POST` | `/api/appliances/scan` | `photo` del panel (+ `name` opcional) → lee los programas y lo guarda |
| `PUT` | `/api/appliances/{id}` | Corrige un electrodoméstico |
| `DELETE` | `/api/appliances/{id}` | Borra un electrodoméstico |

### Cómo se reparte la colada

[`LoadPlanner`](backend/app/Laundry/LoadPlanner.php) pasa cada prenda por el motor de reglas y luego:

1. Saca lo que va a la tintorería, lo que no se ha podido leer y lo que es solo a mano (si tu lavadora no tiene programa de lana o lavado a mano).
2. Separa claros (blanco y claro) de oscuros (oscuro y de color), y dentro de cada uno: normal, delicada (lana, seda, a mano, muy delicado), plumíferos, y toallas y sábanas si hay al menos 2 kg (si no, van con el resto).
3. Cada lavadora usa los ajustes de la prenda más delicada que lleva, con 40° como máximo para la ropa normal (60° para toallas).
4. Si una colada no cabe (7 kg normal, 2,5 kg delicada, 2 kg plumíferos, con un peso aproximado por tipo de prenda), la parte en varias.
5. Dice qué prendas pueden ir a la secadora y cuáles hay que sacar antes y tender, y avisa cuando una lavadora va medio vacía.

Si la IA lee los programas del panel pero no sabe clasificarlos, la categoría se deduce del nombre ([`ProgramCategory`](backend/app/Laundry/ProgramCategory.php)): «Lana» → lana, «Eco 40-60» → eco…

Si hay electrodomésticos guardados, la recomendación incluye en `advice.appliances` el programa, la temperatura y el centrifugado concretos para cada uno.

### Tests

```bash
php artisan test
```

Los tests no llaman a la IA: usan lecturas de ejemplo de `tests/Fixtures/labels`.

## Frontend (Angular, PWA)

```bash
cd frontend
npm install   # usa legacy-peer-deps (está en .npmrc) por un fallo de npm 10 con las dependencias peer
npx ng serve  # http://localhost:4300, con el backend en marcha en el 8001
```

`ng serve` redirige `/api` al backend (`proxy.conf.json`), así que no hace falta CORS.

### En el iPhone

1. El Mac y el iPhone en la misma wifi, con Ollama, backend y frontend arrancados.
2. En Safari abre `http://<IP-del-Mac>:4300` (la IP sale con `ipconfig getifaddr en0`).
3. Compartir → **Añadir a pantalla de inicio**.

Las fotos se reducen y se convierten a JPEG en el móvil antes de subirlas, así que también valen las HEIC del iPhone. El modo offline del service worker solo funciona con un build de producción servido por HTTPS; para uso en casa no hace falta.

## Estructura

```
frontend/src/app/
├── core/laundry-api.ts     llamadas a la API y tipos
├── core/image.ts           reduce la foto antes de subirla
├── core/basket.ts          prendas de la colada (cola de lectura, se guarda en el navegador)
├── pages/scan/             foto de la etiqueta → recomendación
├── pages/basket/           modo colada: varias prendas → lavadoras
├── pages/appliances/       mis electrodomésticos
└── shared/                 barra inferior, botón de cámara, tarjeta de resultado,
                            editores de etiqueta y de electrodoméstico, símbolos SVG

backend/app/Laundry/
├── LaundryAdvisor.php      reglas: casa / con cuidado / tintorería
├── ProgramMatcher.php      ajustes → programa concreto de cada electrodoméstico
├── ProgramCategory.php     categoría de un programa a partir de su nombre
├── LoadPlanner.php         reparte varias prendas en lavadoras
└── Vision/
    ├── OllamaPhotoReader.php   lee la foto con el modelo local (gratis)
    ├── ClaudePhotoReader.php   lee la foto con la API de Claude (de pago)
    ├── LabelSchema.php         qué tiene que devolver la IA al leer una etiqueta
    └── ApplianceSchema.php     qué tiene que devolver al leer un panel
```
