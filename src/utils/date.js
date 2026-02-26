/**
 * Shared date helpers: single source for YYYY-MM-DD and month range.
 */

export function toDateKey(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMonthRange(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return {
    startDate: toDateKey(first),
    endDate: toDateKey(last),
    endDateEod: toDateKey(last) + 'T23:59:59.999Z',
  };
}
