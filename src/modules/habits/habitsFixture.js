/**
 * Portfolio-safe Habits payload, built relative to a date so the screen always
 * reads as "this week". Shape matches the planned Agent Service `listHabitsView()`.
 */
import { addDays, isScheduled } from './rules.js';

const PATTERNS = {
  gym: { missed: [3, 9], minimum: [6], today: 'full' },
  read: { missed: [2, 5, 11], minimum: [1, 8] },
  meditate: { missed: [4, 7, 10, 13], minimum: [] },
  spanish: { missed: [], minimum: [] },
  journal: { missed: 'all', minimum: [] },
};

export function buildHabitsFixture(asOf) {
  const habits = [
    { id: 'gym', label: 'Gym', scheduledDays: [1, 2, 3, 4, 5], timeAnchor: '07:00', minimum: { label: '10-min walk' } },
    { id: 'meditate', label: 'Meditate', scheduledDays: [0, 1, 2, 3, 4, 5, 6], timeAnchor: '07:30', minimum: { label: 'Three slow breaths' } },
    { id: 'read', label: 'Read 20 min', scheduledDays: [0, 1, 2, 3, 4, 5, 6], timeAnchor: '21:30', minimum: { label: 'Read one page' } },
    {
      id: 'spanish',
      label: 'Spanish practice',
      scheduledDays: [1, 3, 5],
      timeAnchor: '18:30',
      minimum: { label: 'Five flashcards' },
      season: { reason: 'Exam week', from: addDays(asOf, -2), until: addDays(asOf, 4) },
    },
    { id: 'journal', label: 'Evening journal', scheduledDays: [0, 1, 2, 3, 4, 5, 6], timeAnchor: '22:00' },
  ];

  const checkIns = [];
  for (const habit of habits) {
    const p = PATTERNS[habit.id];
    if (p.missed === 'all') continue;
    for (let offset = 1; offset <= 20; offset += 1) {
      const date = addDays(asOf, -offset);
      if (!isScheduled(habit, date)) continue;
      if (habit.season && date >= habit.season.from) continue;
      if (p.missed.includes(offset)) continue;
      checkIns.push({ habitId: habit.id, date, level: p.minimum.includes(offset) ? 'minimum' : 'full' });
    }
    if (p.today && isScheduled(habit, asOf)) checkIns.push({ habitId: habit.id, date: asOf, level: p.today });
  }
  return { habits, checkIns };
}
