/**
 * Mock Today payload — same shape as Agent Service `listToday()`.
 * Portfolio-safe placeholders only; no private content.
 */
export const TODAY_FIXTURE = {
  date: '2026-11-13',
  intention: 'Ship the Store seam before lunch.',
  dayPlan: {
    date: '2026-11-13',
    status: 'locked',
    intention: 'Ship the Store seam before lunch.',
    blocks: [
      {
        id: 'fixed-gym-2026-11-13',
        kind: 'fixed',
        purpose: 'gym',
        title: 'Gym',
        startAt: '2026-11-13T07:00:00.000Z',
        endAt: '2026-11-13T08:00:00.000Z',
      },
      {
        id: 'fixed-work-2026-11-13',
        kind: 'fixed',
        purpose: 'work-window',
        title: 'Work window',
        startAt: '2026-11-13T09:00:00.000Z',
        endAt: '2026-11-13T18:00:00.000Z',
      },
      {
        id: 'flex-ma-wire-store',
        kind: 'flexible',
        purpose: 'deep-work',
        title: 'Wire Store seam',
        microactionId: 'ma-wire-store',
        publishToCalendar: true,
        startAt: '2026-11-13T09:00:00.000Z',
        endAt: '2026-11-13T11:00:00.000Z',
      },
      {
        id: 'flex-ma-digest-eval',
        kind: 'flexible',
        purpose: 'deep-work',
        title: 'Label digest fixtures',
        microactionId: 'ma-digest-eval',
        publishToCalendar: false,
        startAt: '2026-11-13T13:00:00.000Z',
        endAt: '2026-11-13T15:00:00.000Z',
      },
      {
        id: 'fixed-lunch-2026-11-13',
        kind: 'fixed',
        purpose: 'meal',
        title: 'Lunch',
        startAt: '2026-11-13T12:00:00.000Z',
        endAt: '2026-11-13T12:45:00.000Z',
      },
      {
        id: 'fixed-wind-2026-11-13',
        kind: 'fixed',
        purpose: 'wind-down',
        title: 'Wind-down',
        startAt: '2026-11-13T19:00:00.000Z',
        endAt: '2026-11-13T22:00:00.000Z',
      },
    ],
  },
  activeMicroaction: null,
  nextMicroaction: {
    id: 'ma-wire-store',
    title: 'Wire Store seam',
    status: 'open',
    actionId: 'act-agent-service',
  },
  emailDigest: [
    {
      messageId: 'm-allow-1',
      from: 'tutor@example.edu',
      subject: 'Seminar materials',
      snippet: 'Slides attached for Thursday.',
      reason: 'Sender Allowlist',
    },
    {
      messageId: 'm-llm-1',
      from: 'alex@example.com',
      subject: 'Question about the role',
      snippet: 'Are you still hiring for the platform seat?',
      reason: 'job-search personal ask',
      score: 0.92,
    },
    {
      messageId: 'm-llm-2',
      from: 'ops@example.org',
      subject: 'Invoice received',
      snippet: 'Payment cleared for last month.',
      reason: 'finance follow-up',
      score: 0.71,
    },
    {
      messageId: 'm-llm-3',
      from: 'mentor@example.net',
      subject: 'Coffee next week?',
      snippet: 'Free Tuesday afternoon if useful.',
      reason: 'personal scheduling',
      score: 0.64,
    },
    {
      messageId: 'm-llm-4',
      from: 'recruiter@example.com',
      subject: 'Intro call slots',
      snippet: 'Three times that work on Friday.',
      reason: 'recruiter outreach',
      score: 0.58,
    },
    {
      messageId: 'm-llm-5',
      from: 'lab@example.edu',
      subject: 'Reading group notes',
      snippet: 'Notes from yesterday’s session.',
      reason: 'course related',
      score: 0.51,
    },
  ],
  dailyPoints: 20,
  dailyPointTarget: 100,
  pointsExplanation: [
    { type: 'plan_ready', points: 10, summary: 'Plan-ready Completion (locked prior evening)' },
    { type: 'habit_check_in', points: 10, summary: 'Habit Check-in: Gym', refId: 'gym' },
  ],
  streak: { count: 4, freezeRemainingThisWeek: 1 },
  agentActivity: [
    {
      type: 'scheduled_run',
      summary: 'Morning run prepared Today (2026-11-13): calendar sync, Email Digest, Day Plan propose',
      at: '2026-11-13T08:05:00.000Z',
    },
    {
      type: 'sync_calendar',
      summary: 'Synced 3 Calendar Event(s)',
      at: '2026-11-13T08:05:01.000Z',
    },
    {
      type: 'build_email_digest',
      summary: 'Email Digest: 6 Important Email(s)',
      at: '2026-11-13T08:05:02.000Z',
    },
    {
      type: 'propose_day_plan',
      summary: 'Proposed Day Plan with 2 Microaction Block(s)',
      at: '2026-11-13T08:05:03.000Z',
    },
  ],
  habitCheckIns: [{ habitId: 'gym', label: 'Gym', at: '2026-11-13T08:10:00.000Z' }],
};

/**
 * Proposed tomorrow plan for evening lock secondary UX (#28).
 * Flexible Blocks intentionally overcommit the work window (10h > 9h).
 */
export const TOMORROW_PLAN_FIXTURE = {
  date: '2026-11-14',
  status: 'proposed',
  intention: null,
  blocks: [
    {
      id: 'fixed-work-2026-11-14',
      kind: 'fixed',
      purpose: 'work-window',
      title: 'Work window',
      startAt: '2026-11-14T09:00:00.000Z',
      endAt: '2026-11-14T18:00:00.000Z',
    },
    {
      id: 'flex-ma-a',
      kind: 'flexible',
      purpose: 'deep-work',
      title: 'Draft Applications updates',
      microactionId: 'ma-apps',
      publishToCalendar: false,
      startAt: '2026-11-14T09:00:00.000Z',
      endAt: '2026-11-14T15:00:00.000Z',
    },
    {
      id: 'flex-ma-b',
      kind: 'flexible',
      purpose: 'deep-work',
      title: 'Ship Analytics polish',
      microactionId: 'ma-analytics',
      publishToCalendar: false,
      startAt: '2026-11-14T15:00:00.000Z',
      endAt: '2026-11-14T19:00:00.000Z',
    },
  ],
};

/** Same rule as Agent Service assessDayPlanOvercommit (Flexible vs work-window). */
export function assessOvercommit(plan) {
  const blocks = plan?.blocks ?? [];
  const work = blocks.find((b) => b.kind === 'fixed' && b.purpose === 'work-window');
  const availableMinutes = work
    ? Math.max(0, Math.round((new Date(work.endAt) - new Date(work.startAt)) / 60000))
    : 9 * 60;
  const plannedMinutes = blocks
    .filter((b) => b.kind === 'flexible')
    .reduce(
      (sum, b) => sum + Math.max(0, Math.round((new Date(b.endAt) - new Date(b.startAt)) / 60000)),
      0,
    );
  const overByMinutes = Math.max(0, plannedMinutes - availableMinutes);
  return {
    date: plan?.date ?? null,
    overcommitted: overByMinutes > 0,
    plannedMinutes,
    availableMinutes,
    overByMinutes,
  };
}

/** Compact Email Digest for Today: top 3–5 Important Emails. */
export function compactDigest(items, limit = 5) {
  const list = items ?? [];
  const capped = Math.min(Math.max(limit, 3), 5);
  return list.slice(0, capped);
}

/** Block on the Day Plan that matches the next Microaction (schedule order). */
export function nextMicroactionBlock(dayPlan, nextMicroaction) {
  const blocks = dayPlan?.blocks ?? [];
  if (nextMicroaction?.id) {
    const match = blocks.find((b) => b.microactionId === nextMicroaction.id);
    if (match) return match;
  }
  return blocks.find((b) => b.kind === 'flexible' && b.microactionId) ?? null;
}
