import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { BlockKind, DayPlanStatus } from '../src/domain/statuses.js';

function flex(id, startAt, endAt) {
  return {
    id,
    kind: BlockKind.FLEXIBLE,
    purpose: 'deep-work',
    microactionId: id,
    publishToCalendar: false,
    startAt,
    endAt,
    title: id,
  };
}

describe('Evening lock overcommit (#28)', () => {
  it('detects when Flexible Blocks exceed the work-window duration', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [
        {
          id: 'work',
          kind: BlockKind.FIXED,
          purpose: 'work-window',
          title: 'Work window',
          startAt: '2026-11-12T09:00:00.000Z',
          endAt: '2026-11-12T18:00:00.000Z',
        },
        // 6h + 4h = 10h > 9h work window
        flex('ma1', '2026-11-12T09:00:00.000Z', '2026-11-12T15:00:00.000Z'),
        flex('ma2', '2026-11-12T15:00:00.000Z', '2026-11-12T19:00:00.000Z'),
      ],
    });

    const agent = createAgentService({ clock, store });
    const assessment = await agent.assessDayPlanOvercommit({ date: '2026-11-12' });

    expect(assessment.overcommitted).toBe(true);
    expect(assessment.plannedMinutes).toBe(600);
    expect(assessment.availableMinutes).toBe(540);
    expect(assessment.overByMinutes).toBe(60);
  });

  it('lock without acknowledgeOvercommit refuses when overcommitted', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [
        {
          id: 'work',
          kind: BlockKind.FIXED,
          purpose: 'work-window',
          title: 'Work window',
          startAt: '2026-11-12T09:00:00.000Z',
          endAt: '2026-11-12T18:00:00.000Z',
        },
        flex('ma1', '2026-11-12T09:00:00.000Z', '2026-11-12T15:00:00.000Z'),
        flex('ma2', '2026-11-12T15:00:00.000Z', '2026-11-12T19:00:00.000Z'),
      ],
    });

    const agent = createAgentService({ clock, store });
    await expect(
      agent.lockDayPlan({
        date: '2026-11-12',
        confirmed: true,
        intention: 'Too much work',
      }),
    ).rejects.toThrow(/overcommit/i);

    const plan = await store.getDayPlan('2026-11-12');
    expect(plan.status).toBe(DayPlanStatus.PROPOSED);
  });

  it('lock with acknowledgeOvercommit proceeds after warning', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [
        {
          id: 'work',
          kind: BlockKind.FIXED,
          purpose: 'work-window',
          title: 'Work window',
          startAt: '2026-11-12T09:00:00.000Z',
          endAt: '2026-11-12T18:00:00.000Z',
        },
        flex('ma1', '2026-11-12T09:00:00.000Z', '2026-11-12T15:00:00.000Z'),
        flex('ma2', '2026-11-12T15:00:00.000Z', '2026-11-12T19:00:00.000Z'),
      ],
    });

    const agent = createAgentService({ clock, store });
    const locked = await agent.lockDayPlan({
      date: '2026-11-12',
      confirmed: true,
      acknowledgeOvercommit: true,
      intention: 'Accept the squeeze',
    });

    expect(locked.status).toBe(DayPlanStatus.LOCKED);
    expect(locked.intention).toBe('Accept the squeeze');
  });

  it('within budget ⇒ no overcommit; lock without acknowledge succeeds', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [
        {
          id: 'work',
          kind: BlockKind.FIXED,
          purpose: 'work-window',
          title: 'Work window',
          startAt: '2026-11-12T09:00:00.000Z',
          endAt: '2026-11-12T18:00:00.000Z',
        },
        flex('ma1', '2026-11-12T09:00:00.000Z', '2026-11-12T11:00:00.000Z'),
      ],
    });

    const agent = createAgentService({ clock, store });
    const assessment = await agent.assessDayPlanOvercommit({ date: '2026-11-12' });
    expect(assessment.overcommitted).toBe(false);

    const locked = await agent.lockDayPlan({
      date: '2026-11-12',
      confirmed: true,
      intention: 'Steady day',
    });
    expect(locked.status).toBe(DayPlanStatus.LOCKED);
  });
});
