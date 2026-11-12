import { DayPlanStatus } from '../domain/statuses.js';
import { AROHAFLOW_CALENDAR_ID, publishExternalKey } from '../domain/arohaflowCalendar.js';

/**
 * Unlock a Locked Day Plan so the user can edit and re-publish.
 * Retracts Calendar Publish for opted-in Blocks on the ArohaFlow calendar.
 * @param {{ store: object, clock: { now(): Date }, calendarWrite?: object }} deps
 * @param {{ date: string }} input
 */
export async function unlockDayPlan(deps, input) {
  const { store, clock, calendarWrite } = deps;
  const plan = await store.getDayPlan(input.date);
  if (!plan) {
    throw new Error(`No Day Plan for ${input.date}`);
  }
  if (plan.status !== DayPlanStatus.LOCKED) {
    return plan;
  }

  const published = plan.blocks.filter((block) => block.publishToCalendar);
  if (published.length > 0) {
    if (!calendarWrite) {
      throw new Error('Calendar write port required to retract Calendar Publish on Unlock');
    }
    for (const block of published) {
      await calendarWrite.deleteEvent({
        calendarId: AROHAFLOW_CALENDAR_ID,
        externalKey: publishExternalKey(input.date, block.id),
      });
    }
  }

  const unlocked = { ...plan, status: DayPlanStatus.PROPOSED };
  await store.saveDayPlan(unlocked);
  await store.appendDayPlanChange({
    date: input.date,
    type: 'unlock',
    at: clock.now().toISOString(),
    blocks: structuredClone(unlocked.blocks),
  });
  await store.appendAgentActivity({
    type: 'unlock_day_plan',
    summary: `Unlocked Day Plan for ${input.date}; retracted ${published.length} Calendar Publish Block(s)`,
    at: clock.now().toISOString(),
  });

  return unlocked;
}

/**
 * Replace Blocks on a Proposed Day Plan. Locked plans must be unlocked first.
 * @param {{ store: object, clock: { now(): Date } }} deps
 * @param {{ date: string, blocks: object[] }} input
 */
export async function editDayPlan(deps, input) {
  const { store, clock } = deps;
  const plan = await store.getDayPlan(input.date);
  if (!plan) {
    throw new Error(`No Day Plan for ${input.date}`);
  }
  if (plan.status === DayPlanStatus.LOCKED) {
    throw new Error('Unlock the Day Plan before editing');
  }

  const edited = {
    ...plan,
    status: DayPlanStatus.PROPOSED,
    blocks: structuredClone(input.blocks),
  };
  await store.saveDayPlan(edited);
  await store.appendDayPlanChange({
    date: input.date,
    type: 'edit',
    at: clock.now().toISOString(),
    blocks: structuredClone(edited.blocks),
  });
  await store.appendAgentActivity({
    type: 'edit_day_plan',
    summary: `Edited Day Plan for ${input.date}`,
    at: clock.now().toISOString(),
  });

  return edited;
}
