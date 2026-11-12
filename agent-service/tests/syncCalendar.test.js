import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeCalendarRead } from '../src/adapters/fakeCalendarRead.js';

describe('sync_calendar', () => {
  it('upserts Calendar Events and does not duplicate on a second sync', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    const calendarRead = createFakeCalendarRead([
      {
        id: 'gcal-1',
        title: 'Interview',
        startAt: '2026-11-12T14:00:00.000Z',
        endAt: '2026-11-12T15:00:00.000Z',
      },
      {
        id: 'gcal-2',
        title: 'Gym',
        startAt: '2026-11-12T07:00:00.000Z',
        endAt: '2026-11-12T08:00:00.000Z',
      },
    ]);

    const agent = createAgentService({ clock, store, calendarRead });

    const first = await agent.syncCalendar();
    const second = await agent.syncCalendar();

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    const stored = await store.listCalendarEvents();
    expect(stored).toHaveLength(2);
    expect(stored.map((e) => e.externalId).sort()).toEqual(['gcal-1', 'gcal-2']);
  });
});
