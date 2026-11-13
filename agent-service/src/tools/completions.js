import { creditStreakIfTargetMet } from './streak.js';

const HABIT_POINTS = 10;
const MICROACTION_POINTS = 20;
const ACTION_POINTS = 100;

/**
 * @param {{ store: object, clock: { todayDateKey(): string, now(): Date } }} deps
 * @param {{ habitId: string, label: string }} input
 */
export async function logHabitCheckIn(deps, input) {
  const { store, clock } = deps;
  const dateKey = clock.todayDateKey();
  const before = await store.getHabitCheckIns(dateKey);
  if (before.some((c) => c.habitId === input.habitId)) {
    return { awarded: 0, dailyPoints: await store.getDailyPoints(dateKey) };
  }

  const at = clock.now().toISOString();
  await store.saveHabitCheckIn(dateKey, {
    habitId: input.habitId,
    label: input.label,
    at,
  });
  await store.appendCompletion(dateKey, {
    type: 'habit_check_in',
    points: HABIT_POINTS,
    at,
    habitId: input.habitId,
  });
  const dailyPoints = await store.addDailyPoints(dateKey, HABIT_POINTS);
  await creditStreakIfTargetMet(deps, dateKey);
  return { awarded: HABIT_POINTS, dailyPoints };
}

/**
 * @param {{ store: object, clock: { todayDateKey(): string, now(): Date } }} deps
 * @param {{ microactionId: string }} input
 */
export async function completeMicroaction(deps, input) {
  const { store, clock } = deps;
  const dateKey = clock.todayDateKey();
  const result = await store.completeMicroaction(input.microactionId);
  if (result.alreadyComplete) {
    return { awarded: 0, dailyPoints: await store.getDailyPoints(dateKey) };
  }
  await store.appendCompletion(dateKey, {
    type: 'microaction',
    points: MICROACTION_POINTS,
    at: clock.now().toISOString(),
    microactionId: input.microactionId,
  });
  const dailyPoints = await store.addDailyPoints(dateKey, MICROACTION_POINTS);
  await creditStreakIfTargetMet(deps, dateKey);
  return { awarded: MICROACTION_POINTS, dailyPoints };
}

/**
 * @param {{ store: object, clock: { todayDateKey(): string, now(): Date } }} deps
 * @param {{ actionId: string }} input
 */
export async function completeAction(deps, input) {
  const { store, clock } = deps;
  const dateKey = clock.todayDateKey();
  const result = await store.completeAction(input.actionId);
  if (result.alreadyComplete) {
    return {
      awarded: 0,
      dailyPoints: await store.getDailyPoints(dateKey),
      actionStatus: result.action.status,
    };
  }
  await store.appendCompletion(dateKey, {
    type: 'action',
    points: ACTION_POINTS,
    at: clock.now().toISOString(),
    actionId: input.actionId,
  });
  const dailyPoints = await store.addDailyPoints(dateKey, ACTION_POINTS);
  await creditStreakIfTargetMet(deps, dateKey);
  return {
    awarded: ACTION_POINTS,
    dailyPoints,
    actionStatus: result.action.status,
  };
}
