import { getCalendarMonth } from './getCalendarMonth.js';
import { buildWeekCells } from './monthGrid.js';

/**
 * Week surface for Calendar View — same glossary shape as the month read,
 * filtered to the Sunday-start week containing `date`.
 *
 * @param {{ date?: string }} [input] YYYY-MM-DD (defaults to today UTC)
 */
export async function getCalendarWeek(input = {}) {
  const date =
    input.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('getCalendarWeek requires date as YYYY-MM-DD');
  }

  const weekDates = buildWeekCells(date);
  const month = date.slice(0, 7);
  const monthView = await getCalendarMonth({ month });
  const inWeek = new Set(weekDates);

  return {
    weekStart: weekDates[0],
    weekDates,
    habits: monthView.habits,
    habitDays: monthView.habitDays.filter((d) => inWeek.has(d.date)),
    habitConsistency: monthView.habitConsistency,
    events: (monthView.events ?? []).filter((e) => inWeek.has(e.startAt?.slice(0, 10))),
    dayPlans: (monthView.dayPlans ?? []).filter((p) => inWeek.has(p.date)),
  };
}
