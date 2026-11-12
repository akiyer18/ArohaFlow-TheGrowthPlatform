/**
 * After Daily Points change, credit the Streak once when the Daily Point Target is met.
 * @param {{ store: object }} deps
 * @param {string} dateKey
 */
export async function creditStreakIfTargetMet(deps, dateKey) {
  const { store } = deps;
  const points = await store.getDailyPoints(dateKey);
  const target = await store.getDailyPointTarget();
  if (points < target) {
    return store.getStreak();
  }
  return store.recordStreakTargetMet(dateKey);
}

/**
 * Resolve a calendar day's Streak outcome (hit already credited, or miss with freeze/reset).
 * @param {{ store: object }} deps
 * @param {{ date: string }} input
 */
export async function evaluateStreak(deps, input) {
  const { store } = deps;
  const dateKey = input.date;
  const points = await store.getDailyPoints(dateKey);
  const target = await store.getDailyPointTarget();

  if (points >= target) {
    return store.recordStreakTargetMet(dateKey);
  }
  return store.recordStreakMiss(dateKey);
}
