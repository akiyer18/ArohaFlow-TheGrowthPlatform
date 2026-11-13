import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { BlockKind, DayPlanStatus } from '../src/domain/statuses.js';

describe('Plan-ready Completion (#21)', () => {
  it('prior-evening lock ⇒ +10 Plan-ready Completion on listToday', async () => {
    const evening = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
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

    const eveningAgent = createAgentService({ clock: evening, store });
    await eveningAgent.lockDayPlan({
      date: '2026-11-12',
      confirmed: true,
      intention: 'Finish the Store seam.',
    });

    const morning = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const todayAgent = createAgentService({ clock: morning, store });
    const today = await todayAgent.listToday();

    expect(today.dailyPoints).toBe(10);
    expect(today.pointsExplanation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'plan_ready',
          points: 10,
        }),
      ]),
    );

    const again = await todayAgent.listToday();
    expect(again.dailyPoints).toBe(10);
  });

  it('no prior lock ⇒ 0 Plan-ready grant', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [],
    });

    const agent = createAgentService({ clock, store });
    const today = await agent.listToday();

    expect(today.dailyPoints).toBe(0);
    expect(today.pointsExplanation.filter((e) => e.type === 'plan_ready')).toHaveLength(0);
  });

  it('same-day morning lock does not grant Plan-ready Completion', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [],
    });

    const agent = createAgentService({ clock, store });
    await agent.lockDayPlan({ date: '2026-11-12', confirmed: true, intention: 'Catch up late.' });
    const today = await agent.listToday();

    expect(today.dailyPoints).toBe(0);
    expect(today.pointsExplanation.filter((e) => e.type === 'plan_ready')).toHaveLength(0);
  });
});
