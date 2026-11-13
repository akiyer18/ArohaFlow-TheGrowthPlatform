import { CALENDAR_VIEW_FIXTURE } from '../../os/fixtures/calendarFixture.js';

/**
 * Calendar View read module — small interface for the month surface.
 *
 * Returns glossary-shaped Calendar Events, Day Plan Blocks, habit anchors,
 * and heatmap cells. Plan lock / Calendar Publish stay on the Agent Service
 * facade (ADR-0005). Callers must not fan in legacy *Service query builders.
 *
 * Adapter today: fixture matching `listCalendarView`. Swap for a live Agent
 * bridge later without changing this interface.
 *
 * @param {{ month?: string }} [input] YYYY-MM
 * @returns {Promise<{
 *   month: string,
 *   habits: object[],
 *   habitDays: object[],
 *   habitConsistency: object[],
 *   events: object[],
 *   dayPlans: object[],
 * }>}
 */
export async function getCalendarMonth(input = {}) {
  const month = input.month ?? CALENDAR_VIEW_FIXTURE.month;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('getCalendarMonth requires month as YYYY-MM');
  }

  const payload = structuredClone(CALENDAR_VIEW_FIXTURE);
  // Fixture is anchored to one demo month; live adapter will filter by month.
  if (month !== payload.month) {
    return {
      month,
      habits: payload.habits,
      habitDays: [],
      habitConsistency: payload.habits.map((h) => ({
        habitId: h.id,
        label: h.label,
        consistencyStreak: 0,
        scheduledDaysInMonth: 0,
        checkInsInMonth: 0,
      })),
      events: [],
      dayPlans: [],
    };
  }
  return payload;
}
