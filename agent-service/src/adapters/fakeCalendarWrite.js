export function createFakeCalendarWrite() {
  const events = [];
  return {
    events,
    async upsertEvent(event) {
      const idx = events.findIndex(
        (e) => e.calendarId === event.calendarId && e.externalKey === event.externalKey,
      );
      if (idx >= 0) events[idx] = event;
      else events.push(event);
      return event;
    },
  };
}
