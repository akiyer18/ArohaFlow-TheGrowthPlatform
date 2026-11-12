/**
 * @param {Array<{ id: string, title: string, startAt: string, endAt: string }>} events
 */
export function createFakeCalendarRead(events = []) {
  return {
    async listEvents() {
      return events.map((e) => ({ ...e }));
    },
  };
}
