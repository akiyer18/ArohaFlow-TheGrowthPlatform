import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { BlockKind, DayPlanStatus } from '../src/domain/statuses.js';

describe('Intention on Day Plan (#20)', () => {
  it('lock with Intention → listToday includes it on the Locked Day Plan', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [
        {
          id: 'b1',
          kind: BlockKind.FLEXIBLE,
          purpose: 'deep-work',
          microactionId: 'ma1',
          publishToCalendar: false,
          startAt: '2026-11-12T10:00:00.000Z',
          endAt: '2026-11-12T12:00:00.000Z',
          title: 'Wire Store',
        },
      ],
    });

    const agent = createAgentService({ clock, store });
    const locked = await agent.lockDayPlan({
      date: '2026-11-12',
      confirmed: true,
      intention: 'Ship the Store seam before lunch.',
    });

    expect(locked.status).toBe(DayPlanStatus.LOCKED);
    expect(locked.intention).toBe('Ship the Store seam before lunch.');

    const today = await agent.listToday();
    expect(today.dayPlan.intention).toBe('Ship the Store seam before lunch.');
    expect(today.intention).toBe('Ship the Store seam before lunch.');
  });

  it('empty / unlocked day exposes null Intention', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    const empty = await agent.listToday();
    expect(empty.intention).toBeNull();
    expect(empty.dayPlan.intention).toBeNull();

    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [],
    });
    const proposed = await agent.listToday();
    expect(proposed.intention).toBeNull();
    expect(proposed.dayPlan.intention ?? null).toBeNull();
  });
});
