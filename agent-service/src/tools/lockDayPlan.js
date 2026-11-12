import { DayPlanStatus } from '../domain/statuses.js';

const AROHAFLOW_CALENDAR_ID = 'ArohaFlow';

/**
 * @param {{ store: object, calendarWrite: object, clock: { now(): Date } }} deps
 * @param {{ date: string, confirmed: boolean }} input
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

  const toPublish = plan.blocks.filter((block) => block.publishToCalendar);
  if (toPublish.length > 0) {
    if (!calendarWrite) {
      throw new Error('Calendar write port required when Calendar Publish is opted in');
    }
    for (const block of toPublish) {
      await calendarWrite.upsertEvent({
        calendarId: AROHAFLOW_CALENDAR_ID,
        externalKey: `${input.date}:${block.id}`,
        title: block.title,
        startAt: block.startAt,
        endAt: block.endAt,
      });
    }
  }

  const locked = { ...plan, status: DayPlanStatus.LOCKED };
  await store.saveDayPlan(locked);
  await store.appendDayPlanChange({
    date: input.date,
    type: 'lock',
    at: clock.now().toISOString(),
  });
  await store.appendAgentActivity({
    type: 'lock_day_plan',
    summary: `Locked Day Plan for ${input.date}`,
    at: clock.now().toISOString(),
  });

  return locked;
}
