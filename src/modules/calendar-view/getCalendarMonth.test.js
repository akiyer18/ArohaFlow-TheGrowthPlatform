import { describe, it, expect } from 'vitest';
import {
  getCalendarMonth,
  getCalendarWeek,
  buildMonthCells,
  buildWeekCells,
  monthLabel,
} from './index.js';

describe('Calendar View module (#4)', () => {
  it('exposes a small month read surface without legacy service fan-in', async () => {
    const view = await getCalendarMonth({ month: '2026-11' });

    expect(view.month).toBe('2026-11');
    expect(view.habits[0]).toMatchObject({
      id: 'gym',
      timeAnchor: '07:00',
      scheduledDays: expect.any(Array),
    });
    expect(view.events[0]).toMatchObject({ externalId: 'meet-1' });
    expect(view.dayPlans[0].blocks.length).toBeGreaterThan(0);
    expect(view.habitDays.some((d) => d.status === 'off')).toBe(true);
    expect(view.habitConsistency[0].consistencyStreak).toBeGreaterThanOrEqual(0);
  });

  it('builds a Sunday-start month grid for November 2026', () => {
    expect(monthLabel('2026-11')).toMatch(/November/);
    const cells = buildMonthCells('2026-11');
    // 2026-11-01 is Sunday → no leading pads
    expect(cells[0]).toBe('2026-11-01');
    expect(cells).toHaveLength(30);
  });

  it('exposes a week surface filtered from the month read', async () => {
    expect(buildWeekCells('2026-11-13')).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ]);

    const week = await getCalendarWeek({ date: '2026-11-13' });
    expect(week.weekStart).toBe('2026-11-08');
    expect(week.weekDates).toHaveLength(7);
    expect(week.habitDays.every((d) => week.weekDates.includes(d.date))).toBe(true);
  });
});
