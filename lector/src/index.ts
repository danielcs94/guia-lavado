import Anthropic from '@anthropic-ai/sdk';

import { APPLIANCE_PROMPT, APPLIANCE_SCHEMA, LABEL_PROMPT, LABEL_SCHEMA } from './schemas';

interface Env {
  ANTHROPIC_API_KEY: string;
  CODIGO_ACCESO: string;
  MODELO: string;
}

const READINGS = {
  '/etiqueta': { prompt: LABEL_PROMPT, schema: LABEL_SCHEMA },
  '/panel': { prompt: APPLIANCE_PROMPT, schema: APPLIANCE_SCHEMA },
};

/** Una foto ya reducida en el móvil ocupa unos cientos de KB; esto sobra. */
const MAX_IMAGE_BASE64 = 8_000_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Codigo',
};

/**
 * Recibe una foto de la app, se la pasa a Claude y devuelve lo que ha leído.
 * Así la clave de la API nunca sale de Cloudflare.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const reading = READINGS[new URL(request.url).pathname as keyof typeof READINGS];
    if (!reading || request.method !== 'POST') {
      return reply(404, { message: 'No existe.' });
    }

    if (!env.CODIGO_ACCESO || request.headers.get('X-Codigo') !== env.CODIGO_ACCESO) {
      return reply(401, { message: 'Código de acceso incorrecto.' });
    }

    const body = await request.json<{ image?: unknown }>().catch(() => null);
    const image = body?.image;
    if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64) {
      return reply(422, { message: 'Falta la foto o es demasiado grande.' });
    }

    try {
      return reply(200, await read(env, image, reading.prompt, reading.schema));
    } catch (e) {
      return reply(502, { message: problem(e) });
    }
  },
} satisfies ExportedHandler<Env>;

async function read(env: Env, image: string, prompt: string, schema: Record<string, unknown>): Promise<unknown> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: env.MODELO,
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: prompt },
        ],
      },
    ],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
  });

  if (message.stop_reason === 'refusal') {
    throw new Error('La IA no ha querido procesar esta foto. Prueba con otra.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de la IA se ha cortado. Vuelve a intentarlo.');
  }

  const text = message.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('La IA no devolvió ninguna lectura.');
  }
  return JSON.parse(text.text);
}

/** Mensajes que entiende cualquiera, sin detalles técnicos. */
function problem(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) {
    return 'La clave de la API no es válida. Avisa a Daniel.';
  }
  if (e instanceof Anthropic.RateLimitError) {
    return 'Demasiadas fotos seguidas. Espera un momento y vuelve a intentarlo.';
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return 'No se pudo conectar con la IA. Vuelve a intentarlo.';
  }
  if (e instanceof Anthropic.APIError && /credit|balance|billing/i.test(e.message)) {
    return 'Se ha acabado el saldo para leer fotos. Avisa a Daniel. Mientras, puedes marcar los símbolos a mano.';
  }
  if (e instanceof SyntaxError) {
    return 'La IA devolvió una lectura que no se entiende. Vuelve a intentarlo.';
  }
  if (e instanceof Anthropic.APIError) {
    return 'La IA ha dado un error. Vuelve a intentarlo en un rato.';
  }
  return e instanceof Error ? e.message : 'Error inesperado.';
}

function reply(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: CORS });
}
