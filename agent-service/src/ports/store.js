/**
 * Store port — domain ops for the Agent Service.
 * Adapters: memory (tests), Supabase (later). Callers must not use PostgREST.
 *
 * Expected methods (duck-typed contract documented here):
 * - getDayPlan / saveDayPlan / appendDayPlanChange / listDayPlanChanges
 * - getEmailDigest / upsertEmailDigestItem
 * - getDailyPoints / addDailyPoints / getDailyPointTarget / getStreak
 * - recordStreakTargetMet / recordStreakMiss
 * - listAgentActivity / appendAgentActivity
 * - getHabitCheckIns / saveHabitCheckIn
 * - upsertCalendarEvent / listCalendarEvents
 * - listSenderAllowlist / setSenderAllowlist
 * - seedGoals / listOpenMicroactions / listActiveActions / completeMicroaction / completeAction
 */
export const STORE_METHODS = [
  'getDayPlan',
  'saveDayPlan',
  'getEmailDigest',
  'getDailyPoints',
  'getDailyPointTarget',
  'getStreak',
  'listAgentActivity',
  'getHabitCheckIns',
  'listCalendarEvents',
  'listSenderAllowlist',
];
