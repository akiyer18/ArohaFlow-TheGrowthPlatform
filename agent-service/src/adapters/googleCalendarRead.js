function toIso(slot) {
  if (!slot) return null;
  if (slot.dateTime) return new Date(slot.dateTime).toISOString();
  if (slot.date) return `${slot.date}T00:00:00.000Z`;
  return null;
}

/**
 * Live Calendar read adapter — syncs Calendar Events into ArohaFlow.
 * @param {object} calendarApi google.calendar({ version: 'v3', auth })
 * @param {{ calendarId?: string }} [options]
 */
export function createCalendarReadFromGoogleClient(calendarApi, options = {}) {
  const calendarId = options.calendarId ?? 'primary';

  return {
    async listEvents({ timeMin, timeMax } = {}) {
      const listed = await calendarApi.events.list({
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: timeMin ?? new Date(Date.now() - 7 * 86400000).toISOString(),
        timeMax: timeMax ?? new Date(Date.now() + 14 * 86400000).toISOString(),
        maxResults: 250,
      });

      return (listed.data.items || [])
        .map((item) => {
          const startAt = toIso(item.start);
          const endAt = toIso(item.end);
          if (!item.id || !startAt || !endAt) return null;
          return {
            id: item.id,
            title: item.summary || '(no title)',
            startAt,
            endAt,
          };
        })
        .filter(Boolean);
    },
  };
}
