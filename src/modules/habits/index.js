/**
 * Habits module (ADR-0010): a small read interface plus the pure rules.
 * Writes (check-in, Season, pick back up) stay on the Agent Service facade;
 * until the live bridge lands the screen applies them to local state.
 */
import { buildHabitsFixture } from './habitsFixture.js';

export * from './rules.js';

export function localDateKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** @returns {Promise<{ asOf: string, habits: object[], checkIns: object[] }>} */
export async function getHabits({ asOf = localDateKey() } = {}) {
  return { asOf, ...structuredClone(buildHabitsFixture(asOf)) };
}
