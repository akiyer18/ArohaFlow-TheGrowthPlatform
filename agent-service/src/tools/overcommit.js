import { BlockKind } from '../domain/statuses.js';

const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 18;

function minutesBetween(startAt, endAt) {
  return Math.max(0, Math.round((new Date(endAt) - new Date(startAt)) / 60000));
}

/**
 * Available time = work-window Fixed Block duration (or 09:00–18:00 default).
 * Planned time = sum of Flexible Block durations.
 * Overcommit when planned > available.
 *
 * @param {{ store: object }} deps
 * @param {{ date: string }} input
 */
export async function assessDayPlanOvercommit(deps, input) {
  const plan = await deps.store.getDayPlan(input.date);
  if (!plan) {
    throw new Error(`No Day Plan for ${input.date}`);
  }

  const blocks = plan.blocks ?? [];
  const workWindow = blocks.find(
    (b) => b.kind === BlockKind.FIXED && b.purpose === 'work-window',
  );

  let availableMinutes;
  if (workWindow) {
    availableMinutes = minutesBetween(workWindow.startAt, workWindow.endAt);
  } else {
    availableMinutes = (DEFAULT_WORK_END_HOUR - DEFAULT_WORK_START_HOUR) * 60;
  }

  const plannedMinutes = blocks
    .filter((b) => b.kind === BlockKind.FLEXIBLE)
    .reduce((sum, b) => sum + minutesBetween(b.startAt, b.endAt), 0);

  const overByMinutes = Math.max(0, plannedMinutes - availableMinutes);

  return {
    date: input.date,
    overcommitted: overByMinutes > 0,
    plannedMinutes,
    availableMinutes,
    overByMinutes,
  };
}
