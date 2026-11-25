/**
 * Habit rules (ADR-0010): Rolling Consistency, Minimum Version, Seasons,
 * Quiet habits and the Weekly Grade. Pure functions over plain data so the
 * Agent Service can adopt the same rules when the Store carries levels and Seasons.
 *
 * Habit:    { id, label, scheduledDays: number[] (0 = Sunday), timeAnchor?, minimum?: { label }, season?: { reason, from, until }, restartedOn? }
 *           restartedOn: set when a quiet habit is picked back up; earlier misses no longer count.
 * Check-in: { habitId, date: 'YYYY-MM-DD', level: 'full' | 'minimum' }
 */

export const CONSISTENCY_WINDOW_DAYS = 14;
export const QUIET_MIN_SCHEDULED = 3;
export const CHECK_IN_POINTS = { full: 10, minimum: 5 };

export const GRADES = [
  { id: 'locked-in', label: 'Locked in', min: 0.9 },
  { id: 'strong', label: 'Strong', min: 0.75 },
  { id: 'solid', label: 'Solid', min: 0.55 },
  { id: 'patchy', label: 'Patchy', min: 0.3 },
  { id: 'reset', label: 'Reset', min: 0 },
];

/* ---------- Dates (UTC noon keys, no time zone drift) ---------- */

export function addDays(dateKey, n) {
  const ms = Date.parse(`${dateKey}T12:00:00.000Z`) + n * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function weekday(dateKey) {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
}

/** Monday of the ISO week containing dateKey. */
export function weekStart(dateKey) {
  const offset = (weekday(dateKey) + 6) % 7;
  return addDays(dateKey, -offset);
}

export function dateRange(fromKey, toKey) {
  const out = [];
  for (let d = fromKey; d <= toKey; d = addDays(d, 1)) out.push(d);
  return out;
}

/* ---------- Per day ---------- */

export function isScheduled(habit, dateKey) {
  return (habit.scheduledDays ?? []).includes(weekday(dateKey));
}

export function inSeason(habit, dateKey) {
  const s = habit.season;
  if (!s?.from) return false;
  return dateKey >= s.from && (!s.until || dateKey <= s.until);
}

export function indexCheckIns(checkIns) {
  const map = new Map();
  for (const c of checkIns ?? []) map.set(`${c.habitId}|${c.date}`, c);
  return map;
}

/**
 * Status of one habit on one day, as of a given date.
 * full | minimum | missed | season | off | open (today, not yet) | future
 */
export function dayStatus(habit, index, dateKey, asOf) {
  if (dateKey > asOf) return 'future';
  const checkIn = index.get(`${habit.id}|${dateKey}`);
  if (checkIn) return checkIn.level === 'minimum' ? 'minimum' : 'full';
  if (inSeason(habit, dateKey)) return 'season';
  if (habit.restartedOn && dateKey < habit.restartedOn) return 'off';
  if (!isScheduled(habit, dateKey)) return 'off';
  if (dateKey === asOf) return 'open';
  return 'missed';
}

const KEPT = new Set(['full', 'minimum']);
const COUNTED = new Set(['full', 'minimum', 'missed']);

/* ---------- Rolling Consistency ---------- */

export function rollingConsistency(habit, index, asOf, windowDays = CONSISTENCY_WINDOW_DAYS) {
  const days = dateRange(addDays(asOf, -(windowDays - 1)), asOf).map((date) => ({
    date,
    status: dayStatus(habit, index, date, asOf),
  }));
  const kept = days.filter((d) => KEPT.has(d.status)).length;
  const minimum = days.filter((d) => d.status === 'minimum').length;
  const scheduled = days.filter((d) => COUNTED.has(d.status)).length;
  return {
    days,
    kept,
    minimum,
    scheduled,
    ratio: scheduled ? kept / scheduled : null,
  };
}

export function isQuiet(consistency) {
  return consistency.kept === 0 && consistency.scheduled >= QUIET_MIN_SCHEDULED;
}

/* ---------- Weekly Grade ---------- */

export function gradeFor(ratio) {
  if (ratio == null) return null;
  return GRADES.find((g) => ratio >= g.min) ?? GRADES[GRADES.length - 1];
}

/**
 * Kept scheduled habit days over scheduled habit days so far this ISO week,
 * across habits that are not quiet. Today counts only once checked in.
 */
export function weeklyGrade(habits, checkIns, asOf) {
  const index = indexCheckIns(checkIns);
  const start = weekStart(asOf);
  const days = dateRange(start, asOf);
  let kept = 0;
  let scheduled = 0;
  for (const habit of habits) {
    if (isQuiet(rollingConsistency(habit, index, asOf))) continue;
    for (const date of days) {
      const status = dayStatus(habit, index, date, asOf);
      if (KEPT.has(status)) kept += 1;
      if (COUNTED.has(status)) scheduled += 1;
    }
  }
  const ratio = scheduled ? kept / scheduled : null;
  return { weekStart: start, kept, scheduled, ratio, grade: gradeFor(ratio) };
}

/* ---------- Check-in ---------- */

export function checkInPoints(level) {
  return CHECK_IN_POINTS[level] ?? 0;
}

/** Returns a new check-in list with today's check-in set (or cleared with level null). */
export function setCheckIn(checkIns, habitId, date, level) {
  const rest = (checkIns ?? []).filter((c) => !(c.habitId === habitId && c.date === date));
  return level ? [...rest, { habitId, date, level }] : rest;
}

/* ---------- The screen's read ---------- */

/**
 * Groups habits for the Habits screen: due today, on a Season, gone quiet.
 */
export function buildHabitsView({ habits, checkIns, asOf }) {
  const index = indexCheckIns(checkIns);
  const rows = habits.map((habit) => {
    const consistency = rollingConsistency(habit, index, asOf);
    return {
      habit,
      consistency,
      today: dayStatus(habit, index, asOf, asOf),
      quiet: isQuiet(consistency),
      seasonNow: inSeason(habit, asOf),
    };
  });
  return {
    asOf,
    week: weeklyGrade(habits, checkIns, asOf),
    active: rows.filter((r) => !r.quiet && !r.seasonNow),
    season: rows.filter((r) => r.seasonNow),
    quiet: rows.filter((r) => r.quiet && !r.seasonNow),
  };
}
