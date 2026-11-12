import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';

describe('completions and Daily Points', () => {
  it('awards Habit Check-in and Microaction Completion idempotently', async () => {
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
            microactions: [{ id: 'ma1', title: 'Wire Store', status: 'open' }],
          },
        ],
      },
    ]);

    const agent = createAgentService({ clock, store });

    await agent.logHabitCheckIn({ habitId: 'gym', label: 'Gym' });
    await agent.logHabitCheckIn({ habitId: 'gym', label: 'Gym' });
    await agent.completeMicroaction({ microactionId: 'ma1' });
    await agent.completeMicroaction({ microactionId: 'ma1' });

    const today = await agent.listToday();
    expect(today.dailyPoints).toBe(30);
    expect(today.habitCheckIns).toHaveLength(1);
  });
});
