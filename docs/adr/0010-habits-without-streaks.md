# Habits are kept by consistency, not streaks

Streaks with a weekly freeze turned one missed day into a loss of weeks of progress, and breaking the freeze itself became demotivating. The user wants habits that survive bad days, travel and illness without disappointment. **Decision:** habits are measured by Rolling Consistency and a Weekly Grade; the Streak and its freeze are retired from the UI.

## Rules

1. **Rolling Consistency** per habit = check-ins over the habit's scheduled days in the last 14 days (shown as "11 of 12"). Unscheduled days, Season days and today (until checked in) are not counted. A miss lowers the number by one day; it never resets it.
2. **Minimum Version.** A habit may name a smaller version (Gym → "10-min walk"). Checking in the Minimum Version counts as kept for consistency and the grade, and awards half the Habit Check-in weight: full 10 Daily Points, minimum 5 (ADR-0003 weights otherwise unchanged).
3. **Season.** The user may pause a habit on purpose with a reason ("travel", "sick", "exam week") and an end date. Season days are excluded from consistency and the grade, award nothing and cost nothing.
4. **Quiet habit.** A habit with no check-in across its last 14 days and at least 3 scheduled days in that window goes quiet: shown apart, excluded from the Weekly Grade, never labelled broken. One action picks it back up.
5. **Weekly Grade** for the ISO week (Monday start) = kept scheduled habit days over scheduled habit days so far, across habits that are not quiet: Locked in ≥ 90%, Strong ≥ 75%, Solid ≥ 55%, Patchy ≥ 30%, otherwise Reset. "Reset" is framed as a fresh start, not a failure.

## Consequences

- Supersedes the Streak amendment in ADR-0003 for the UI: Today no longer shows a Streak or freeze count. The Agent Service's `streak` tool remains until the Store carries `level` on Habit Check-ins and `season` on Habits; then it is replaced by the same rules (`src/modules/habits`).
- Completion-only rewards (ADR-0002) hold: points still come only from a check-in, never from a scheduled day passing.
