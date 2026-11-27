/**
 * JSON-output LLM over any OpenAI-compatible Chat Completions endpoint (xAI Grok, OpenAI).
 * Structured output via response_format json_schema (strict), so callers get parsed objects.
 */

const TIMEOUT_MS = 120_000;

export class LlmError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

/**
 * @param {{ baseUrl: string, apiKey: string, model: string, fetchImpl?: typeof fetch }} options
 */
export function createJsonLlm({ baseUrl, apiKey, model, fetchImpl = globalThis.fetch }) {
  return {
    model,
    /**
     * @param {{ system: string, user: string, name: string, schema: object }} request
     * @returns {Promise<any>}
     */
    async json({ system, user, name, schema }) {
      const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) {
        let detail = text.slice(0, 200);
        try {
          const body = JSON.parse(text);
          detail = body.error?.message ?? body.error ?? detail;
        } catch {
          /* keep raw text */
        }
        throw new LlmError(`LLM ${res.status}: ${detail}`, res.status);
      }
      const content = JSON.parse(text).choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new LlmError('LLM returned no content', res.status);
      return JSON.parse(content);
    },
  };
}

/**
 * Pick the provider from env. Grok by default when GROK_API_KEY is set.
 * STARTUPS_LLM_PROVIDER=openai uses OPENAI_API_KEY + OPENAI_MODEL instead.
 * @returns {ReturnType<typeof createJsonLlm> | null}
 */
export function createJsonLlmFromEnv(env, fetchImpl) {
  const provider = (env.STARTUPS_LLM_PROVIDER || (env.GROK_API_KEY ? 'grok' : 'openai')).toLowerCase();
  if (provider === 'grok') {
    if (!env.GROK_API_KEY) return null;
    return createJsonLlm({
      baseUrl: 'https://api.x.ai/v1',
      apiKey: env.GROK_API_KEY,
      model: env.GROK_MODEL || 'grok-4.7',
      fetchImpl,
    });
  }
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) return null;
    return createJsonLlm({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      fetchImpl,
    });
  }
  return null;
}
