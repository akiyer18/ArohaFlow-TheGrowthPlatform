import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeSupabaseClient } from '../src/adapters/fakeSupabaseClient.js';
import { createSupabaseStore } from '../src/adapters/supabaseStore.js';
import { createStoreFromEnv } from '../src/createStore.js';

describe('Habit Check-in levels and owner (ADR-0010, ADR-0011)', () => {
  it('awards 5 points for a Minimum Version check-in and 10 for full', async () => {
    const clock = createFixedClock(new Date('2026-11-24T09:00:00.000Z'));
    const agent = createAgentService({ clock, store: createMemoryStore() });
    const minimum = await agent.logHabitCheckIn({ habitId: 'gym', label: 'Gym', level: 'minimum' });
    const full = await agent.logHabitCheckIn({ habitId: 'read', label: 'Read', level: 'full' });
    expect(minimum.awarded).toBe(5);
    expect(full.awarded).toBe(10);
    expect(full.dailyPoints).toBe(15);
  });

  it('stores level and owner on agent_habit_checkins and reads level back', async () => {
    const client = createFakeSupabaseClient();
    const store = createSupabaseStore(client, { ownerUserId: 'user-1' });
    await store.saveHabitCheckIn('2026-11-24', {
      habitId: 'gym',
      label: 'Gym',
      at: '2026-11-24T08:00:00.000Z',
      level: 'minimum',
    });
    const { data } = await client.from('agent_habit_checkins').select('*');
    expect(data[0]).toMatchObject({ habit_id: 'gym', level: 'minimum', user_id: 'user-1' });
    expect(await store.getHabitCheckIns('2026-11-24')).toEqual([
      expect.objectContaining({ habitId: 'gym', level: 'minimum' }),
    ]);
  });

  it('maps Minimum Version, Season and archive from agent_habits', async () => {
    const client = createFakeSupabaseClient();
    await client.from('agent_habits').insert([
      {
        id: 'gym',
        label: 'Gym',
        scheduled_days: [1, 2, 3, 4, 5],
        time_anchor: null,
        minimum_label: '10-min walk',
        season_reason: 'Travel',
        season_from: '2026-11-20',
        season_until: '2026-11-30',
        archived: false,
      },
      { id: 'old', label: 'Old', scheduled_days: [0], archived: true },
    ]);
    const habits = await createSupabaseStore(client).listHabits();
    expect(habits).toHaveLength(1);
    expect(habits[0]).toMatchObject({
      id: 'gym',
      timeAnchor: null,
      minimum: { label: '10-min walk' },
      season: { reason: 'Travel', from: '2026-11-20', until: '2026-11-30' },
    });
  });

  it('writes no user_id when no owner is configured', async () => {
    const client = createFakeSupabaseClient();
    await createSupabaseStore(client).upsertHabit({ id: 'gym', label: 'Gym', scheduledDays: [1], timeAnchor: '07:00' });
    const { data } = await client.from('agent_habits').select('*');
    expect(data[0]).not.toHaveProperty('user_id');
  });

  it('reads the owner from AROHAFLOW_OWNER_USER_ID', () => {
    const { kind } = createStoreFromEnv({
      AROHAFLOW_SUPABASE_URL: 'https://example.supabase.co',
      AROHAFLOW_SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      AROHAFLOW_OWNER_USER_ID: 'user-1',
    });
    expect(kind).toBe('supabase');
  });
});
