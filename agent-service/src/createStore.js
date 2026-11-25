import { createClient } from '@supabase/supabase-js';
import { createMemoryStore } from './adapters/memoryStore.js';
import { createSupabaseStore } from './adapters/supabaseStore.js';

/**
 * Prefer durable Supabase Store when Agent Service env is set; otherwise memory.
 * Tokens stay on the Agent Service process — never in the Vite client.
 *
 * Env: AROHAFLOW_SUPABASE_URL + AROHAFLOW_SUPABASE_SERVICE_ROLE_KEY
 *      AROHAFLOW_OWNER_USER_ID (auth user id; owner of habit rows the web app reads under RLS)
 */
export function createStoreFromEnv(env = process.env) {
  const url = env.AROHAFLOW_SUPABASE_URL;
  const key = env.AROHAFLOW_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      store: createSupabaseStore(client, { ownerUserId: env.AROHAFLOW_OWNER_USER_ID || null }),
      kind: 'supabase',
    };
  }
  return { store: createMemoryStore(), kind: 'memory' };
}
