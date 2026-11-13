import { assertGmailPortIsReadOnly } from './ports/gmail.js';
import { buildEmailDigest } from './tools/buildEmailDigest.js';
import { syncCalendar } from './tools/syncCalendar.js';
import { proposeDayPlan } from './tools/proposeDayPlan.js';
import { lockDayPlan } from './tools/lockDayPlan.js';
import { unlockDayPlan, editDayPlan } from './tools/dayPlanEdit.js';
import { logHabitCheckIn, completeMicroaction, completeAction } from './tools/completions.js';
import {
  startMicroaction,
  parkMicroaction,
  resolveNextMicroaction,
} from './tools/activeMicroaction.js';
import { evaluateStreak } from './tools/streak.js';
import { runMorningCadence, runEveningCadence } from './tools/cadence.js';
import { DayPlanStatus } from './domain/statuses.js';
import { ensurePlanReadyCompletion } from './tools/planReady.js';
import { proposeWeeklyPlan } from './tools/proposeWeeklyPlan.js';
import {
  editWeeklyPlan,
  acceptWeeklyPlan,
  scheduleMicroaction,
} from './tools/weeklyPlanAccept.js';
import { upsertHabit, listHabits, listCalendarView } from './tools/habitCalendar.js';
import { assessDayPlanOvercommit } from './tools/overcommit.js';

/**
 * Agent Service tool facade — primary seam for scheduler, MCP, and tests.
 * @param {{ clock: { todayDateKey(): string, now(): Date }, store: object, gmail?: object, llm?: object, calendarRead?: object, calendarWrite?: object }} deps
 */
export function createAgentService(deps) {
  const { clock, store, gmail, llm, calendarRead, calendarWrite } = deps;

  if (gmail) {
    assertGmailPortIsReadOnly(gmail);
  }

  const facade = {
    async listToday() {
      const date = clock.todayDateKey();
      await ensurePlanReadyCompletion({ store, clock });

      const existingPlan = await store.getDayPlan(date);
      const dayPlan = existingPlan
        ? { ...existingPlan, intention: existingPlan.intention ?? null }
        : {
            date,
            status: DayPlanStatus.EMPTY,
            blocks: [],
            intention: null,
          };

      const activeMicroaction = await store.getActiveMicroaction();
      const nextMicroaction = await resolveNextMicroaction({ dayPlan, store });

      return {
        date,
        dayPlan,
        intention: dayPlan.intention ?? null,
        activeMicroaction,
        nextMicroaction,
        emailDigest: await store.getEmailDigest(date),
        dailyPoints: await store.getDailyPoints(date),
        dailyPointTarget: await store.getDailyPointTarget(),
        pointsExplanation: await store.listCompletions(date),
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

    async proposeWeeklyPlan(input) {
      if (!llm) throw new Error('LLM port required for propose_weekly_plan');
      return proposeWeeklyPlan({ store, llm, clock }, input);
    },

    async editWeeklyPlan(input) {
      return editWeeklyPlan({ store, clock }, input);
    },

    async acceptWeeklyPlan(input) {
      return acceptWeeklyPlan({ store, clock }, input ?? {});
    },

    async scheduleMicroaction(input) {
      return scheduleMicroaction({ store, clock }, input);
    },

    async upsertHabit(input) {
      return upsertHabit({ store }, input);
    },

    async listHabits() {
      return listHabits({ store });
    },

    async listCalendarView(input) {
      return listCalendarView({ store, clock }, input);
    },

    async assessDayPlanOvercommit(input) {
      return assessDayPlanOvercommit({ store }, input);
    },

    async lockDayPlan(input) {
      return lockDayPlan({ store, calendarWrite, clock }, input);
    },

    async unlockDayPlan(input) {
      return unlockDayPlan({ store, clock, calendarWrite }, input);
    },

    async editDayPlan(input) {
      return editDayPlan({ store, clock }, input);
    },

    async logHabitCheckIn(input) {
      return logHabitCheckIn({ store, clock }, input);
    },

    async startMicroaction(input) {
      const date = clock.todayDateKey();
      const dayPlan = await store.getDayPlan(date);
      return startMicroaction({ store }, { ...input, dayPlan, date });
    },

    async parkMicroaction(input) {
      return parkMicroaction({ store, clock }, input);
    },

    async completeMicroaction(input) {
      return completeMicroaction({ store, clock }, input);
    },

    async completeAction(input) {
      return completeAction({ store, clock }, input);
    },

    async evaluateStreak(input) {
      return evaluateStreak({ store, clock }, input);
    },

    async runMorningCadence() {
      return runMorningCadence({
        syncCalendar: () => facade.syncCalendar(),
        buildEmailDigest: () => facade.buildEmailDigest(),
        proposeDayPlan: (options) => facade.proposeDayPlan(options),
        clock,
        store,
      });
    },

    async runEveningCadence() {
      return runEveningCadence({
        syncCalendar: () => facade.syncCalendar(),
        buildEmailDigest: () => facade.buildEmailDigest(),
        proposeDayPlan: (options) => facade.proposeDayPlan(options),
        clock,
        store,
      });
    },
  };

  return facade;
}
