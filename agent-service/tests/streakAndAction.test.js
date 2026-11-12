import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { ActionStatus, MicroactionStatus } from '../src/domain/statuses.js';

describe('Action Completion and Streak', () => {
  it('awards Action Completion once and bumps Streak when Daily Point Target is met', async () => {
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
            microactions: [{ id: 'ma1', title: 'Wire Store', status: MicroactionStatus.COMPLETED }],
          },
        ],
      },
    ]);

    const agent = createAgentService({ clock, store });

    const first = await agent.completeAction({ actionId: 'a1' });
    expect(first.awarded).toBe(100);
    expect(first.dailyPoints).toBe(100);
    expect(first.actionStatus).toBe(ActionStatus.COMPLETED);

    const duplicate = await agent.completeAction({ actionId: 'a1' });
    expect(duplicate.awarded).toBe(0);
    expect(duplicate.dailyPoints).toBe(100);

    const today = await agent.listToday();
    expect(today.dailyPoints).toBe(100);
    expect(today.streak).toEqual({ count: 1, freezeRemainingThisWeek: 1 });
  });

  it('preserves Streak with one freeze per week on a miss, then resets when freeze is spent', async () => {
    const store = createMemoryStore();
    // Mon–Tue same ISO week as Wed/Thu misses (2026-11-09 is Monday).
    await store.recordStreakTargetMet('2026-11-09');
    await store.recordStreakTargetMet('2026-11-10');
    await store.addDailyPoints('2026-11-11', 20);
    await store.addDailyPoints('2026-11-12', 0);

    const clock = createFixedClock(new Date('2026-11-13T09:00:00.000Z'));
    const agent = createAgentService({ clock, store });

    const withFreeze = await agent.evaluateStreak({ date: '2026-11-11' });
    expect(withFreeze).toEqual({ count: 2, freezeRemainingThisWeek: 0 });

    const withoutFreeze = await agent.evaluateStreak({ date: '2026-11-12' });
    expect(withoutFreeze).toEqual({ count: 0, freezeRemainingThisWeek: 0 });
  });
});
