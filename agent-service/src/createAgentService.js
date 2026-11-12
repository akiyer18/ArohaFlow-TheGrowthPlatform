import { assertGmailPortIsReadOnly } from './ports/gmail.js';
import { buildEmailDigest } from './tools/buildEmailDigest.js';
import { syncCalendar } from './tools/syncCalendar.js';
import { proposeDayPlan } from './tools/proposeDayPlan.js';
import { lockDayPlan } from './tools/lockDayPlan.js';
import { logHabitCheckIn, completeMicroaction } from './tools/completions.js';
import { DayPlanStatus } from './domain/statuses.js';

/**
 * Agent Service tool facade — primary seam for scheduler, MCP, and tests.
 * @param {{ clock: { todayDateKey(): string, now(): Date }, store: object, gmail?: object, llm?: object, calendarRead?: object, calendarWrite?: object }} deps
 */
export function createAgentService(deps) {
  const { clock, store, gmail, llm, calendarRead, calendarWrite } = deps;

  if (gmail) {
    assertGmailPortIsReadOnly(gmail);
  }

  return {
    async listToday() {
      const date = clock.todayDateKey();
      const existingPlan = await store.getDayPlan(date);
      const dayPlan = existingPlan ?? {
        date,
        status: DayPlanStatus.EMPTY,
        blocks: [],
      };

      return {
        date,
        dayPlan,
        emailDigest: await store.getEmailDigest(date),
        dailyPoints: await store.getDailyPoints(date),
        dailyPointTarget: await store.getDailyPointTarget(),
        streak: await store.getStreak(),
        agentActivity: await store.listAgentActivity(),
        habitCheckIns: await store.getHabitCheckIns(date),
      };
    },

    async buildEmailDigest() {
      if (!gmail) throw new Error('Gmail port required for build_email_digest');
      if (!llm) throw new Error('LLM port required for build_email_digest');
      return buildEmailDigest({ store, gmail, llm, clock });
    },

    async syncCalendar() {
      if (!calendarRead) throw new Error('Calendar read port required for sync_calendar');
      return syncCalendar({ store, calendarRead, clock });
    },

    async proposeDayPlan(options) {
      return proposeDayPlan({ store, clock }, options);
    },

    async lockDayPlan(input) {
      return lockDayPlan({ store, calendarWrite, clock }, input);
    },

    async logHabitCheckIn(input) {
      return logHabitCheckIn({ store, clock }, input);
    },

    async completeMicroaction(input) {
      return completeMicroaction({ store, clock }, input);
    },
  };
}
