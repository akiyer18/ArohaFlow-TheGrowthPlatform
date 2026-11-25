import { describe, it, expect } from 'vitest';
import {
  buildHabitsView,
  checkInPoints,
  dayStatus,
  gradeFor,
  indexCheckIns,
  isQuiet,
  rollingConsistency,
  setCheckIn,
  weekStart,
  weeklyGrade,
  getHabits,
  createMemoryHabitsStore,
} from './index.js';
import { buildHabitsFixture } from './habitsFixture.js';

const daily = { id: 'read', label: 'Read', scheduledDays: [0, 1, 2, 3, 4, 5, 6] };
const weekdays = { id: 'gym', label: 'Gym', scheduledDays: [1, 2, 3, 4, 5], minimum: { label: 'Walk' } };
const asOf = '2026-11-24'; // Tuesday

function kept(habitId, dates, level = 'full') {
  return dates.map((date) => ({ habitId, date, level }));
}

describe('Rolling Consistency (ADR-0010)', () => {
  it('counts only scheduled days, so weekends never break a weekday habit', () => {
    const c = rollingConsistency(weekdays, indexCheckIns([]), asOf);
    // 14 days ending Tue 24 Nov: 10 weekdays before today; today is open, not missed
    expect(c.scheduled).toBe(9);
    expect(c.days.find((d) => d.date === '2026-11-22').status).toBe('off');
    expect(c.days.find((d) => d.date === asOf).status).toBe('open');
  });

  it('a single miss lowers the count by one instead of resetting it', () => {
    const dates = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23'];
    const all = rollingConsistency(weekdays, indexCheckIns(kept('gym', dates)), asOf);
    const oneMiss = rollingConsistency(weekdays, indexCheckIns(kept('gym', dates.filter((d) => d !== '2026-11-20'))), asOf);
    expect(all.kept).toBe(9);
    expect(oneMiss.kept).toBe(8);
    expect(oneMiss.scheduled).toBe(all.scheduled);
  });

  it('Minimum Version keeps the habit but earns half the points', () => {
    const c = rollingConsistency(weekdays, indexCheckIns(kept('gym', ['2026-11-23'], 'minimum')), asOf);
    expect(c.kept).toBe(1);
    expect(c.minimum).toBe(1);
    expect(checkInPoints('full')).toBe(10);
    expect(checkInPoints('minimum')).toBe(5);
  });

  it('Season days cost nothing', () => {
    const paused = { ...daily, season: { reason: 'Travel', from: '2026-11-18', until: '2026-11-30' } };
    const c = rollingConsistency(paused, indexCheckIns([]), asOf);
    expect(c.days.filter((d) => d.status === 'season')).toHaveLength(7);
    expect(c.scheduled).toBe(7);
  });
});

describe('Quiet habits', () => {
  it('goes quiet after 14 days without a check-in, and a fresh start clears the old misses', () => {
    const c = rollingConsistency(daily, indexCheckIns([]), asOf);
    expect(isQuiet(c)).toBe(true);
    const restarted = rollingConsistency({ ...daily, restartedOn: asOf }, indexCheckIns([]), asOf);
    expect(restarted.scheduled).toBe(0);
    expect(isQuiet(restarted)).toBe(false);
  });
});

describe('Weekly Grade', () => {
  it('maps ratios to the five grades', () => {
    expect(gradeFor(1).label).toBe('Locked in');
    expect(gradeFor(0.8).label).toBe('Strong');
    expect(gradeFor(0.6).label).toBe('Solid');
    expect(gradeFor(0.4).label).toBe('Patchy');
    expect(gradeFor(0.1).label).toBe('Reset');
    expect(gradeFor(null)).toBeNull();
  });

  it('grades the ISO week so far, leaving out quiet habits and an unchecked today', () => {
    expect(weekStart(asOf)).toBe('2026-11-23');
    const checkIns = kept('gym', ['2026-11-12', '2026-11-23']);
    const w = weeklyGrade([weekdays, daily], checkIns, asOf);
    // daily has no check-ins in 14 days → quiet → excluded; gym: Mon kept, today open
    expect(w.scheduled).toBe(1);
    expect(w.kept).toBe(1);
    expect(w.grade.label).toBe('Locked in');
  });
});

describe('check-ins and the screen read', () => {
  it('sets, replaces and clears today’s check-in', () => {
    let list = setCheckIn([], 'gym', asOf, 'full');
    list = setCheckIn(list, 'gym', asOf, 'minimum');
    expect(list).toEqual([{ habitId: 'gym', date: asOf, level: 'minimum' }]);
    expect(setCheckIn(list, 'gym', asOf, null)).toEqual([]);
    expect(dayStatus(weekdays, indexCheckIns(list), asOf, asOf)).toBe('minimum');
  });

  it('groups the fixture into active, Season and quiet', async () => {
    const data = await getHabits({ asOf, store: createMemoryHabitsStore(buildHabitsFixture(asOf)) });
    const view = buildHabitsView(data);
    expect(view.season.map((r) => r.habit.id)).toEqual(['spanish']);
    expect(view.quiet.map((r) => r.habit.id)).toEqual(['journal']);
    expect(view.active.length).toBe(3);
    expect(view.week.grade).not.toBeNull();
  });
});
