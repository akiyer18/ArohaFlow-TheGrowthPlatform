/**
 * Recipe parse API — server-side only. Never expose OPENAI_API_KEY to the client.
 * Run: node server/index.js (or npm run server)
 * Requires OPENAI_API_KEY in .env (do not use VITE_ prefix).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PARSE_SERVER_PORT || 3001;

app.use(express.json({ limit: '500kb' }));

// Load .env from project root (parent of server/)
const envPath = path.resolve(__dirname, '..', '.env');
const loaded = dotenv.config({ path: envPath });
if (loaded.error && process.env.NODE_ENV !== 'production') {
  console.warn('[parse-recipe] .env load warning:', loaded.error.message);
}

const apiKey = process.env.OPENAI_API_KEY?.trim();
const openai = apiKey ? new OpenAI({ apiKey }) : null;

const PARSING_PROMPT = `You are a recipe parser. Extract structured data from the given recipe text.
Return ONLY valid JSON, no markdown or extra text.

Rules:
- title: string (required)
- description: string or null (short summary)
- prep_time_minutes: number or null
- cook_time_minutes: number or null
- total_time_minutes: number or null (compute from prep+cook if not stated)
- servings: number or null
- ingredients: array of { name: string, quantity: number | null, unit: string | null, optional: boolean }
  - Mark optional: true for ingredients that contain words like "optional", "garnish", "to serve", "if desired", "for serving"
  - quantity and unit can be null if not clearly stated
- instructions: string (full instructions, can be multi-line)

Output format exactly:
{"title":"...","description":"...","prep_time_minutes":null,"cook_time_minutes":null,"total_time_minutes":null,"servings":null,"ingredients":[{"name":"...","quantity":null,"unit":null,"optional":false}],"instructions":"..."}`;

function autoCalcTotal(parsed) {
  const prep = parsed.prep_time_minutes ?? 0;
  const cook = parsed.cook_time_minutes ?? 0;
  if ((parsed.total_time_minutes == null || parsed.total_time_minutes === 0) && (prep > 0 || cook > 0)) {
    parsed.total_time_minutes = prep + cook;
  }
  return parsed;
}

function validateParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (typeof parsed.title !== 'string' || !parsed.title.trim()) return false;
  if (!Array.isArray(parsed.ingredients)) parsed.ingredients = [];
  if (typeof parsed.instructions !== 'string') parsed.instructions = '';
  parsed.ingredients = parsed.ingredients.map((ing) => ({
    name: typeof ing.name === 'string' ? ing.name.trim() : String(ing.name || '').trim(),
    quantity: typeof ing.quantity === 'number' ? ing.quantity : (ing.quantity != null ? parseFloat(ing.quantity) : null),
    unit: ing.unit != null ? String(ing.unit).trim() : null,
    optional: Boolean(ing.optional),
  })).filter((ing) => ing.name);
  return true;
}

function getErrorMessage(err) {
  const msg = err?.message || String(err);
  // OpenAI SDK: err.error is the response body, may have .message
  const body = err?.error || err?.response?.data;
  if (body && typeof body === 'object') {
    const bodyMsg = body.error?.message ?? body.message ?? body.msg;
    if (bodyMsg) return bodyMsg;
  }
  return msg;
}

app.get('/api/parse-recipe/health', (req, res) => {
  res.json({ ok: true, configured: !!openai });
});

app.post('/api/parse-recipe', async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'Recipe parsing is not configured. Set OPENAI_API_KEY in .env.' });
    }
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "text" in body.' });
    }
    const trimmed = text.trim();
    if (trimmed.length < 20) {
      return res.status(400).json({ error: 'Recipe text is too short.' });
    }

    const models = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
    let lastErr;
    for (const model of models) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You output only valid JSON, no markdown or explanation.' },
            { role: 'user', content: `${PARSING_PROMPT}\n\nRecipe text:\n${trimmed}` },
          ],
          temperature: 0.2,
        });
        const raw = completion.choices?.[0]?.message?.content?.trim() || '';
        const jsonStr = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return res.status(502).json({ error: 'AI returned invalid JSON.', raw: raw.slice(0, 200) });
        }
        if (!validateParsed(parsed)) {
          return res.status(502).json({ error: 'Parsed structure invalid.' });
        }
        autoCalcTotal(parsed);
        return res.json(parsed);
      } catch (err) {
        lastErr = err;
        const msg = (err?.message || '').toLowerCase();
        const isModelError = msg.includes('model') || msg.includes('not found') || err?.status === 404;
        if (isModelError && model !== models[models.length - 1]) continue;
        break;
      }
    }
    const err = lastErr;
    const detail = getErrorMessage(err);
    console.error('[parse-recipe] ERROR:', detail);
    if (err?.status) console.error('[parse-recipe] status:', err.status);
    if (err?.error) console.error('[parse-recipe] body:', JSON.stringify(err.error).slice(0, 300));
    if (err?.stack) console.error(err.stack);
    const detailStr = typeof detail === 'string' ? detail : String(detail ?? 'Unknown error');
    return res.status(500).json({
      error: 'Recipe parsing failed.',
      detail: detailStr,
    });
  } catch (outerErr) {
    const detail = getErrorMessage(outerErr);
    console.error('[parse-recipe] UNEXPECTED:', detail);
    console.error(outerErr?.stack);
    const detailStr = typeof detail === 'string' ? detail : String(detail ?? 'Unknown error');
    return res.status(500).json({ error: 'Recipe parsing failed.', detail: detailStr });
  }
});

app.listen(PORT, () => {
  console.log(`Recipe parse API running at http://localhost:${PORT}`);
  if (!openai) console.warn('OPENAI_API_KEY is missing. Add it to .env to enable parsing.');
  else console.log('OPENAI_API_KEY loaded.');
});
