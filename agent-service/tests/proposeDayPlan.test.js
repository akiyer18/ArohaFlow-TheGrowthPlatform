import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';

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
            status: 'active',
            microactions: [
              { id: 'ma1', title: 'Wire Store', status: 'open', publishToCalendar: false },
              { id: 'ma2', title: 'Gmail fake', status: 'open', publishToCalendar: true },
              { id: 'ma3', title: 'Extra 3', status: 'open' },
              { id: 'ma4', title: 'Extra 4', status: 'open' },
              { id: 'ma5', title: 'Extra 5', status: 'open' },
              { id: 'ma6', title: 'Extra 6 should wait', status: 'open' },
            ],
          },
        ],
      },
    ]);

    const agent = createAgentService({ clock, store });
    const plan = await agent.proposeDayPlan();

    expect(plan.status).toBe('proposed');
    expect(plan.blocks.some((b) => b.kind === 'fixed' && b.purpose === 'gym')).toBe(true);
    expect(plan.blocks.some((b) => b.kind === 'fixed' && b.purpose === 'wind-down')).toBe(true);
    const flexible = plan.blocks.filter((b) => b.kind === 'flexible');
    expect(flexible).toHaveLength(5);
    expect(flexible.map((b) => b.microactionId)).not.toContain('ma6');
  });

  it('does not reshuffle a Locked Day Plan', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: 'locked',
      blocks: [{ id: 'b1', kind: 'fixed', purpose: 'gym' }],
    });

    const agent = createAgentService({ clock, store });
    const plan = await agent.proposeDayPlan();
    expect(plan.status).toBe('locked');
    expect(plan.blocks).toHaveLength(1);
  });
});
