/**
 * @param {{ store: object, calendarRead: object, clock: { now(): Date } }} deps
 */
export async function syncCalendar(deps) {
  const { store, calendarRead, clock } = deps;
  const events = await calendarRead.listEvents();

  for (const event of events) {
    await store.upsertCalendarEvent({
      externalId: event.id,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
    });
  }

  await store.appendAgentActivity({
    type: 'sync_calendar',
    summary: `Synced ${events.length} Calendar Event(s)`,
    at: clock.now().toISOString(),
  });

  return store.listCalendarEvents();
}
