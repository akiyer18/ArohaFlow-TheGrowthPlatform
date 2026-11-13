import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { ActionStatus, MicroactionStatus } from '../src/domain/statuses.js';

describe('Goals authoring (#33)', () => {
  it('creates a Goal and lists it from the Store', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    const goal = await agent.upsertGoal({ title: 'Land a platform role' });

    expect(goal.id).toBeTruthy();
    expect(goal.title).toBe('Land a platform role');
    expect(goal.actions).toEqual([]);
    expect(await agent.listGoals()).toEqual([goal]);
  });

  it('updates a Goal title by id and authors Action → Microaction under it', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    const goal = await agent.upsertGoal({ id: 'g1', title: 'Old title' });
    await agent.upsertGoal({ id: 'g1', title: 'Ship daily driver' });

    const action = await agent.upsertAction({
      goalId: 'g1',
      title: 'Build Goals UI',
      status: ActionStatus.ACTIVE,
    });
    const micro = await agent.upsertMicroaction({
      actionId: action.id,
      title: 'Wire upsertGoal HTTP',
      status: MicroactionStatus.OPEN,
    });

    const goals = await agent.listGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0].title).toBe('Ship daily driver');
    expect(goals[0].actions).toEqual([
      {
        id: action.id,
        title: 'Build Goals UI',
        status: ActionStatus.ACTIVE,
        microactions: [
          {
            id: micro.id,
            title: 'Wire upsertGoal HTTP',
            status: MicroactionStatus.OPEN,
          },
        ],
      },
    ]);
    expect(goal.id).toBe('g1');
  });

  it('refuses a fourth Active Action', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    await agent.upsertGoal({ id: 'g1', title: 'WIP Goal' });
    for (let i = 1; i <= 3; i += 1) {
      await agent.upsertAction({
        goalId: 'g1',
        id: `a${i}`,
        title: `Action ${i}`,
        status: ActionStatus.ACTIVE,
      });
    }

    await expect(
      agent.upsertAction({
        goalId: 'g1',
        id: 'a4',
        title: 'Action 4',
        status: ActionStatus.ACTIVE,
      }),
    ).rejects.toThrow(/Max 3 Active Actions/i);
  });
});
