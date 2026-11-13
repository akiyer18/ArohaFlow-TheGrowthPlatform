/** Pure month-grid helpers for Calendar View (UTC date keys). */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString([], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export function weekdayUtc(dateKey) {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
}

/** Leading null pads + date keys for a Sunday-start month grid. */
export function buildMonthCells(month) {
  const dates = daysInMonth(month);
  const lead = weekdayUtc(dates[0]);
  return [...Array.from({ length: lead }, () => null), ...dates];
}

export function indexByDate(items, dateOf) {
  const map = new Map();
  for (const item of items ?? []) {
    const date = dateOf(item);
    if (!date) continue;
    const list = map.get(date) ?? [];
    list.push(item);
    map.set(date, list);
  }
  return map;
}

/** Seven UTC date keys for the week containing `dateKey` (Sunday start). */
export function buildWeekCells(dateKey) {
  const weekday = weekdayUtc(dateKey);
  const startMs = Date.parse(`${dateKey}T12:00:00.000Z`) - weekday * 24 * 60 * 60 * 1000;
  return Array.from({ length: 7 }, (_, i) =>
    new Date(startMs + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}
