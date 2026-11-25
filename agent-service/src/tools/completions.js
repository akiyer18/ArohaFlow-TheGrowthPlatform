import { DayPlanStatus } from '../domain/statuses.js';
import { creditStreakIfTargetMet } from './streak.js';

const HABIT_POINTS = 10;
const HABIT_MINIMUM_POINTS = 5; // ADR-0010: Minimum Version earns half
const MICROACTION_POINTS = 20;
const OVERACHIEVEMENT_POINTS = 20;
const ACTION_POINTS = 100;

const WORK_ZONE = 'Europe/Amsterdam';
const WORK_END_MINUTES = 18 * 60;

const amsterdamTimeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: WORK_ZONE,
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/** True when instant is strictly before 18:00 Europe/Amsterdam (DST-aware). */
function isBeforeAmsterdamWorkEnd(instant) {
  const parts = amsterdamTimeParts.formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute < WORK_END_MINUTES;
}

function plannedMicroactionIds(dayPlan) {
  if (!dayPlan || dayPlan.status !== DayPlanStatus.LOCKED) return new Set();
  return new Set(
    (dayPlan.blocks || [])
      .map((b) => b.microactionId)
      .filter(Boolean),
  );
}

/**
 * @param {{ store: object, clock: { todayDateKey(): string, now(): Date } }} deps
 * @param {{ habitId: string, label: string, level?: 'full' | 'minimum' }} input
 */
export async function logHabitCheckIn(deps, input) {
  const level = input.level === 'minimum' ? 'minimum' : 'full';
  const points = level === 'minimum' ? HABIT_MINIMUM_POINTS : HABIT_POINTS;
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
    level,
  });
  await store.appendCompletion(dateKey, {
    type: 'habit_check_in',
    points,
    at,
    habitId: input.habitId,
    level,
  });
  const dailyPoints = await store.addDailyPoints(dateKey, points);
  await creditStreakIfTargetMet(deps, dateKey);
  return { awarded: points, dailyPoints };
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

  const dayPlan = await store.getDayPlan(dateKey);
  const planned = plannedMicroactionIds(dayPlan);
  const locked = dayPlan?.status === DayPlanStatus.LOCKED;
  const isSurplus = locked && !planned.has(input.microactionId);
  const at = clock.now();
  const beforeWorkEnd = isBeforeAmsterdamWorkEnd(at);

  if (isSurplus) {
    // Surplus beyond Locked plan: Overachievement only before 18:00 Europe/Amsterdam.
    if (!beforeWorkEnd) {
      return { awarded: 0, dailyPoints: await store.getDailyPoints(dateKey) };
    }
    await store.appendCompletion(dateKey, {
      type: 'overachievement',
      points: OVERACHIEVEMENT_POINTS,
      at: at.toISOString(),
      microactionId: input.microactionId,
    });
    const dailyPoints = await store.addDailyPoints(dateKey, OVERACHIEVEMENT_POINTS);
    await creditStreakIfTargetMet(deps, dateKey);
    return { awarded: OVERACHIEVEMENT_POINTS, dailyPoints };
  }

  await store.appendCompletion(dateKey, {
    type: 'microaction',
    points: MICROACTION_POINTS,
    at: at.toISOString(),
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
