import { DayPlanStatus } from '../domain/statuses.js';
import { AROHAFLOW_CALENDAR_ID, publishExternalKey } from '../domain/arohaflowCalendar.js';
import { assessDayPlanOvercommit } from './overcommit.js';

/**
 * @param {{ store: object, calendarWrite: object, clock: { now(): Date } }} deps
 * @param {{ date: string, confirmed: boolean, intention?: string | null, acknowledgeOvercommit?: boolean }} input
 */
export async function lockDayPlan(deps, input) {
  const { store, calendarWrite, clock } = deps;
  if (!input?.confirmed) {
    throw new Error('lock_day_plan requires explicit confirmation');
  }

  const plan = await store.getDayPlan(input.date);
  if (!plan) {
    throw new Error(`No Day Plan for ${input.date}`);
  }

  const overcommit = await assessDayPlanOvercommit(deps, { date: input.date });
  if (overcommit.overcommitted && !input.acknowledgeOvercommit) {
    throw new Error(
      `Day Plan overcommit: Flexible Blocks ${overcommit.plannedMinutes} min exceed available ${overcommit.availableMinutes} min by ${overcommit.overByMinutes} min; edit the plan or pass acknowledgeOvercommit`,
    );
  }

  const toPublish = plan.blocks.filter((block) => block.publishToCalendar);
  if (toPublish.length > 0) {
    if (!calendarWrite) {
      throw new Error('Calendar write port required when Calendar Publish is opted in');
    }
    for (const block of toPublish) {
      await calendarWrite.upsertEvent({
        calendarId: AROHAFLOW_CALENDAR_ID,
        externalKey: publishExternalKey(input.date, block.id),
        title: block.title,
        startAt: block.startAt,
        endAt: block.endAt,
      });
    }
  }

  const intention =
    input.intention !== undefined
      ? input.intention
      : (plan.intention ?? null);

  const lockedAt = clock.now().toISOString();
  const locked = { ...plan, status: DayPlanStatus.LOCKED, intention, lockedAt };
  await store.saveDayPlan(locked);
  await store.appendDayPlanChange({
    date: input.date,
    type: 'accept',
    at: clock.now().toISOString(),
    blocks: structuredClone(locked.blocks),
  });
  await store.appendAgentActivity({
    type: 'lock_day_plan',
    summary: `Locked Day Plan for ${input.date}`,
    at: clock.now().toISOString(),
  });

  return locked;
}
