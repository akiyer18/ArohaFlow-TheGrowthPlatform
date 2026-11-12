import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeCalendarRead } from '../src/adapters/fakeCalendarRead.js';
import { ActionStatus, BlockKind, DayPlanStatus, MicroactionStatus } from '../src/domain/statuses.js';

describe('propose_day_plan', () => {
  it('builds Fixed Blocks and places open Microactions up to WIP limits', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.seedGoals([
      {
        id: 'g1',
        title: 'Ship OS',
        actions: [
          {
            id: 'a1',
            title: 'ArohaFlow',
            status: ActionStatus.ACTIVE,
            microactions: [
              { id: 'ma1', title: 'Wire Store', status: MicroactionStatus.OPEN, publishToCalendar: false },
              { id: 'ma2', title: 'Gmail fake', status: MicroactionStatus.OPEN, publishToCalendar: true },
              { id: 'ma3', title: 'Extra 3', status: MicroactionStatus.OPEN },
              { id: 'ma4', title: 'Extra 4', status: MicroactionStatus.OPEN },
              { id: 'ma5', title: 'Extra 5', status: MicroactionStatus.OPEN },
              { id: 'ma6', title: 'Extra 6 should wait', status: MicroactionStatus.OPEN },
            ],
          },
        ],
      },
    ]);

    const agent = createAgentService({ clock, store });
    const plan = await agent.proposeDayPlan();

    expect(plan.status).toBe(DayPlanStatus.PROPOSED);
    expect(plan.blocks.some((b) => b.kind === BlockKind.FIXED && b.purpose === 'gym')).toBe(true);
    expect(plan.blocks.some((b) => b.kind === BlockKind.FIXED && b.purpose === 'wind-down')).toBe(true);
    const flexible = plan.blocks.filter((b) => b.kind === BlockKind.FLEXIBLE);
    // Work window 09:00–18:00 fits four 2h Flexible Blocks; fifth open Microaction waits.
    expect(flexible).toHaveLength(4);
    expect(flexible.map((b) => b.microactionId)).toEqual(['ma1', 'ma2', 'ma3', 'ma4']);
    expect(flexible.map((b) => b.microactionId)).not.toContain('ma6');
  });

  it('does not reshuffle a Locked Day Plan', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.LOCKED,
      blocks: [{ id: 'b1', kind: BlockKind.FIXED, purpose: 'gym' }],
    });

    const agent = createAgentService({ clock, store });
    const plan = await agent.proposeDayPlan();
    expect(plan.status).toBe(DayPlanStatus.LOCKED);
    expect(plan.blocks).toHaveLength(1);
  });

  it('places Flexible Blocks in work-window gaps around synced Calendar Events', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    const calendarRead = createFakeCalendarRead([
      {
        id: 'gcal-interview',
        title: 'Interview',
        startAt: '2026-11-12T14:00:00.000Z',
        endAt: '2026-11-12T15:00:00.000Z',
      },
      {
        id: 'gcal-other-day',
        title: 'Tomorrow standup',
        startAt: '2026-11-13T10:00:00.000Z',
        endAt: '2026-11-13T10:30:00.000Z',
      },
    ]);
    await store.seedGoals([
      {
        id: 'g1',
        title: 'Ship OS',
        actions: [
          {
            id: 'a1',
            title: 'ArohaFlow',
            status: ActionStatus.ACTIVE,
            microactions: [
              { id: 'ma1', title: 'Wire Store', status: MicroactionStatus.OPEN },
              { id: 'ma2', title: 'Gmail fake', status: MicroactionStatus.OPEN },
              { id: 'ma3', title: 'Lock path', status: MicroactionStatus.OPEN },
              { id: 'ma4', title: 'Should not fit after interview gap', status: MicroactionStatus.OPEN },
            ],
          },
        ],
      },
    ]);

    const agent = createAgentService({ clock, store, calendarRead });
    await agent.syncCalendar();
    const plan = await agent.proposeDayPlan();

    const flexible = plan.blocks.filter((b) => b.kind === BlockKind.FLEXIBLE);
    expect(flexible.map((b) => ({ id: b.microactionId, startAt: b.startAt, endAt: b.endAt }))).toEqual([
      { id: 'ma1', startAt: '2026-11-12T09:00:00.000Z', endAt: '2026-11-12T11:00:00.000Z' },
      { id: 'ma2', startAt: '2026-11-12T11:00:00.000Z', endAt: '2026-11-12T13:00:00.000Z' },
      { id: 'ma3', startAt: '2026-11-12T15:00:00.000Z', endAt: '2026-11-12T17:00:00.000Z' },
    ]);
  });
});
