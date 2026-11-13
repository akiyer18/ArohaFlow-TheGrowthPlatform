import { DayPlanStatus } from '../domain/statuses.js';
import { creditStreakIfTargetMet } from './streak.js';

export const PLAN_READY_POINTS = 10;
export const PLAN_READY_TYPE = 'plan_ready';

/**
 * Grant Plan-ready Completion once when today's Day Plan was locked (evening ritual).
 * @param {{ store: object, clock: { todayDateKey(): string, now(): Date } }} deps
 */
function lockedOnPriorDay(plan, todayDateKey) {
  if (!plan?.lockedAt) return false;
  const lockedDateKey = String(plan.lockedAt).slice(0, 10);
  return lockedDateKey < todayDateKey;
}

export async function ensurePlanReadyCompletion(deps) {
  const { store, clock } = deps;
  const dateKey = clock.todayDateKey();
  const plan = await store.getDayPlan(dateKey);
  if (!plan || plan.status !== DayPlanStatus.LOCKED) {
    return { awarded: 0 };
  }
  if (!lockedOnPriorDay(plan, dateKey)) {
    return { awarded: 0 };
  }

  const existing = await store.listCompletions(dateKey);
  if (existing.some((c) => c.type === PLAN_READY_TYPE)) {
    return { awarded: 0 };
  }

  await store.appendCompletion(dateKey, {
    type: PLAN_READY_TYPE,
    points: PLAN_READY_POINTS,
    at: clock.now().toISOString(),
  });
  await store.addDailyPoints(dateKey, PLAN_READY_POINTS);
  await creditStreakIfTargetMet(deps, dateKey);
  return { awarded: PLAN_READY_POINTS };
}
