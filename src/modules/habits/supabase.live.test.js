/**
 * Live check of the Habits Store against your Supabase project (ADR-0011).
 * Skipped unless HABITS_LIVE=1. Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.
 *
 *   HABITS_LIVE=1 npx vitest run src/modules/habits/supabase.live.test.js
 *
 * With HABITS_LIVE_EMAIL and HABITS_LIVE_PASSWORD it also signs in and runs a
 * write round trip on a temporary habit, then deletes it.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { CHECKINS_TABLE, CHECKIN_COLUMNS, HABITS_TABLE, HABIT_COLUMNS, createSupabaseHabitsStore } from './index.js';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const live = env.HABITS_LIVE === '1' && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY;
const signedIn = live && env.HABITS_LIVE_EMAIL && env.HABITS_LIVE_PASSWORD;

function newClient() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!live)('Habits Store, live Supabase', () => {
  it('has agent_habits with every column the app reads (migration applied)', async () => {
    const { error } = await newClient().from(HABITS_TABLE).select(`${HABIT_COLUMNS},user_id,created_at`).limit(1);
    expect(error, error?.message).toBeNull();
  });

  it('has agent_habit_checkins with level and user_id', async () => {
    const { error } = await newClient().from(CHECKINS_TABLE).select(`${CHECKIN_COLUMNS},user_id,label,at`).limit(1);
    expect(error, error?.message).toBeNull();
  });

  it('shows an anonymous client no rows (row level security on)', async () => {
    const habits = await newClient().from(HABITS_TABLE).select('id').limit(1);
    const checkIns = await newClient().from(CHECKINS_TABLE).select('habit_id').limit(1);
    expect(habits.data ?? []).toEqual([]);
    expect(checkIns.data ?? []).toEqual([]);
  });

  it('has dropped the legacy habits and habit_logs tables', async () => {
    const legacy = await newClient().from('habits').select('id').limit(1);
    const logs = await newClient().from('habit_logs').select('id').limit(1);
    expect(legacy.error, 'run database/habits-drop-legacy.sql once the copy is checked').not.toBeNull();
    expect(logs.error).not.toBeNull();
  });
});

describe.skipIf(!signedIn)('Habits Store, live signed-in round trip', () => {
  const client = newClient();
  const store = createSupabaseHabitsStore({ client });
  let created = null;

  afterAll(async () => {
    if (created) {
      await client.from(CHECKINS_TABLE).delete().eq('habit_id', created.id);
      await client.from(HABITS_TABLE).delete().eq('id', created.id);
    }
  });

  it('creates, checks in, pauses and reads back a temporary habit', async () => {
    const { error: authError } = await client.auth.signInWithPassword({
      email: env.HABITS_LIVE_EMAIL,
      password: env.HABITS_LIVE_PASSWORD,
    });
    expect(authError, authError?.message).toBeNull();

    created = await store.createHabit({ label: 'Live test habit', scheduledDays: [0, 1, 2, 3, 4, 5, 6], minimum: { label: 'One minute' } });
    const today = new Date().toISOString().slice(0, 10);
    await store.setCheckIn({ habitId: created.id, label: created.label, date: today, level: 'minimum' });
    await store.updateHabit(created.id, { season: { reason: 'Test', from: today, until: today } });

    const habits = await store.listHabits();
    const mine = habits.find((h) => h.id === created.id);
    expect(mine).toMatchObject({ minimum: { label: 'One minute' }, season: { reason: 'Test', from: today, until: today } });
    expect(await store.listCheckIns({ from: today, to: today })).toContainEqual({
      habitId: created.id,
      date: today,
      level: 'minimum',
    });

    await store.setCheckIn({ habitId: created.id, date: today, level: null });
    expect((await store.listCheckIns({ from: today, to: today })).some((c) => c.habitId === created.id)).toBe(false);
  });
});
