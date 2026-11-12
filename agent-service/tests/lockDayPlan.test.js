import { describe, it, expect, vi } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeCalendarWrite } from '../src/adapters/fakeCalendarWrite.js';

describe('lock_day_plan', () => {
  it('does not publish without explicit confirmation', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: 'proposed',
      blocks: [
        {
          id: 'b1',
          kind: 'flexible',
          purpose: 'deep-work',
          microactionId: 'ma1',
          publishToCalendar: true,
          startAt: '2026-11-12T10:00:00.000Z',
          endAt: '2026-11-12T12:00:00.000Z',
          title: 'Wire Store',
        },
      ],
    });
    const calendarWrite = createFakeCalendarWrite();
    const spy = vi.spyOn(calendarWrite, 'upsertEvent');

    const agent = createAgentService({ clock, store, calendarWrite });
    await expect(agent.lockDayPlan({ date: '2026-11-12', confirmed: false })).rejects.toThrow(
      /confirm/i,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('locks and publishes opted-in Blocks only to the ArohaFlow calendar', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: 'proposed',
      blocks: [
        {
          id: 'b1',
          kind: 'flexible',
          purpose: 'deep-work',
          microactionId: 'ma1',
          publishToCalendar: true,
          startAt: '2026-11-12T10:00:00.000Z',
          endAt: '2026-11-12T12:00:00.000Z',
          title: 'Wire Store',
        },
        {
          id: 'b2',
          kind: 'flexible',
          purpose: 'deep-work',
          microactionId: 'ma2',
          publishToCalendar: false,
          startAt: '2026-11-12T13:00:00.000Z',
          endAt: '2026-11-12T15:00:00.000Z',
          title: 'Skip me',
        },
      ],
    });
    const calendarWrite = createFakeCalendarWrite();

    const agent = createAgentService({ clock, store, calendarWrite });
    const plan = await agent.lockDayPlan({ date: '2026-11-12', confirmed: true });

    expect(plan.status).toBe('locked');
    expect(calendarWrite.events).toHaveLength(1);
    expect(calendarWrite.events[0].calendarId).toBe('ArohaFlow');
    expect(calendarWrite.events[0].title).toBe('Wire Store');
  });
});
