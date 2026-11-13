/**
 * Calendar View module — month/day surface of Calendar Events + Day Plan Blocks
 * + habit schedule anchors / heatmap. Deep read interface; writes stay on the
 * Agent Service tool facade.
 */
export { getCalendarMonth } from './getCalendarMonth.js';
export {
  WEEKDAYS,
  monthLabel,
  daysInMonth,
  weekdayUtc,
  buildMonthCells,
  buildWeekCells,
  indexByDate,
} from './monthGrid.js';
export { getCalendarWeek } from './getCalendarWeek.js';
