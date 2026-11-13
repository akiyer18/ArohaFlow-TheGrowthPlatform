/**
 * Habit schedule + Calendar View month surface (ADR-0003 habit consistency).
 */

function daysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= last; d += 1) {
    days.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function weekdayUtc(dateKey) {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
}

function isScheduled(habit, dateKey) {
  return (habit.scheduledDays ?? []).includes(weekdayUtc(dateKey));
}

/**
 * Consecutive scheduled check-ins ending at asOfDate; unscheduled days are skipped.
 */
export function computeHabitConsistencyStreak(habit, checkInsByDate, asOfDate) {
  const checked = new Set(
    [...checkInsByDate.entries()]
      .filter(([, list]) => list.some((c) => c.habitId === habit.id))
      .map(([date]) => date),
  );

  let streak = 0;
  let cursor = asOfDate;
  while (cursor) {
    if (!isScheduled(habit, cursor)) {
      cursor = prevDateKey(cursor);
      continue;
    }
    if (!checked.has(cursor)) break;
    streak += 1;
    cursor = prevDateKey(cursor);
  }
  return streak;
}

function prevDateKey(dateKey) {
  const ms = Date.parse(`${dateKey}T12:00:00.000Z`) - 24 * 60 * 60 * 1000;
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function normalizeHabit(input) {
  if (!input?.id || !input?.label) {
    throw new Error('upsertHabit requires id and label');
  }
  if (!Array.isArray(input.scheduledDays) || input.scheduledDays.length === 0) {
    throw new Error('upsertHabit requires scheduledDays');
  }
  if (!input.timeAnchor || !/^\d{2}:\d{2}$/.test(input.timeAnchor)) {
    throw new Error('upsertHabit requires timeAnchor as HH:mm');
  }
  return {
    id: input.id,
    label: input.label,
    scheduledDays: [...input.scheduledDays].map(Number).sort((a, b) => a - b),
    timeAnchor: input.timeAnchor,
  };
}

/**
 * @param {{ store: object }} deps
 * @param {{ id: string, label: string, scheduledDays: number[], timeAnchor: string }} input
 */
export async function upsertHabit(deps, input) {
  const habit = normalizeHabit(input);
  await deps.store.upsertHabit(habit);
  return habit;
}

/**
 * @param {{ store: object }} deps
 */
export async function listHabits(deps) {
  return deps.store.listHabits();
}

/**
 * @param {{ store: object, clock: { todayDateKey(): string } }} deps
 * @param {{ month: string }} input  YYYY-MM
 */
export async function listCalendarView(deps, input) {
  const { store, clock } = deps;
  const month = input?.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('listCalendarView requires month as YYYY-MM');
  }

  const habits = await store.listHabits();
  const dates = daysInMonth(month);
  const checkInsByDate = new Map();
  for (const date of dates) {
    checkInsByDate.set(date, await store.getHabitCheckIns(date));
  }

  // Include days before the month start so streak can look back across weekends.
  let lookback = prevDateKey(dates[0]);
  for (let i = 0; i < 14 && lookback; i += 1) {
    if (!checkInsByDate.has(lookback)) {
      checkInsByDate.set(lookback, await store.getHabitCheckIns(lookback));
    }
    lookback = prevDateKey(lookback);
  }

  const asOf = clock.todayDateKey();
  const habitDays = [];
  for (const habit of habits) {
    for (const date of dates) {
      const scheduled = isScheduled(habit, date);
      const checkedIn = (checkInsByDate.get(date) ?? []).some((c) => c.habitId === habit.id);
      let status = 'off';
      if (scheduled) status = checkedIn ? 'done' : date <= asOf ? 'missed' : 'planned';
      habitDays.push({
        date,
        habitId: habit.id,
        scheduled,
        checkedIn,
        status,
      });
    }
  }

  const events = (await store.listCalendarEvents()).filter((event) => {
    const start = event.startAt?.slice(0, 7);
    return start === month;
  });

  const dayPlans = [];
  for (const date of dates) {
    const plan = await store.getDayPlan(date);
    if (plan) dayPlans.push(plan);
  }

  const habitConsistency = habits.map((habit) => {
    const monthDays = habitDays.filter((d) => d.habitId === habit.id && d.scheduled);
    return {
      habitId: habit.id,
      label: habit.label,
      consistencyStreak: computeHabitConsistencyStreak(habit, checkInsByDate, asOf),
      scheduledDaysInMonth: monthDays.length,
      checkInsInMonth: monthDays.filter((d) => d.checkedIn).length,
    };
  });

  return {
    month,
    habits,
    habitDays,
    habitConsistency,
    events,
    dayPlans,
  };
}
