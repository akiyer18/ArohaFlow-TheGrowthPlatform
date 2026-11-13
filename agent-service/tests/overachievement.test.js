import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import {
  ActionStatus,
  BlockKind,
  DayPlanStatus,
  MicroactionStatus,
} from '../src/domain/statuses.js';

async function seedTree(store, microIds) {
  await store.seedGoals([
    {
      id: 'g1',
      title: 'Ship OS',
      actions: [
        {
          id: 'a1',
          title: 'ArohaFlow',
          status: ActionStatus.ACTIVE,
          microactions: microIds.map((id) => ({
            id,
            title: id,
            status: MicroactionStatus.OPEN,
          })),
        },
      ],
    },
  ]);
}

async function lockPlanWithMicros(store, dateKey, microIds) {
  await store.saveDayPlan({
    date: dateKey,
    status: DayPlanStatus.LOCKED,
    intention: 'Finish planned work',
    lockedAt: `${dateKey}T17:30:00.000Z`,
    blocks: microIds.map((id, idx) => ({
      id: `flex-${id}`,
      kind: BlockKind.FLEXIBLE,
      purpose: 'deep-work',
      title: id,
      microactionId: id,
      startAt: `${dateKey}T09:00:00.000Z`,
      endAt: `${dateKey}T11:00:00.000Z`,
      order: idx,
    })),
  });
}

describe('Overachievement Completions (#34)', () => {
  it('awards Overachievement points for surplus Completion before 18:00', async () => {
    const clock = createFixedClock(new Date('2026-11-12T16:00:00.000Z'));
    const store = createMemoryStore();
    await seedTree(store, ['planned', 'surplus']);
    await lockPlanWithMicros(store, '2026-11-12', ['planned']);

    const agent = createAgentService({ clock, store });
    const result = await agent.completeMicroaction({ microactionId: 'surplus' });

    expect(result.awarded).toBe(20);
    const today = await agent.listToday();
    expect(today.dailyPoints).toBe(20);
    expect(today.pointsExplanation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'overachievement',
          points: 20,
          microactionId: 'surplus',
        }),
      ]),
    );
  });

  it('does not award Overachievement for surplus Completion at or after 18:00', async () => {
    const clock = createFixedClock(new Date('2026-11-12T18:00:00.000Z'));
    const store = createMemoryStore();
    await seedTree(store, ['planned', 'surplus']);
    await lockPlanWithMicros(store, '2026-11-12', ['planned']);

    const agent = createAgentService({ clock, store });
    const result = await agent.completeMicroaction({ microactionId: 'surplus' });

    expect(result.awarded).toBe(0);
    const today = await agent.listToday();
    expect(today.dailyPoints).toBe(0);
    expect(today.pointsExplanation.filter((e) => e.type === 'overachievement')).toHaveLength(0);
    expect((await store.getMicroaction('surplus')).status).toBe(MicroactionStatus.COMPLETED);
  });

  it('still awards normal Microaction weight for planned Completion after 18:00', async () => {
    const clock = createFixedClock(new Date('2026-11-12T19:30:00.000Z'));
    const store = createMemoryStore();
    await seedTree(store, ['planned']);
    await lockPlanWithMicros(store, '2026-11-12', ['planned']);

    const agent = createAgentService({ clock, store });
    const result = await agent.completeMicroaction({ microactionId: 'planned' });

    expect(result.awarded).toBe(20);
    const today = await agent.listToday();
    expect(today.pointsExplanation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'microaction',
          points: 20,
          microactionId: 'planned',
        }),
      ]),
    );
  });

  it('awards nothing for a Locked plan with Blocks when no Completion occurs', async () => {
    const clock = createFixedClock(new Date('2026-11-12T16:00:00.000Z'));
    const store = createMemoryStore();
    await seedTree(store, ['planned']);
    await lockPlanWithMicros(store, '2026-11-12', ['planned']);

    const agent = createAgentService({ clock, store });
    const today = await agent.listToday();

    expect(today.dayPlan.blocks.length).toBeGreaterThan(0);
    expect(today.dailyPoints).toBe(0);
    expect(today.pointsExplanation.filter((e) => e.type !== 'plan_ready')).toEqual([]);
  });

  it('does not double-award Overachievement on idempotent complete', async () => {
    const clock = createFixedClock(new Date('2026-11-12T15:00:00.000Z'));
    const store = createMemoryStore();
    await seedTree(store, ['planned', 'surplus']);
    await lockPlanWithMicros(store, '2026-11-12', ['planned']);

    const agent = createAgentService({ clock, store });
    await agent.completeMicroaction({ microactionId: 'surplus' });
    const second = await agent.completeMicroaction({ microactionId: 'surplus' });

    expect(second.awarded).toBe(0);
    expect(await store.getDailyPoints('2026-11-12')).toBe(20);
    expect(
      (await store.listCompletions('2026-11-12')).filter((e) => e.type === 'overachievement'),
    ).toHaveLength(1);
  });
});
