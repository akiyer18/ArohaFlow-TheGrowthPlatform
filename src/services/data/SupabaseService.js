import { createClient } from '@supabase/supabase-js';

export class SupabaseService {
  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }

    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  getClient() {
    return this.client;
  }

  async getUser() {
    const { data, error } = await this.client.auth.getUser();
    return { user: data?.user ?? null, error };
  }

  async login(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { data, error };
  }

  async register(email, password, metadata = {}) {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: metadata,
      },
    });
    return { data, error };
  }

  async logout() {
    return this.client.auth.signOut();
  }

  async fetchData(table, applyQuery) {
    let query = this.client.from(table).select('*');
    if (typeof applyQuery === 'function') {
      query = applyQuery(query);
    }
    return query;
  }

  async saveData(table, operation, payload, applyQuery) {
    let query = this.client.from(table);

    if (operation === 'insert') {
      query = query.insert(payload);
    } else if (operation === 'update') {
      query = query.update(payload);
    } else if (operation === 'delete') {
      query = query.delete();
    } else if (operation === 'upsert') {
      query = query.upsert(payload);
    } else {
      throw new Error(`Unsupported operation "${operation}"`);
    }

    if (typeof applyQuery === 'function') {
      query = applyQuery(query);
    }

    return query;
  }
}
