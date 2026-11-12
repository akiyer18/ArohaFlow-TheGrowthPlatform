export function createFakeCalendarWrite() {
  const events = [];
  function indexOf(calendarId, externalKey) {
    return events.findIndex((e) => e.calendarId === calendarId && e.externalKey === externalKey);
  }
  return {
    events,
    async upsertEvent(event) {
      const idx = indexOf(event.calendarId, event.externalKey);
      if (idx >= 0) events[idx] = event;
      else events.push(event);
      return event;
    },
    async deleteEvent({ calendarId, externalKey }) {
      const idx = indexOf(calendarId, externalKey);
      if (idx >= 0) events.splice(idx, 1);
    },
  };
}
