import { describe, it, expect } from 'vitest';
import {
  CHECKINS_TABLE,
  HABITS_TABLE,
  buildHabitsView,
  createMemoryHabitsStore,
  createSupabaseHabitsStore,
  getHabits,
  getHabitsDueOn,
  habitPatchToRow,
  readWindowStart,
  rowToHabit,
} from './index.js';

/**
 * Records every supabase-js chain call and answers with the queued result,
 * so the tests pin the exact tables, columns and filters the store uses.
 */
function createRecordingClient(results = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const call = { table, ops: [] };
      calls.push(call);
      const builder = {};
      for (const op of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'gte', 'lte', 'order', 'single']) {
        builder[op] = (...args) => {
          call.ops.push([op, ...args]);
          return builder;
        };
      }
      builder.then = (resolve) => {
        const key = `${table}:${call.ops.map(([op]) => op).join('.')}`;
        resolve(results[key] ?? { data: [], error: null });
      };
      return builder;
    },
  };
  return client;
}

const NOW = () => new Date('2026-11-24T08:00:00.000Z');

describe('row mapping', () => {
  it('maps an agent_habits row to a Habit', () => {
    expect(
      rowToHabit({
        id: 'gym',
        label: 'Gym',
        scheduled_days: [1, 3],
        time_anchor: '07:00',
        minimum_label: '10-min walk',
        season_reason: 'Sick',
        season_from: '2026-11-20',
        season_until: '2026-11-25',
        restarted_on: null,
        archived: false,
      }),
    ).toEqual({
      id: 'gym',
      label: 'Gym',
      scheduledDays: [1, 3],
      timeAnchor: '07:00',
      minimum: { label: '10-min walk' },
      season: { reason: 'Sick', from: '2026-11-20', until: '2026-11-25' },
      restartedOn: null,
      archived: false,
    });
  });

  it('writes only the keys a patch names, and clears a Season with nulls', () => {
    expect(habitPatchToRow({ season: null })).toEqual({ season_reason: null, season_from: null, season_until: null });
    expect(habitPatchToRow({ restartedOn: '2026-11-24' })).toEqual({ restarted_on: '2026-11-24' });
    expect(habitPatchToRow({ minimum: { label: '  ' } })).toEqual({ minimum_label: null });
  });
});

describe('Supabase habits store', () => {
  it('reads habits that are not archived and check-ins in a date window', async () => {
    const client = createRecordingClient({
      [`${HABITS_TABLE}:select.eq.order`]: {
        data: [{ id: 'gym', label: 'Gym', scheduled_days: [1], archived: false }],
        error: null,
      },
      [`${CHECKINS_TABLE}:select.gte.lte`]: {
        data: [{ habit_id: 'gym', date_key: '2026-11-23', level: 'minimum' }],
        error: null,
      },
    });
    const store = createSupabaseHabitsStore({ client, now: NOW });
    expect(await store.listHabits()).toEqual([expect.objectContaining({ id: 'gym' })]);
    expect(await store.listCheckIns({ from: '2026-11-11', to: '2026-11-24' })).toEqual([
      { habitId: 'gym', date: '2026-11-23', level: 'minimum' },
    ]);
    expect(client.calls[0].ops).toContainEqual(['eq', 'archived', false]);
    expect(client.calls[1].ops).toEqual([
      ['select', 'habit_id,date_key,level'],
      ['gte', 'date_key', '2026-11-11'],
      ['lte', 'date_key', '2026-11-24'],
    ]);
  });

  it('upserts a check-in on (date_key, habit_id) and never sends user_id (RLS default)', async () => {
    const client = createRecordingClient();
    const store = createSupabaseHabitsStore({ client, now: NOW });
    await store.setCheckIn({ habitId: 'gym', label: 'Gym', date: '2026-11-24', level: 'full' });
    const [op, row, options] = client.calls[0].ops[0];
    expect(client.calls[0].table).toBe(CHECKINS_TABLE);
    expect(op).toBe('upsert');
    expect(row).toEqual({
      date_key: '2026-11-24',
      habit_id: 'gym',
      label: 'Gym',
      level: 'full',
      at: '2026-11-24T08:00:00.000Z',
    });
    expect(options).toEqual({ onConflict: 'date_key,habit_id' });
  });

  it('clears a check-in by deleting that day’s row', async () => {
    const client = createRecordingClient();
    await createSupabaseHabitsStore({ client }).setCheckIn({ habitId: 'gym', date: '2026-11-24', level: null });
    expect(client.calls[0].ops).toEqual([['delete'], ['eq', 'habit_id', 'gym'], ['eq', 'date_key', '2026-11-24']]);
  });

  it('creates a habit with a generated id and validates input', async () => {
    const client = createRecordingClient({
      [`${HABITS_TABLE}:insert.select.single`]: {
        data: { id: 'gym-abc123', label: 'Gym', scheduled_days: [1, 3], archived: false },
        error: null,
      },
    });
    const store = createSupabaseHabitsStore({ client, rand: () => 0.5 });
    const created = await store.createHabit({ label: ' Gym ', scheduledDays: [3, 1, 3], minimum: { label: 'Walk' } });
    expect(created.id).toBe('gym-abc123');
    const inserted = client.calls[0].ops[0][1];
    expect(inserted).toMatchObject({ label: 'Gym', scheduled_days: [1, 3], minimum_label: 'Walk', archived: false });
    expect(inserted.id).toMatch(/^gym-/);
    await expect(store.createHabit({ label: '', scheduledDays: [1] })).rejects.toThrow('name');
    await expect(store.createHabit({ label: 'Read', scheduledDays: [] })).rejects.toThrow('day');
  });

  it('surfaces Supabase errors with the operation name', async () => {
    const client = createRecordingClient({
      [`${HABITS_TABLE}:select.eq.order`]: { data: null, error: { message: 'relation does not exist' } },
    });
    await expect(createSupabaseHabitsStore({ client }).listHabits()).rejects.toThrow(
      'listHabits failed: relation does not exist',
    );
  });
});

describe('reads through the store', () => {
  const asOf = '2026-11-24';
  const habits = [
    { id: 'gym', label: 'Gym', scheduledDays: [1, 2, 3, 4, 5], minimum: { label: 'Walk' } },
    { id: 'swim', label: 'Swim', scheduledDays: [2], season: { reason: 'Sick', from: '2026-11-20', until: '2026-11-30' } },
    { id: 'yoga', label: 'Yoga', scheduledDays: [0] },
  ];

  it('loads the 14-day window plus the ISO week', async () => {
    expect(readWindowStart(asOf)).toBe('2026-11-11');
    expect(readWindowStart('2026-11-30')).toBe('2026-11-17');
    const store = createMemoryHabitsStore({
      habits,
      checkIns: [
        { habitId: 'gym', date: '2026-11-01', level: 'full' },
        { habitId: 'gym', date: '2026-11-23', level: 'minimum' },
      ],
    });
    const data = await getHabits({ asOf, store });
    expect(data.checkIns).toEqual([{ habitId: 'gym', date: '2026-11-23', level: 'minimum' }]);
    expect(buildHabitsView(data).season.map((r) => r.habit.id)).toEqual(['swim']);
  });

  it('lists habits due on a day, skipping Seasons and unscheduled habits', async () => {
    const store = createMemoryHabitsStore({ habits });
    await store.setCheckIn({ habitId: 'gym', date: asOf, level: 'minimum' });
    expect(await getHabitsDueOn(asOf, { store })).toEqual([
      { habit: expect.objectContaining({ id: 'gym' }), level: 'minimum', kept: true },
    ]);
  });
});
