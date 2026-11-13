import { describe, it, expect, vi } from 'vitest';
import { createGmailFromGoogleClient } from '../src/adapters/googleGmail.js';
import { createCalendarReadFromGoogleClient } from '../src/adapters/googleCalendarRead.js';
import { createCalendarWriteFromGoogleClient } from '../src/adapters/googleCalendarWrite.js';
import { createGooglePortsFromEnv } from '../src/createGooglePorts.js';
import { assertGmailPortIsReadOnly } from '../src/ports/gmail.js';
import { AROHAFLOW_CALENDAR_ID } from '../src/domain/arohaflowCalendar.js';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeLlm } from '../src/adapters/fakeLlm.js';

describe('live Google adapters (injected clients)', () => {
  it('Gmail adapter maps list/get to the read-only port and rejects write methods', async () => {
    const gmailApi = {
      users: {
        messages: {
          list: vi.fn(async () => ({
            data: { messages: [{ id: 'm1' }, { id: 'm2' }] },
          })),
          get: vi.fn(async ({ id }) => {
            if (id === 'm1') {
              return {
                data: {
                  id: 'm1',
                  snippet: 'Please bring notes',
                  payload: {
                    headers: [
                      { name: 'From', value: 'tutor@uni.ac.uk' },
                      { name: 'Subject', value: 'Seminar' },
                      { name: 'List-Unsubscribe', value: '<mailto:x>' },
                    ],
                  },
                },
              };
            }
            return {
              data: {
                id: 'm2',
                snippet: 'Hi',
                payload: {
                  headers: [
                    { name: 'From', value: 'a@example.com' },
                    { name: 'Subject', value: 'Hello' },
                  ],
                },
              },
            };
          }),
        },
      },
    };

    const gmail = createGmailFromGoogleClient(gmailApi);
    assertGmailPortIsReadOnly(gmail);

    const summaries = await gmail.listMessageSummaries();
    expect(summaries).toEqual([
      {
        id: 'm1',
        from: 'tutor@uni.ac.uk',
        subject: 'Seminar',
        snippet: 'Please bring notes',
        listUnsubscribe: true,
      },
      {
        id: 'm2',
        from: 'a@example.com',
        subject: 'Hello',
        snippet: 'Hi',
        listUnsubscribe: false,
      },
    ]);

    const one = await gmail.getMessage('m2');
    expect(one.subject).toBe('Hello');
  });

  it('Calendar read adapter maps Google events into Calendar Events', async () => {
    const calendarApi = {
      events: {
        list: vi.fn(async () => ({
          data: {
            items: [
              {
                id: 'evt-1',
                summary: 'Standup',
                start: { dateTime: '2026-11-12T11:00:00.000Z' },
                end: { dateTime: '2026-11-12T11:30:00.000Z' },
              },
            ],
          },
        })),
      },
    };

    const calendarRead = createCalendarReadFromGoogleClient(calendarApi);
    const events = await calendarRead.listEvents();
    expect(events).toEqual([
      {
        id: 'evt-1',
        title: 'Standup',
        startAt: '2026-11-12T11:00:00.000Z',
        endAt: '2026-11-12T11:30:00.000Z',
      },
    ]);
  });

  it('Calendar write upserts/deletes only on the ArohaFlow calendar by externalKey', async () => {
    const inserted = [];
    const patched = [];
    const deleted = [];
    const calendarApi = {
      events: {
        list: vi.fn(async ({ calendarId, privateExtendedProperty }) => {
          expect(calendarId).toBe('cal-aroha-real-id');
          expect(privateExtendedProperty).toEqual(['arohaflow_key=2026-11-12:b1']);
          return { data: { items: [] } };
        }),
        insert: vi.fn(async ({ calendarId, requestBody }) => {
          inserted.push({ calendarId, requestBody });
          return { data: { id: 'google-1', ...requestBody } };
        }),
        patch: vi.fn(async (args) => {
          patched.push(args);
          return { data: args.requestBody };
        }),
        delete: vi.fn(async (args) => {
          deleted.push(args);
          return {};
        }),
      },
    };

    const calendarWrite = createCalendarWriteFromGoogleClient(calendarApi, {
      resolveCalendarId: async (logicalId) => {
        expect(logicalId).toBe(AROHAFLOW_CALENDAR_ID);
        return 'cal-aroha-real-id';
      },
    });

    await calendarWrite.upsertEvent({
      calendarId: AROHAFLOW_CALENDAR_ID,
      externalKey: '2026-11-12:b1',
      title: 'Ship OAuth',
      startAt: '2026-11-12T10:00:00.000Z',
      endAt: '2026-11-12T12:00:00.000Z',
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].calendarId).toBe('cal-aroha-real-id');
    expect(inserted[0].requestBody.summary).toBe('Ship OAuth');
    expect(inserted[0].requestBody.extendedProperties.private.arohaflow_key).toBe('2026-11-12:b1');

    calendarApi.events.list = vi.fn(async () => ({
      data: {
        items: [
          {
            id: 'google-1',
            extendedProperties: { private: { arohaflow_key: '2026-11-12:b1' } },
          },
        ],
      },
    }));

    await calendarWrite.deleteEvent({
      calendarId: AROHAFLOW_CALENDAR_ID,
      externalKey: '2026-11-12:b1',
    });
    expect(deleted).toEqual([{ calendarId: 'cal-aroha-real-id', eventId: 'google-1' }]);
  });

  it('createGooglePortsFromEnv uses fakes without credentials and live adapters when env + factory provided', async () => {
    const without = createGooglePortsFromEnv({});
    expect(without.kind).toBe('fake');
    assertGmailPortIsReadOnly(without.gmail);

    const gmailApi = {
      users: {
        messages: {
          list: vi.fn(async () => ({ data: { messages: [] } })),
          get: vi.fn(),
        },
      },
    };
    const calendarApi = {
      events: {
        list: vi.fn(async () => ({ data: { items: [] } })),
        insert: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      },
      calendarList: {
        list: vi.fn(async () => ({
          data: { items: [{ id: 'cal-aroha-real-id', summary: 'ArohaFlow' }] },
        })),
      },
    };

    const withCreds = createGooglePortsFromEnv(
      {
        AROHAFLOW_GOOGLE_CLIENT_ID: 'id',
        AROHAFLOW_GOOGLE_CLIENT_SECRET: 'secret',
        AROHAFLOW_GOOGLE_REFRESH_TOKEN: 'refresh',
      },
      {
        createClients: () => ({ gmailApi, calendarApi }),
      },
    );
    expect(withCreds.kind).toBe('google');
    assertGmailPortIsReadOnly(withCreds.gmail);

    const store = createMemoryStore();
    const agent = createAgentService({
      clock: createFixedClock(new Date('2026-11-12T09:00:00.000Z')),
      store,
      gmail: withCreds.gmail,
      llm: createFakeLlm({ rank: () => [] }),
      calendarRead: withCreds.calendarRead,
      calendarWrite: withCreds.calendarWrite,
    });
    await agent.syncCalendar();
    await agent.buildEmailDigest();
    expect(gmailApi.users.messages.list).toHaveBeenCalled();
    expect(calendarApi.events.list).toHaveBeenCalled();
  });
});
