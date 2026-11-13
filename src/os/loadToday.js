import { TODAY_FIXTURE, TOMORROW_PLAN_FIXTURE } from './fixtures/todayFixture';
import { ANALYTICS_FIXTURE } from './fixtures/analyticsFixture';

/**
 * Thin UI loader for the Agent Service `listToday` shape.
 * v1: portfolio-safe fixture when no live bridge is configured.
 * Does not invent a parallel Today API — payload matches the facade.
 */
export async function loadToday() {
  return structuredClone(TODAY_FIXTURE);
}

/** Proposed tomorrow Day Plan for evening lock secondary UX. */
export async function loadTomorrowPlan() {
  return structuredClone(TOMORROW_PLAN_FIXTURE);
}

/** Weekly Analytics: Agent Activity + four measures (fixture-backed for #25). */
export async function loadAnalytics() {
  return structuredClone(ANALYTICS_FIXTURE);
}
