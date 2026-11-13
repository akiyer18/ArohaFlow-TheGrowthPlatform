/**
 * Mock Calendar View payload — same shape as Agent Service `listCalendarView()`.
 */
export const CALENDAR_VIEW_FIXTURE = {
  month: '2026-11',
  habits: [
    {
      id: 'gym',
      label: 'Gym',
      scheduledDays: [1, 2, 3, 4, 5],
      timeAnchor: '07:00',
    },
    {
      id: 'read',
      label: 'Read 20 min',
      scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      timeAnchor: '21:30',
    },
  ],
  habitConsistency: [
    {
      habitId: 'gym',
      label: 'Gym',
      consistencyStreak: 3,
      scheduledDaysInMonth: 21,
      checkInsInMonth: 8,
    },
    {
      habitId: 'read',
      label: 'Read 20 min',
      consistencyStreak: 2,
      scheduledDaysInMonth: 30,
      checkInsInMonth: 12,
    },
  ],
  events: [
    {
      externalId: 'meet-1',
      title: 'Standup',
      startAt: '2026-11-13T11:00:00.000Z',
      endAt: '2026-11-13T11:30:00.000Z',
    },
  ],
  dayPlans: [
    {
      date: '2026-11-13',
      status: 'locked',
      intention: 'Ship the Store seam before lunch.',
      blocks: [
        {
          id: 'flex-ma1',
          kind: 'flexible',
          title: 'Wire Store seam',
          microactionId: 'ma1',
          startAt: '2026-11-13T09:00:00.000Z',
          endAt: '2026-11-13T11:00:00.000Z',
        },
      ],
    },
  ],
  habitDays: buildNovemberHabitDays(),
};

function buildNovemberHabitDays() {
  const days = [];
  const gymDone = new Set([
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
    '2026-11-09',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
  ]);
  const readDone = new Set([
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
  ]);
  const asOf = '2026-11-13';

  for (let d = 1; d <= 30; d += 1) {
    const date = `2026-11-${String(d).padStart(2, '0')}`;
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();

    const gymScheduled = weekday >= 1 && weekday <= 5;
    const gymChecked = gymDone.has(date);
    days.push({
      date,
      habitId: 'gym',
      scheduled: gymScheduled,
      checkedIn: gymChecked,
      status: !gymScheduled ? 'off' : gymChecked ? 'done' : date <= asOf ? 'missed' : 'planned',
    });

    const readChecked = readDone.has(date);
    days.push({
      date,
      habitId: 'read',
      scheduled: true,
      checkedIn: readChecked,
      status: readChecked ? 'done' : date <= asOf ? 'missed' : 'planned',
    });
  }
  return days;
}
