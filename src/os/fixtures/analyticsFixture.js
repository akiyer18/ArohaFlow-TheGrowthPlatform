/**
 * Weekly-review Analytics payload — fixture-backed until Store weekly reads land.
 * Agent Activity mirrors listToday().agentActivity; measures are portfolio-safe.
 */
export const ANALYTICS_FIXTURE = {
  weekLabel: 'Week of 10 Nov 2026',
  agentActivity: [
    {
      type: 'scheduled_run',
      summary: 'Morning run prepared Today (2026-11-13): calendar sync, Email Digest, Day Plan propose',
      at: '2026-11-13T08:05:00.000Z',
    },
    {
      type: 'lock_day_plan',
      summary: 'Locked Day Plan for 2026-11-13',
      at: '2026-11-12T17:42:00.000Z',
    },
    {
      type: 'scheduled_run',
      summary: 'Evening run refreshed digest/calendar and proposed tomorrow',
      at: '2026-11-12T17:30:00.000Z',
    },
    {
      type: 'build_email_digest',
      summary: 'Email Digest: 6 Important Email(s)',
      at: '2026-11-13T08:05:02.000Z',
    },
  ],
  planVersusDone: {
    lockedDays: 4,
    daysWithAllMicroactionsComplete: 2,
    microactionsPlanned: 10,
    microactionsCompleted: 7,
  },
  habitConsistency: {
    habits: [
      { habitId: 'gym', label: 'Gym', scheduledDays: 5, checkIns: 4 },
      { habitId: 'read', label: 'Read 20 min', scheduledDays: 7, checkIns: 5 },
    ],
  },
  timePerGoal: [
    { goalId: 'g-os', title: 'Personal OS v1', plannedMinutes: 480, completedMinutes: 360 },
    { goalId: 'g-job', title: 'Job search', plannedMinutes: 240, completedMinutes: 180 },
  ],
  applicationPipeline: {
    movedThisWeek: 3,
    byStatus: [
      { status: 'applied', count: 4 },
      { status: 'interview', count: 2 },
      { status: 'offer', count: 0 },
    ],
  },
};
