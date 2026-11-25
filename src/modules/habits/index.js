/**
 * Habits module (ADR-0010 rules, ADR-0011 store).
 * Screens call these functions; they never talk to tables directly.
 *
 * Production (VITE_DATA_SOURCE=production): the Supabase store over agent_habits /
 * agent_habit_checkins, scoped to the signed-in user by RLS.
 * Local: an in-memory store seeded from the fixture (demo data lands here later).
 */
import { buildHabitsFixture } from './habitsFixture.js';
import { createMemoryHabitsStore, createSupabaseHabitsStore } from './habitsStore.js';
import { addDays, dayStatus, indexCheckIns, inSeason, isScheduled, weekStart } from './rules.js';

export * from './rules.js';
export {
  createMemoryHabitsStore,
  createSupabaseHabitsStore,
  rowToHabit,
  rowToCheckIn,
  habitPatchToRow,
  HABITS_TABLE,
  CHECKINS_TABLE,
  HABIT_COLUMNS,
  CHECKIN_COLUMNS,
} from './habitsStore.js';

export function localDateKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let defaultStore = null;

/** The app's store, chosen by data source. Lazy so tests never load the app config. */
export async function getHabitsStore() {
  if (defaultStore) return defaultStore;
  const { isLocalDataSource } = await import('../../config/appConfig.js');
  if (isLocalDataSource) {
    defaultStore = createMemoryHabitsStore(buildHabitsFixture(localDateKey()));
  } else {
    const { supabase } = await import('../../config/supabase.js');
    defaultStore = createSupabaseHabitsStore({ client: supabase });
  }
  return defaultStore;
}

/** First day the screen needs: the 14-day window or the ISO week start, whichever is earlier. */
export function readWindowStart(asOf) {
  const windowStart = addDays(asOf, -13);
  const week = weekStart(asOf);
  return week < windowStart ? week : windowStart;
}

/** @returns {Promise<{ asOf: string, habits: object[], checkIns: object[] }>} */
export async function getHabits({ asOf = localDateKey(), store } = {}) {
  const s = store ?? (await getHabitsStore());
  const [habits, checkIns] = await Promise.all([
    s.listHabits(),
    s.listCheckIns({ from: readWindowStart(asOf), to: asOf }),
  ]);
  return { asOf, habits, checkIns };
}

/**
 * Habits due on a date (scheduled, not on a Season), with that day's check-in level.
 * Used by Flow Mode and the legacy Flow / Momentum scores.
 */
export async function getHabitsDueOn(date = localDateKey(), { store } = {}) {
  const s = store ?? (await getHabitsStore());
  const [habits, checkIns] = await Promise.all([
    s.listHabits(),
    s.listCheckIns({ from: date, to: date }),
  ]);
  const index = indexCheckIns(checkIns);
  return habits
    .filter((h) => isScheduled(h, date) && !inSeason(h, date))
    .map((habit) => {
      const status = dayStatus(habit, index, date, date);
      const kept = status === 'full' || status === 'minimum';
      return { habit, level: kept ? status : null, kept };
    });
}

export async function checkIn({ habit, date = localDateKey(), level, store }) {
  const s = store ?? (await getHabitsStore());
  await s.setCheckIn({ habitId: habit.id, label: habit.label, date, level });
}
