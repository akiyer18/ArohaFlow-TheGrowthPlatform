/**
 * Streak calculation for habits.
 * frequency_type: 'daily' | 'weekly_count' | 'specific_days'
 * frequency_value: { count?: number, days?: number[] } (days 0=Sun..6=Sat for specific_days)
 * Logs: array of { date: string (YYYY-MM-DD), count: number }
 */

import { toDateKey } from './date';

const getDayOfWeek = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay();
};

/** Check if a single day counts as "required" for the habit */
export function isRequiredDay(dateStr, frequencyType, frequencyValue, startDateStr) {
  if (!dateStr || dateStr < startDateStr) return false;
  const dayOfWeek = getDayOfWeek(dateStr);

  if (frequencyType === 'daily') return true;
  if (frequencyType === 'specific_days') {
    const days = frequencyValue?.days ?? [];
    return days.includes(dayOfWeek);
  }
  if (frequencyType === 'weekly_count') {
    return true;
  }
  return false;
}

/** Check if the day is "complete" (met target). */
export function isDayComplete(dateStr, count, targetPerDay, frequencyType, frequencyValue) {
  const target = targetPerDay ?? 1;
  if (frequencyType === 'weekly_count') {
    const weekCount = frequencyValue?.count ?? 1;
    return count >= weekCount;
  }
  return count >= target;
}

/**
 * Build a set of date keys that are "required" from startDate up to today.
 * For weekly_count we treat every day as a potential completion day (any N per week).
 */
function getRequiredDatesFromStart(startDateStr, upToDateStr, frequencyType, frequencyValue) {
  const out = [];
  const start = new Date(startDateStr + 'T12:00:00');
  const end = new Date(upToDateStr + 'T12:00:00');
  const days = frequencyValue?.days ?? [];
  const weekCount = frequencyType === 'weekly_count' ? (frequencyValue?.count ?? 1) : 0;

  for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
    const key = toDateKey(t);
    if (frequencyType === 'daily') out.push(key);
    else if (frequencyType === 'specific_days' && days.includes(t.getDay())) out.push(key);
    else if (frequencyType === 'weekly_count') out.push(key);
  }
  return out;
}

/**
 * Get current streak (consecutive required days completed ending today or yesterday).
 * Get longest streak (max consecutive required days ever completed).
 */
export function computeStreaks(habit, logs) {
  const frequencyType = habit.frequency_type || 'daily';
  const frequencyValue = habit.frequency_value || {};
  const targetPerDay = habit.target_per_day ?? 1;
  const startDateStr = habit.start_date
    ? toDateKey(habit.start_date)
    : toDateKey(new Date());

  const logByDate = {};
  (logs || []).forEach((log) => {
    const key = toDateKey(log.date);
    logByDate[key] = (logByDate[key] || 0) + (log.count ?? 0);
  });

  const todayStr = toDateKey(new Date());

  if (frequencyType === 'weekly_count') {
    return computeStreaksWeekly(logByDate, startDateStr, todayStr, frequencyValue);
  }

  const requiredSet = new Set(
    getRequiredDatesFromStart(startDateStr, todayStr, frequencyType, frequencyValue)
  );

  const completedSet = new Set();
  Object.entries(logByDate).forEach(([dateStr, count]) => {
    if (!requiredSet.has(dateStr)) return;
    const target = targetPerDay ?? 1;
    if (count >= target) completedSet.add(dateStr);
  });

  const sortedRequired = Array.from(requiredSet).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let run = 0;

  for (let i = sortedRequired.length - 1; i >= 0; i--) {
    const d = sortedRequired[i];
    if (completedSet.has(d)) {
      run++;
      if (currentStreak === 0 && (d === todayStr || d === toDateKey(new Date(Date.now() - 864e5))))
        currentStreak = run;
    } else {
      if (currentStreak > 0) break;
      run = 0;
    }
  }
  if (currentStreak === 0 && run > 0) currentStreak = run;

  run = 0;
  for (const d of sortedRequired) {
    if (completedSet.has(d)) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else run = 0;
  }

  return { currentStreak, longestStreak };
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day;
  const start = new Date(d);
  start.setDate(diff);
  return toDateKey(start);
}

function computeStreaksWeekly(logByDate, startDateStr, todayStr, frequencyValue) {
  const weekCount = frequencyValue?.count ?? 1;
  const weekCompletions = {};
  Object.entries(logByDate).forEach(([dateStr, count]) => {
    if (dateStr < startDateStr) return;
    const weekKey = getWeekStart(dateStr);
    weekCompletions[weekKey] = (weekCompletions[weekKey] || 0) + count;
  });

  const weekKeys = Object.keys(weekCompletions).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let run = 0;
  const thisWeek = getWeekStart(todayStr);
  const lastWeek = getWeekStart(toDateKey(new Date(Date.now() - 7 * 864e5)));

  for (let i = weekKeys.length - 1; i >= 0; i--) {
    const w = weekKeys[i];
    const met = weekCompletions[w] >= weekCount;
    if (met) {
      run++;
      if (currentStreak === 0 && (w === thisWeek || w === lastWeek)) currentStreak = run;
    } else {
      if (currentStreak > 0) break;
      run = 0;
    }
  }
  if (currentStreak === 0 && run > 0) currentStreak = run;

  run = 0;
  for (const w of weekKeys) {
    if (weekCompletions[w] >= weekCount) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else run = 0;
  }

  return { currentStreak, longestStreak };
}

/**
 * Completion rate for display: required days in range that were completed.
 */
export function completionRateInRange(habit, logs, fromDateStr, toDateStr) {
  const frequencyType = habit.frequency_type || 'daily';
  const frequencyValue = habit.frequency_value || {};
  const targetPerDay = habit.target_per_day ?? 1;
  const startDateStr = habit.start_date ? toDateKey(habit.start_date) : fromDateStr;

  const from = fromDateStr < startDateStr ? startDateStr : fromDateStr;
  const required = getRequiredDatesFromStart(startDateStr, toDateStr, frequencyType, frequencyValue).filter(
    (d) => d >= from && d <= toDateStr
  );
  if (required.length === 0) return { rate: 0, completed: 0, total: 0 };

  const logByDate = {};
  (logs || []).forEach((log) => {
    const key = toDateKey(log.date);
    logByDate[key] = (logByDate[key] || 0) + (log.count ?? 0);
  });

  let completed = 0;
  if (frequencyType === 'weekly_count') {
    const weekCount = frequencyValue?.count ?? 1;
    const weekTotals = {};
    Object.entries(logByDate).forEach(([dateStr, count]) => {
      if (dateStr < from || dateStr > toDateStr) return;
      const w = getWeekStart(dateStr);
      weekTotals[w] = (weekTotals[w] || 0) + count;
    });
    const weeksInRange = new Set();
    for (const d of required) weeksInRange.add(getWeekStart(d));
    completed = Array.from(weeksInRange).filter((w) => (weekTotals[w] || 0) >= weekCount).length;
    return { rate: weeksInRange.size ? (completed / weeksInRange.size) * 100 : 0, completed, total: weeksInRange.size };
  }

  required.forEach((d) => {
    const count = logByDate[d] || 0;
    if (count >= targetPerDay) completed++;
  });
  const total = required.length;
  return { rate: total ? (completed / total) * 100 : 0, completed, total };
}

export { toDateKey, getDayOfWeek };
