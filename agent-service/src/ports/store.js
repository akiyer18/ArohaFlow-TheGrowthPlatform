/**
 * Store port — domain ops for the Agent Service.
 * Adapters: memory (tests), Supabase (`createSupabaseStore`). Callers must not use PostgREST.
 *
 * Expected methods (duck-typed contract documented here):
 * - getDayPlan / saveDayPlan / appendDayPlanChange / listDayPlanChanges
 * - getEmailDigest / upsertEmailDigestItem
 * - getDailyPoints / addDailyPoints / listCompletions / appendCompletion / getDailyPointTarget / getStreak
 * - recordStreakTargetMet / recordStreakMiss
 * - listAgentActivity / appendAgentActivity
 * - listHabits / upsertHabit / getHabitCheckIns / saveHabitCheckIn
 * - listApplications / upsertApplication / listApplicationEvents / appendApplicationEvent (ADR-0012)
 * - upsertCalendarEvent / listCalendarEvents
 * - listSenderAllowlist / setSenderAllowlist
 * - seedGoals / listGoals / listOpenMicroactions / listActiveActions / completeMicroaction / completeAction
 * - getMicroaction / getActiveMicroaction / setMicroactionStatus
 * - saveWeeklyPlanProposal / getWeeklyPlanProposal
 */
export const STORE_METHODS = [
  'getDayPlan',
  'saveDayPlan',
  'getEmailDigest',
  'getDailyPoints',
  'addDailyPoints',
  'listCompletions',
  'appendCompletion',
  'getDailyPointTarget',
  'getStreak',
  'listAgentActivity',
  'listHabits',
  'upsertHabit',
  'listApplications',
  'upsertApplication',
  'listApplicationEvents',
  'appendApplicationEvent',
  'getHabitCheckIns',
  'listCalendarEvents',
  'listSenderAllowlist',
  'listGoals',
  'listOpenMicroactions',
  'listActiveActions',
  'getMicroaction',
  'getActiveMicroaction',
  'setMicroactionStatus',
  'completeMicroaction',
  'completeAction',
  'saveWeeklyPlanProposal',
  'getWeeklyPlanProposal',
];
