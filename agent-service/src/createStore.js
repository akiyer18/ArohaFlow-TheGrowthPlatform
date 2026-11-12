import { createClient } from '@supabase/supabase-js';
import { createMemoryStore } from './adapters/memoryStore.js';
import { createSupabaseStore } from './adapters/supabaseStore.js';

/**
 * Prefer durable Supabase Store when Agent Service env is set; otherwise memory.
 * Tokens stay on the Agent Service process — never in the Vite client.
 *
 * Env: AROHAFLOW_SUPABASE_URL + AROHAFLOW_SUPABASE_SERVICE_ROLE_KEY
 */
export function createStoreFromEnv(env = process.env) {
  const url = env.AROHAFLOW_SUPABASE_URL;
  const key = env.AROHAFLOW_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { store: createSupabaseStore(client), kind: 'supabase' };
  }
  return { store: createMemoryStore(), kind: 'memory' };
}
