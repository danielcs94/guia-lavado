# Guía de lavado

Haces una foto a la etiqueta de una prenda (o marcas tú los símbolos) y te dice cómo lavarla con **tu** lavadora y secadora, o si es mejor llevarla a la tintorería.

**Úsala aquí:** https://danielcs94.github.io/guia-lavado/ (en el iPhone: Safari → Compartir → **Añadir a pantalla de inicio**).

- Una IA de visión (Claude) solo **lee** las fotos: la etiqueta (símbolos ISO 3758 y composición) y el panel de los electrodomésticos.
- Todo lo que lee la IA se puede **corregir a mano**, y también se puede usar sin foto: marcando los símbolos y metiendo los programas de la lavadora.
- **Modo colada**: haces foto a la etiqueta de varias prendas, marcas su color y te dice en cuántas lavadoras repartirlas, con qué programa, qué va a la secadora, qué se tiende y qué va a mano o a la tintorería.
- Las **decisiones** las toma un motor de reglas propio ([`frontend/src/app/engine`](frontend/src/app/engine)) que funciona en el propio móvil, así que las recomendaciones son coherentes, explicables y no gastan nada.
- Los electrodomésticos se guardan **en cada móvil**: cada persona tiene los suyos.

## Cómo está montado

```
iPhone (app web en GitHub Pages)
 ├── reglas de lavado, colada y electrodomésticos  →  todo en el móvil
 └── foto  →  lector (Cloudflare Worker)  →  API de Claude
                guarda la clave en secreto y pide un código de acceso
```

No hace falta tener ningún ordenador encendido. Lo único que cuesta dinero son las fotos (la API de Claude, unos 2 céntimos por foto con Sonnet).

## Publicar el lector (una vez)

Necesitas una cuenta gratuita de [Cloudflare](https://dash.cloudflare.com/sign-up) y saldo en la [API de Claude](https://platform.claude.com) (pon un límite de gasto en *Settings → Limits*).

```bash
cd lector
npm install
npx wrangler login                       # abre el navegador para entrar en Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # pega la clave cuando la pida
npx wrangler secret put CODIGO_ACCESO       # el código que escribiréis en la app
npm run deploy                           # te da la dirección https://guia-lavado.<tu-subdominio>.workers.dev
```

Esa dirección va en `READER_URL` de [`photo-reader.ts`](frontend/src/app/core/photo-reader.ts). El modelo se cambia en [`wrangler.jsonc`](lector/wrangler.jsonc).

La primera vez que alguien hace una foto, la app le pide el código de acceso y lo recuerda. Sin el código, nadie más puede gastar el saldo aunque tenga el enlace.

## Publicar la app

Cada vez que se sube algo de `frontend/` a `main`, [GitHub Actions](.github/workflows/pages.yml) pasa los tests, compila la app y la publica en GitHub Pages.

## Programar en local

```bash
cp lector/.dev.vars.example lector/.dev.vars   # y rellénalo (no se sube a git)
./arrancar.sh
```

Arranca el lector (8787) y la app (4300), y te dice la dirección para abrirla en el iPhone con la misma wifi.

```bash
cd frontend
npx ng test --watch=false   # tests de las reglas
```

## Cómo se reparte la colada

[`load-planner.ts`](frontend/src/app/engine/load-planner.ts) pasa cada prenda por las reglas y luego:

1. Saca lo que va a la tintorería, lo que no se ha podido leer y lo que es solo a mano (si tu lavadora no tiene programa de lana o lavado a mano).
2. Separa claros (blanco y claro) de oscuros (oscuro y de color), y dentro de cada uno: normal, delicada (lana, seda, a mano, muy delicado), plumíferos, y toallas y sábanas si hay al menos 2 kg (si no, van con el resto).
3. Cada lavadora usa los ajustes de la prenda más delicada que lleva, con 40° como máximo para la ropa normal (60° para toallas).
4. Si una colada no cabe (7 kg normal, 2,5 kg delicada, 2 kg plumíferos, con un peso aproximado por tipo de prenda), la parte en varias.
5. Dice qué prendas pueden ir a la secadora y cuáles hay que sacar antes y tender, y avisa cuando una lavadora va medio vacía.

Si la IA lee los programas del panel pero no sabe clasificarlos, la categoría se deduce del nombre ([`program-category.ts`](frontend/src/app/engine/program-category.ts)): «Lana» → lana, «Eco 40-60» → eco…

## Estructura

```
frontend/src/app/
├── engine/                 reglas: casa / con cuidado / tintorería, programa de cada
│                           electrodoméstico y reparto de la colada (con sus tests)
├── core/laundry-api.ts     lo que usan las páginas: fotos + reglas + electrodomésticos
├── core/photo-reader.ts    manda la foto al lector y pide el código de acceso
├── core/appliance-store.ts electrodomésticos guardados en el móvil
├── core/basket.ts          prendas de la colada (cola de lectura, se guarda en el móvil)
├── core/image.ts           reduce la foto antes de subirla
├── pages/                  etiqueta, colada y electrodomésticos
└── shared/                 barra inferior, botón de cámara, tarjeta de resultado,
                            editores de etiqueta y de electrodoméstico, símbolos SVG

lector/src/
├── index.ts                recibe la foto, comprueba el código y llama a Claude
└── schemas.ts              qué tiene que devolver la IA al leer una etiqueta o un panel

backend/                    primera versión (Laravel + Ollama en el Mac). La app ya no la usa.
```

Las fotos se reducen y se convierten a JPEG en el móvil antes de subirlas, así que también valen las HEIC del iPhone.
