import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';

describe('list_today', () => {
  it('returns an empty Today for a frozen date', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    const today = await agent.listToday();

    expect(today.date).toBe('2026-11-12');
    expect(today.dayPlan).toEqual({ date: '2026-11-12', status: 'empty', blocks: [] });
    expect(today.emailDigest).toEqual([]);
    expect(today.dailyPoints).toBe(0);
    expect(today.dailyPointTarget).toBe(100);
    expect(today.streak).toEqual({ count: 0, freezeRemainingThisWeek: 1 });
    expect(today.agentActivity).toEqual([]);
    expect(today.habitCheckIns).toEqual([]);
  });
});
