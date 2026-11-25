/**
 * Habits Store (ADR-0011): the one place the web app reads and writes Habits and
 * Habit Check-ins. Two adapters share one interface:
 *
 *   listHabits()                                   -> Habit[] (not archived)
 *   listCheckIns({ from, to })                     -> CheckIn[]
 *   setCheckIn({ habitId, label, date, level })   -> void   (level null clears)
 *   updateHabit(id, patch)                         -> void   (season, restartedOn, minimum, label, ...)
 *   createHabit({ label, scheduledDays, timeAnchor?, minimum? }) -> Habit
 *
 * Tables: agent_habits, agent_habit_checkins (shared with the Agent Service).
 */

export const HABITS_TABLE = 'agent_habits';
export const CHECKINS_TABLE = 'agent_habit_checkins';
export const HABIT_COLUMNS =
  'id,label,scheduled_days,time_anchor,minimum_label,season_reason,season_from,season_until,restarted_on,archived';
export const CHECKIN_COLUMNS = 'habit_id,date_key,level';

/* ---------- Mapping ---------- */

export function rowToHabit(row) {
  return {
    id: String(row.id),
    label: row.label,
    scheduledDays: Array.isArray(row.scheduled_days) ? row.scheduled_days.map(Number) : [],
    timeAnchor: row.time_anchor ?? null,
    minimum: row.minimum_label ? { label: row.minimum_label } : null,
    season: row.season_from
      ? { reason: row.season_reason ?? '', from: row.season_from, until: row.season_until ?? null }
      : null,
    restartedOn: row.restarted_on ?? null,
    archived: Boolean(row.archived),
  };
}

/** Domain patch -> column patch. Only keys present in the patch are written. */
export function habitPatchToRow(patch) {
  const row = {};
  if ('label' in patch) row.label = patch.label;
  if ('scheduledDays' in patch) row.scheduled_days = [...patch.scheduledDays].map(Number).sort((a, b) => a - b);
  if ('timeAnchor' in patch) row.time_anchor = patch.timeAnchor || null;
  if ('minimum' in patch) row.minimum_label = patch.minimum?.label?.trim() || null;
  if ('season' in patch) {
    row.season_reason = patch.season?.reason ?? null;
    row.season_from = patch.season?.from ?? null;
    row.season_until = patch.season?.until ?? null;
  }
  if ('restartedOn' in patch) row.restarted_on = patch.restartedOn ?? null;
  if ('archived' in patch) row.archived = Boolean(patch.archived);
  return row;
}

export function rowToCheckIn(row) {
  return {
    habitId: String(row.habit_id),
    date: row.date_key,
    level: row.level === 'minimum' ? 'minimum' : 'full',
  };
}

export function validateNewHabit(input) {
  const label = input?.label?.trim();
  if (!label) throw new Error('A habit needs a name.');
  const days = [...new Set((input.scheduledDays ?? []).map(Number))].filter((d) => d >= 0 && d <= 6);
  if (!days.length) throw new Error('Pick at least one day.');
  if (input.timeAnchor && !/^\d{2}:\d{2}$/.test(input.timeAnchor)) throw new Error('Time must look like 07:30.');
  return { ...input, label, scheduledDays: days.sort((a, b) => a - b) };
}

export function newHabitId(label, rand = Math.random) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${slug || 'habit'}-${rand().toString(36).slice(2, 8)}`;
}

function fail(op, error) {
  const err = new Error(`${op} failed: ${error.message ?? error}`);
  err.cause = error;
  throw err;
}

/* ---------- Supabase adapter ---------- */

/**
 * @param {{ client: object, now?: () => Date, rand?: () => number }} deps
 *   client: a supabase-js client with a signed-in session. RLS scopes every row to
 *   auth.uid(); user_id defaults to auth.uid() on insert, so it is never sent.
 */
export function createSupabaseHabitsStore({ client, now = () => new Date(), rand = Math.random }) {
  return {
    async listHabits() {
      const { data, error } = await client
        .from(HABITS_TABLE)
        .select(HABIT_COLUMNS)
        .eq('archived', false)
        .order('created_at', { ascending: true });
      if (error) fail('listHabits', error);
      return (data ?? []).map(rowToHabit);
    },

    async listCheckIns({ from, to }) {
      const { data, error } = await client
        .from(CHECKINS_TABLE)
        .select(CHECKIN_COLUMNS)
        .gte('date_key', from)
        .lte('date_key', to);
      if (error) fail('listCheckIns', error);
      return (data ?? []).map(rowToCheckIn);
    },

    async setCheckIn({ habitId, label, date, level }) {
      if (!level) {
        const { error } = await client
          .from(CHECKINS_TABLE)
          .delete()
          .eq('habit_id', habitId)
          .eq('date_key', date);
        if (error) fail('clearCheckIn', error);
        return;
      }
      const { error } = await client.from(CHECKINS_TABLE).upsert(
        { date_key: date, habit_id: habitId, label, level, at: now().toISOString() },
        { onConflict: 'date_key,habit_id' },
      );
      if (error) fail('setCheckIn', error);
    },

    async updateHabit(id, patch) {
      const row = { ...habitPatchToRow(patch), updated_at: now().toISOString() };
      const { error } = await client.from(HABITS_TABLE).update(row).eq('id', id);
      if (error) fail('updateHabit', error);
    },

    async createHabit(input) {
      const habit = validateNewHabit(input);
      const id = newHabitId(habit.label, rand);
      const row = { id, ...habitPatchToRow(habit), archived: false };
      const { data, error } = await client.from(HABITS_TABLE).insert(row).select(HABIT_COLUMNS).single();
      if (error) fail('createHabit', error);
      return rowToHabit(data);
    },
  };
}

/* ---------- In-memory adapter (local mode, demo data, tests) ---------- */

export function createMemoryHabitsStore({ habits = [], checkIns = [], rand = Math.random } = {}) {
  const state = {
    habits: structuredClone(habits),
    checkIns: structuredClone(checkIns),
  };
  return {
    async listHabits() {
      return structuredClone(state.habits.filter((h) => !h.archived));
    },
    async listCheckIns({ from, to }) {
      return structuredClone(state.checkIns.filter((c) => c.date >= from && c.date <= to));
    },
    async setCheckIn({ habitId, date, level }) {
      state.checkIns = state.checkIns.filter((c) => !(c.habitId === habitId && c.date === date));
      if (level) state.checkIns.push({ habitId, date, level });
    },
    async updateHabit(id, patch) {
      state.habits = state.habits.map((h) => (h.id === id ? { ...h, ...structuredClone(patch) } : h));
    },
    async createHabit(input) {
      const habit = validateNewHabit(input);
      const created = {
        id: newHabitId(habit.label, rand),
        label: habit.label,
        scheduledDays: habit.scheduledDays,
        timeAnchor: habit.timeAnchor || null,
        minimum: habit.minimum?.label?.trim() ? { label: habit.minimum.label.trim() } : null,
        season: null,
        restartedOn: null,
        archived: false,
      };
      state.habits.push(created);
      return structuredClone(created);
    },
  };
}
