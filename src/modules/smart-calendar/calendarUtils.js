import { toDateKey } from './useCalendarData';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function getWeekdayLabels() {
  return WEEKDAY_LABELS;
}

export function getMonthLabel(monthIndex) {
  return MONTH_LABELS[monthIndex] ?? '';
}

/**
 * Get the 7 days (Sun–Sat) for the week containing the given date.
 */
export function getWeekGridDays(date) {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const result = [];
  for (let i = 0; i < 7; i++) {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    const dateKey = toDateKey(cell);
    const todayKey = toDateKey(new Date());
    result.push({
      date: cell,
      dateKey,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
    });
  }
  return result;
}

/**
 * Build a flat list of { date, dateKey, isCurrentMonth, isToday } for the month grid.
 * Includes leading/trailing days from adjacent months to fill 6 rows × 7.
 */
export function getMonthGridDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const totalDays = last.getDate();
  const endPad = 6 - last.getDay();
  const totalCells = startPad + totalDays + endPad;
  const rows = Math.ceil(totalCells / 7) || 6;
  const cells = rows * 7;
  const todayKey = toDateKey(new Date());
  const result = [];
  const startDate = new Date(year, month, 1 - startPad);
  for (let i = 0; i < cells; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateKey = toDateKey(d);
    const isCurrentMonth = d.getMonth() === month && d.getFullYear() === year;
    const isToday = dateKey === todayKey;
    result.push({ date: d, dateKey, isCurrentMonth, isToday });
  }
  return result;
}
