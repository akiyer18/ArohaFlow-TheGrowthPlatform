/**
 * Client for the recipe parse API. Calls server-side POST /api/parse-recipe.
 * API key is never sent from the client.
 */

const PARSE_API = '/api/parse-recipe';
const HEALTH_API = '/api/parse-recipe/health';

/**
 * Check if the parse server is running and configured. Call before Parse to show a clear message.
 */
export async function checkParseServerHealth() {
  try {
    const res = await fetch(HEALTH_API, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, configured: data.configured === true };
  } catch {
    return { ok: false, configured: false };
  }
}

/**
 * @param {string} text - Raw recipe text
 * @returns {Promise<ParsedRecipe>}
 */
export async function parseRecipeText(text) {
  const res = await fetch(PARSE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: String(text).trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail || data.error;
    const msg = detail
      ? `${detail}`
      : res.status === 500
        ? 'Server error. In a terminal run: npm run server — and add OPENAI_API_KEY to .env'
        : `Parse failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
