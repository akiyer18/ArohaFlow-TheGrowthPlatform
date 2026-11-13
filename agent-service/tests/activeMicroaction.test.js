import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { ActionStatus, BlockKind, DayPlanStatus, MicroactionStatus } from '../src/domain/statuses.js';

async function seedDayWithTwoMicros(store) {
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
            { id: 'ma2', title: 'Park demo', status: MicroactionStatus.OPEN },
          ],
        },
      ],
    },
  ]);
  await store.saveDayPlan({
    date: '2026-11-12',
    status: DayPlanStatus.LOCKED,
    intention: 'Finish one Microaction before switching.',
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
      {
        id: 'b2',
        kind: BlockKind.FLEXIBLE,
        purpose: 'deep-work',
        microactionId: 'ma2',
        publishToCalendar: false,
        startAt: '2026-11-12T13:00:00.000Z',
        endAt: '2026-11-12T15:00:00.000Z',
        title: 'Park demo',
      },
    ],
  });
}

describe('Active Microaction (#22)', () => {
  it('starts next Microaction and refuses a second until park or complete', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await seedDayWithTwoMicros(store);
    const agent = createAgentService({ clock, store });

    const started = await agent.startMicroaction({ microactionId: 'ma1' });
    expect(started.activeMicroaction.id).toBe('ma1');

    const today = await agent.listToday();
    expect(today.activeMicroaction.id).toBe('ma1');
    expect(today.nextMicroaction.id).toBe('ma1');

    await expect(agent.startMicroaction({ microactionId: 'ma2' })).rejects.toThrow(/active|park|complete/i);

    await agent.parkMicroaction({ microactionId: 'ma1', reason: 'Context switch for live demo' });
    const afterPark = await agent.listToday();
    expect(afterPark.activeMicroaction).toBeNull();

    const second = await agent.startMicroaction({ microactionId: 'ma2' });
    expect(second.activeMicroaction.id).toBe('ma2');
  });

  it('completing the Active Microaction clears it and awards points', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await seedDayWithTwoMicros(store);
    const agent = createAgentService({ clock, store });

    await agent.startMicroaction({ microactionId: 'ma1' });
    await agent.completeMicroaction({ microactionId: 'ma1' });

    const today = await agent.listToday();
    expect(today.activeMicroaction).toBeNull();
    expect(today.nextMicroaction.id).toBe('ma2');
    expect(today.dailyPoints).toBeGreaterThanOrEqual(20);
  });

  it('park requires a short reason', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await seedDayWithTwoMicros(store);
    const agent = createAgentService({ clock, store });

    await agent.startMicroaction({ microactionId: 'ma1' });
    await expect(agent.parkMicroaction({ microactionId: 'ma1', reason: '' })).rejects.toThrow(/reason/i);
    await expect(agent.parkMicroaction({ microactionId: 'ma1' })).rejects.toThrow(/reason/i);
  });
});
