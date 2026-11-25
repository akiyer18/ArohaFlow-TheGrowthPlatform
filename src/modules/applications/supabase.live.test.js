/**
 * Live check of the Applications Store (ADR-0012). Skipped unless APPS_LIVE=1.
 *   npm run applications:live
 * With HABITS_LIVE_EMAIL / HABITS_LIVE_PASSWORD it also runs a signed-in round trip
 * on a temporary application and deletes it afterwards.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { APPLICATIONS_TABLE, APPLICATION_COLUMNS, EVENTS_TABLE, EVENT_COLUMNS, createSupabaseApplicationsStore, moveApplication } from './index.js';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const live = env.APPS_LIVE === '1' && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY;
const signedIn = live && env.HABITS_LIVE_EMAIL && env.HABITS_LIVE_PASSWORD;
const newClient = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!live)('Applications Store, live Supabase', () => {
  it('has agent_applications with every column the app reads', async () => {
    const { error } = await newClient().from(APPLICATIONS_TABLE).select(`${APPLICATION_COLUMNS},user_id,created_at`).limit(1);
    expect(error, error?.message).toBeNull();
  });

  it('has agent_application_events', async () => {
    const { error } = await newClient().from(EVENTS_TABLE).select(`${EVENT_COLUMNS},user_id`).limit(1);
    expect(error, error?.message).toBeNull();
  });

  it('shows an anonymous client no rows (row level security on)', async () => {
    const { data } = await newClient().from(APPLICATIONS_TABLE).select('id').limit(1);
    expect(data ?? []).toEqual([]);
  });
});

describe.skipIf(!signedIn)('Applications Store, live signed-in round trip', () => {
  const client = newClient();
  const store = createSupabaseApplicationsStore({ client });
  let created = null;

  afterAll(async () => {
    if (created) await client.from(APPLICATIONS_TABLE).delete().eq('id', created.id);
  });

  it('creates, moves and closes a temporary application', async () => {
    const { error } = await client.auth.signInWithPassword({ email: env.HABITS_LIVE_EMAIL, password: env.HABITS_LIVE_PASSWORD });
    expect(error, error?.message).toBeNull();
    const today = new Date().toISOString().slice(0, 10);
    created = await store.createApplication({ company: 'Live test', role: 'Temporary', stage: 'applied' });
    await moveApplication({ app: created, toStage: 'closed', closedReason: 'Withdrawn', today, store });
    const mine = (await store.listApplications()).find((a) => a.id === created.id);
    expect(mine).toMatchObject({ stage: 'closed', closedReason: 'Withdrawn' });
    const events = (await store.listEvents({ from: today })).filter((e) => e.applicationId === created.id);
    expect(events.map((e) => e.toStage)).toEqual(['applied', 'closed']);
  });
});
