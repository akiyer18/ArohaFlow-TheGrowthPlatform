import { describe, it, expect } from 'vitest';
import { createSchedulerLoop } from '../src/schedulerLoop.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';

describe('scheduler loop', () => {
  it('reports a failed cadence run, keeps looping, and retries on the next tick', async () => {
    const clock = createFixedClock(new Date('2026-11-25T18:00:00.000Z'));
    let attempts = 0;
    const errors = [];
    const runs = [];
    const loop = createSchedulerLoop({
      clock,
      sleep: async () => {},
      scheduler: {
        async runMorning() {
          return {};
        },
        async runEvening() {
          attempts += 1;
          if (attempts === 1) throw new Error('invalid_grant');
          return { ok: true };
        },
      },
      onError: (err) => errors.push(err.message),
      onRun: (kind) => runs.push(kind),
    });

    await loop.start({ maxTicks: 3 });

    expect(errors).toEqual(['invalid_grant']);
    expect(attempts).toBe(2);
    expect(runs).toEqual(['evening']);
  });
});
