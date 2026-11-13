import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';

describe('Calendar View habits (#26)', () => {
  it('stores habits with scheduled days and a time anchor', async () => {
    const clock = createFixedClock(new Date('2026-11-13T12:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    await agent.upsertHabit({
      id: 'gym',
      label: 'Gym',
      scheduledDays: [1, 2, 3, 4, 5],
      timeAnchor: '07:00',
    });

    const habits = await agent.listHabits();
    expect(habits).toEqual([
      {
        id: 'gym',
        label: 'Gym',
        scheduledDays: [1, 2, 3, 4, 5],
        timeAnchor: '07:00',
      },
    ]);
  });

  it('unscheduled days do not break habit consistency; missed scheduled days do', async () => {
    // Friday 2026-11-13. Gym Mon–Fri (1–5).
    const clock = createFixedClock(new Date('2026-11-13T12:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    await agent.upsertHabit({
      id: 'gym',
      label: 'Gym',
      scheduledDays: [1, 2, 3, 4, 5],
      timeAnchor: '07:00',
    });

    // Fri 6 done → Sat/Sun off (no check-in) → Mon 9 done → Tue 10 missed → …
    // Consistency as of Fri 13 looking back: Fri13 done, Thu12 done, Wed11 done,
    // Tue10 missed → streak 3. Weekend gaps never break.
    for (const date of [
      '2026-11-06',
      '2026-11-09',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]) {
      await store.saveHabitCheckIn(date, {
        habitId: 'gym',
        label: 'Gym',
        at: `${date}T08:00:00.000Z`,
      });
    }

    const view = await agent.listCalendarView({ month: '2026-11' });
    const gym = view.habitConsistency.find((h) => h.habitId === 'gym');
    expect(gym.consistencyStreak).toBe(3);

    const tue = view.habitDays.find((d) => d.date === '2026-11-10' && d.habitId === 'gym');
    expect(tue).toEqual({
      date: '2026-11-10',
      habitId: 'gym',
      scheduled: true,
      checkedIn: false,
      status: 'missed',
    });

    const sat = view.habitDays.find((d) => d.date === '2026-11-07' && d.habitId === 'gym');
    expect(sat.status).toBe('off');
    expect(sat.scheduled).toBe(false);
  });

  it('listCalendarView exposes habit time anchors for the month surface', async () => {
    const clock = createFixedClock(new Date('2026-11-13T12:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    await agent.upsertHabit({
      id: 'read',
      label: 'Read 20 min',
      scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      timeAnchor: '21:30',
    });

    const view = await agent.listCalendarView({ month: '2026-11' });
    expect(view.month).toBe('2026-11');
    expect(view.habits[0].timeAnchor).toBe('21:30');
    expect(view.habitDays.filter((d) => d.habitId === 'read' && d.scheduled)).toHaveLength(30);
  });
});
