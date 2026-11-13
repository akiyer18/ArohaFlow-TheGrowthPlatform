import { AROHAFLOW_CALENDAR_ID } from '../domain/arohaflowCalendar.js';

/** Google Calendar private extended property used to idempotently find published Blocks. */
const AROHAFLOW_EXTENDED_PROPERTY = 'arohaflow_key';

/**
 * Live Calendar write adapter — Calendar Publish only to the dedicated ArohaFlow calendar.
 * @param {object} calendarApi google.calendar({ version: 'v3', auth })
 * @param {{ resolveCalendarId: (logicalId: string) => Promise<string> }} options
 */
export function createCalendarWriteFromGoogleClient(calendarApi, options) {
  const { resolveCalendarId } = options;

  async function findByExternalKey(googleCalendarId, externalKey) {
    const listed = await calendarApi.events.list({
      calendarId: googleCalendarId,
      privateExtendedProperty: [`${AROHAFLOW_EXTENDED_PROPERTY}=${externalKey}`],
      maxResults: 2,
      singleEvents: true,
    });
    return (listed.data.items || [])[0] ?? null;
  }

  return {
    async upsertEvent(event) {
      const googleCalendarId = await resolveCalendarId(event.calendarId || AROHAFLOW_CALENDAR_ID);
      const body = {
        summary: event.title,
        start: { dateTime: event.startAt },
        end: { dateTime: event.endAt },
        extendedProperties: {
          private: { [AROHAFLOW_EXTENDED_PROPERTY]: event.externalKey },
        },
      };

      const existing = await findByExternalKey(googleCalendarId, event.externalKey);
      if (existing?.id) {
        await calendarApi.events.patch({
          calendarId: googleCalendarId,
          eventId: existing.id,
          requestBody: body,
        });
        return { ...event, googleEventId: existing.id };
      }

      const inserted = await calendarApi.events.insert({
        calendarId: googleCalendarId,
        requestBody: body,
      });
      return { ...event, googleEventId: inserted.data?.id };
    },

    async deleteEvent({ calendarId, externalKey }) {
      const googleCalendarId = await resolveCalendarId(calendarId || AROHAFLOW_CALENDAR_ID);
      const existing = await findByExternalKey(googleCalendarId, externalKey);
      if (!existing?.id) return;
      await calendarApi.events.delete({
        calendarId: googleCalendarId,
        eventId: existing.id,
      });
    },
  };
}

/**
 * Resolve logical "ArohaFlow" calendar id to a Google calendar id.
 * Prefers env override; otherwise finds a calendar whose summary is ArohaFlow.
 */
export function createArohaflowCalendarResolver(calendarApi, env = {}) {
  let cached = env.AROHAFLOW_GOOGLE_CALENDAR_ID || null;

  return async function resolveCalendarId(logicalId) {
    if (logicalId !== AROHAFLOW_CALENDAR_ID) {
      throw new Error(`Calendar write only allowed for ${AROHAFLOW_CALENDAR_ID}, got: ${logicalId}`);
    }
    if (cached) return cached;

    const listed = await calendarApi.calendarList.list({ maxResults: 250 });
    const match = (listed.data.items || []).find((c) => c.summary === AROHAFLOW_CALENDAR_ID);
    if (!match?.id) {
      throw new Error(
        'Dedicated ArohaFlow Google Calendar not found. Create a calendar named "ArohaFlow" or set AROHAFLOW_GOOGLE_CALENDAR_ID.',
      );
    }
    cached = match.id;
    return cached;
  };
}
