/**
 * Scheduled cadence — morning prepares Today; evening (~17:30) prepares tomorrow without locking.
 * Lives on the Agent Service facade so scheduler/MCP share one seam (no Store bypass).
 */

function nextDateKey(clock) {
  const next = new Date(clock.now());
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * @param {{
 *   syncCalendar: () => Promise<unknown>,
 *   buildEmailDigest: () => Promise<unknown>,
 *   proposeDayPlan: (options?: { date?: string }) => Promise<object>,
 *   clock: { now(): Date, todayDateKey(): string },
 *   store: { appendAgentActivity(entry: object): Promise<void> },
 * }} deps
 */
export async function runMorningCadence(deps) {
  const { syncCalendar, buildEmailDigest, proposeDayPlan, clock, store } = deps;
  await syncCalendar();
  await buildEmailDigest();
  const dayPlan = await proposeDayPlan();
  const date = clock.todayDateKey();

  await store.appendAgentActivity({
    type: 'scheduled_run',
    summary: `Morning run prepared Today (${date}): calendar sync, Email Digest, Day Plan propose`,
    at: clock.now().toISOString(),
  });

  return { date, dayPlan };
}

/**
 * @param {{
 *   syncCalendar: () => Promise<unknown>,
 *   buildEmailDigest: () => Promise<unknown>,
 *   proposeDayPlan: (options?: { date?: string }) => Promise<object>,
 *   clock: { now(): Date, todayDateKey(): string },
 *   store: { appendAgentActivity(entry: object): Promise<void> },
 * }} deps
 */
export async function runEveningCadence(deps) {
  const { syncCalendar, buildEmailDigest, proposeDayPlan, clock, store } = deps;
  await syncCalendar();
  await buildEmailDigest();
  const tomorrowDate = nextDateKey(clock);
  const dayPlan = await proposeDayPlan({ date: tomorrowDate });

  await store.appendAgentActivity({
    type: 'scheduled_run',
    summary: `Evening (~17:30) run refreshed digest/calendar and proposed Day Plan for ${tomorrowDate} (not locked)`,
    at: clock.now().toISOString(),
  });

  return { tomorrowDate, dayPlan };
}
