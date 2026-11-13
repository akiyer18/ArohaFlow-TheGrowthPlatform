import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeLlm } from '../src/adapters/fakeLlm.js';
import { ActionStatus, DayPlanStatus, MicroactionStatus } from '../src/domain/statuses.js';

async function proposeSample(agent, store) {
  await store.seedGoals([{ id: 'g1', title: 'Land a platform role', actions: [] }]);
  return agent.proposeWeeklyPlan({ goalId: 'g1' });
}

function llmWithSample() {
  return createFakeLlm({
    rank: () => [],
    proposeWeeklyPlan: async () => ({
      goalId: 'g1',
      actions: [
        {
          title: 'Ship portfolio demo',
          microactions: [
            { title: 'Record 3-minute walkthrough' },
            { title: 'Write README for recruiters' },
          ],
        },
      ],
    }),
  });
}

describe('Weekly Plan accept / edit / schedule (#27)', () => {
  it('edits candidate titles on the stored proposal without committing Goals', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store, llm: llmWithSample() });
    await proposeSample(agent, store);

    const edited = await agent.editWeeklyPlan({
      actions: [
        {
          title: 'Ship portfolio demo (edited)',
          microactions: [{ title: 'Record walkthrough' }, { title: 'Polish README' }],
        },
      ],
    });

    expect(edited.committed).toBe(false);
    expect(edited.actions[0].title).toBe('Ship portfolio demo (edited)');
    expect(edited.actions[0].microactions).toHaveLength(2);

    const goals = await store.listGoals();
    expect(goals[0].actions).toHaveLength(0);
  });

  it('accepts the proposal into Active Actions and Open Microactions without locking a Day Plan', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store, llm: llmWithSample() });
    await proposeSample(agent, store);

    const accepted = await agent.acceptWeeklyPlan();

    expect(accepted.committed).toBe(true);
    expect(accepted.actions).toHaveLength(1);
    expect(accepted.actions[0].id).toBeTruthy();
    expect(accepted.actions[0].status).toBe(ActionStatus.ACTIVE);
    expect(accepted.actions[0].microactions[0].status).toBe(MicroactionStatus.OPEN);
    expect(accepted.actions[0].microactions[0].id).toBeTruthy();

    const goals = await store.listGoals();
    expect(goals[0].actions).toHaveLength(1);
    expect(goals[0].actions[0].title).toBe('Ship portfolio demo');

    const todayPlan = await store.getDayPlan(clock.todayDateKey());
    expect(todayPlan).toBeNull();

    const proposal = await store.getWeeklyPlanProposal();
    expect(proposal.committed).toBe(true);
  });

  it('schedules an accepted Microaction onto a Day Plan without locking Today', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store, llm: llmWithSample() });
    await proposeSample(agent, store);
    const accepted = await agent.acceptWeeklyPlan();
    const microId = accepted.actions[0].microactions[0].id;

    const plan = await agent.scheduleMicroaction({
      microactionId: microId,
      date: '2026-11-16',
    });

    expect(plan.date).toBe('2026-11-16');
    expect(plan.status).toBe(DayPlanStatus.PROPOSED);
    expect(plan.blocks.some((b) => b.microactionId === microId)).toBe(true);

    const today = await agent.listToday();
    expect(today.dayPlan.status).toBe(DayPlanStatus.EMPTY);
    expect(today.dayPlan.blocks).toHaveLength(0);

    const lockedToday = await store.getDayPlan(clock.todayDateKey());
    expect(lockedToday).toBeNull();
  });

  it('scheduling onto today as PROPOSED does not expose next Microaction until Locked', async () => {
    const clock = createFixedClock(new Date('2026-11-14T10:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store, llm: llmWithSample() });
    await proposeSample(agent, store);
    const accepted = await agent.acceptWeeklyPlan();
    const microId = accepted.actions[0].microactions[0].id;

    await agent.scheduleMicroaction({
      microactionId: microId,
      date: clock.todayDateKey(),
    });

    const today = await agent.listToday();
    expect(today.dayPlan.status).toBe(DayPlanStatus.PROPOSED);
    expect(today.nextMicroaction).toBeNull();
    expect(today.intention).toBeNull();
  });
});
