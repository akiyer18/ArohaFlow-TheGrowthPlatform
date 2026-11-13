import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeLlm } from '../src/adapters/fakeLlm.js';
import { ActionStatus, MicroactionStatus } from '../src/domain/statuses.js';

describe('Weekly Plan propose (#23)', () => {
  it('proposes Action and Microaction candidates via LLM without locking a Day Plan', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    await store.seedGoals([
      {
        id: 'g1',
        title: 'Land a platform role',
        actions: [],
      },
    ]);

    const llm = createFakeLlm({
      rank: () => [],
      proposeWeeklyPlan: async ({ goal }) => ({
        goalId: goal.id,
        actions: [
          {
            title: 'Ship portfolio demo',
            microactions: [
              { title: 'Record 3-minute walkthrough' },
              { title: 'Write README for recruiters' },
            ],
          },
          {
            title: 'Apply to two roles',
            microactions: [{ title: 'Tailor CV for platform seat' }],
          },
        ],
      }),
    });

    const agent = createAgentService({ clock, store, llm });
    const proposal = await agent.proposeWeeklyPlan({ goalId: 'g1' });

    expect(proposal.goalId).toBe('g1');
    expect(proposal.actions).toHaveLength(2);
    expect(proposal.actions[0].microactions).toHaveLength(2);
    expect(proposal.committed).toBe(false);

    const goals = store._state.goals;
    expect(goals[0].actions).toHaveLength(0);

    const plan = await store.getDayPlan(clock.todayDateKey());
    expect(plan).toBeNull();
  });

  it('respects Active Action WIP (max 3) when shaping the proposal', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    await store.seedGoals([
      {
        id: 'g1',
        title: 'Ship OS',
        actions: [
          {
            id: 'a1',
            title: 'Facade',
            status: ActionStatus.ACTIVE,
            microactions: [{ id: 'ma1', title: 'Done bit', status: MicroactionStatus.OPEN }],
          },
          {
            id: 'a2',
            title: 'UI',
            status: ActionStatus.ACTIVE,
            microactions: [],
          },
          {
            id: 'a3',
            title: 'Eval',
            status: ActionStatus.ACTIVE,
            microactions: [],
          },
        ],
      },
      { id: 'g2', title: 'Job hunt', actions: [] },
    ]);

    const llm = createFakeLlm({
      rank: () => [],
      proposeWeeklyPlan: async () => ({
        goalId: 'g2',
        actions: [
          { title: 'Should not fit', microactions: [{ title: 'Nope' }] },
          { title: 'Also no', microactions: [{ title: 'Nope' }] },
        ],
      }),
    });

    const agent = createAgentService({ clock, store, llm });
    const proposal = await agent.proposeWeeklyPlan({ goalId: 'g2' });

    expect(proposal.actions).toHaveLength(0);
    expect(proposal.wipRemaining).toBe(0);
  });
});
