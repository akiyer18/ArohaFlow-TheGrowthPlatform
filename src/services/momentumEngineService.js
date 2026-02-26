/**
 * Momentum Engine: Daily Effort (0-100, harder to earn) + Momentum (0-1000, cumulative).
 * No artificial boosts. Penalizes missed commitments. Rewards consistency and streaks.
 */

import { supabase } from '../config/supabase';
import { logDbError } from '../lib/db/logger';
import { isRequiredDay } from '../utils/streakUtils';
import { toDateKey } from '../utils/date';
import { getCurrentUserId } from '../config/supabase';

const startOfDayIso = (dateStr) => `${dateStr}T00:00:00.000Z`;
const endOfDayIso = (dateStr) => `${dateStr}T23:59:59.999Z`;

// --- Data fetchers (shared) ---

async function fetchDayTasks(dateStr) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id,status,due_date')
    .gte('due_date', startOfDayIso(dateStr))
    .lte('due_date', endOfDayIso(dateStr));
  if (error) throw error;
  return data || [];
}

async function fetchOverdueTasksAsOf(dateStr) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .lt('due_date', dateStr)
    .neq('status', 'Completed');
  if (error) throw error;
  return data || [];
}

async function fetchDayHabitsAndLogs(dateStr) {
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('*')
    .eq('archived', false);
  if (habitsError) throw habitsError;
  if (!habits?.length) return { habits: [], logs: [] };
  const habitIds = habits.map((h) => h.id);
  const { data: logs, error: logsError } = await supabase
    .from('habit_logs')
    .select('*')
    .in('habit_id', habitIds)
    .eq('date', dateStr);
  if (logsError) throw logsError;
  return { habits, logs: logs || [] };
}

async function fetchDayMeals(dateStr) {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('planned_date', dateStr);
  if (error) throw error;
  return data || [];
}

async function fetchDayFlowSessions(dateStr) {
  const { data, error } = await supabase
    .from('flow_sessions')
    .select('duration_minutes')
    .eq('date', dateStr);
  if (error) throw error;
  return data || [];
}

async function hasReflectionForDate(dateStr) {
  const { data: r } = await supabase
    .from('daily_reflection')
    .select('id')
    .eq('date', dateStr)
    .limit(1)
    .maybeSingle();
  if (r) return true;
  const { data: m } = await supabase
    .from('mood_logs')
    .select('id')
    .eq('date', dateStr)
    .limit(1)
    .maybeSingle();
  return !!m;
}

// --- Daily Effort (0-100, no free points) ---

/** Deep work score: 90+ min -> 20, 60+ -> 15, 30+ -> 8, else 0 */
function deepWorkScore(minutes) {
  if (minutes >= 90) return 20;
  if (minutes >= 60) return 15;
  if (minutes >= 30) return 8;
  return 0;
}

/**
 * Effort = (habit_pct * 0.35) + (task_pct * 0.30) + deep_work_score + meal_score + (reflection ? 5 : 0).
 * If 0 tasks today -> task contribution = 0. If 0 required habits -> habit contribution = 0.
 * Meal: planned manually -> 10 (we don't track auto-fill yet, so any planned = 10).
 */
export async function getOrCreateDailyEffort(dateStrInput) {
  const dateStr = toDateKey(dateStrInput || new Date());
  try {
    const { data: existing, error: existingError } = await supabase
      .from('daily_effort_scores')
      .select('*')
      .eq('date', dateStr)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;
  } catch (err) {
    logDbError('getOrCreateDailyEffort.select', err);
  }

  try {
    const userId = await getCurrentUserId();
    const [tasks, { habits, logs }, meals, sessions, reflectionSubmitted] = await Promise.all([
      fetchDayTasks(dateStr),
      fetchDayHabitsAndLogs(dateStr),
      fetchDayMeals(dateStr),
      fetchDayFlowSessions(dateStr),
      hasReflectionForDate(dateStr),
    ]);

    const logsByHabit = {};
    (logs || []).forEach((log) => {
      logsByHabit[log.habit_id] = (logsByHabit[log.habit_id] || 0) + (log.count ?? 0);
    });

    let requiredCount = 0;
    let completedRequired = 0;
    (habits || []).forEach((habit) => {
      const startDateStr = toDateKey(habit.start_date || new Date());
      if (!isRequiredDay(dateStr, habit.frequency_type, habit.frequency_value || {}, startDateStr))
        return;
      requiredCount += 1;
      const count = logsByHabit[habit.id] ?? 0;
      const target = habit.target_per_day ?? 1;
      if (count >= target) completedRequired += 1;
    });

    const habitPct = requiredCount === 0 ? 0 : Math.round((completedRequired / requiredCount) * 100);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
    const taskPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const deepWorkMinutes = (sessions || []).reduce((s, x) => s + (x.duration_minutes || 0), 0);
    const mealScore = (meals || []).length > 0 ? 10 : 0;

    const effort =
      habitPct * 0.35 +
      taskPct * 0.3 +
      deepWorkScore(deepWorkMinutes) +
      mealScore +
      (reflectionSubmitted ? 5 : 0);
    const effortScore = Math.max(0, Math.min(100, Math.round(effort)));

    const payload = {
      user_id: userId,
      date: dateStr,
      effort_score: effortScore,
      habit_pct: habitPct,
      task_pct: taskPct,
      deep_work_minutes: deepWorkMinutes,
      meal_score: mealScore,
      reflection_submitted: !!reflectionSubmitted,
    };

    const { data, error } = await supabase
      .from('daily_effort_scores')
      .upsert([payload], { onConflict: 'user_id,date' })
      .select()
      .single();
    if (error) {
      logDbError('getOrCreateDailyEffort.upsert', error);
      throw error;
    }
    return data;
  } catch (err) {
    logDbError('getOrCreateDailyEffort', err);
    throw err;
  }
}

// --- Momentum (0-1000) ---

const INITIAL_MOMENTUM = 500;
const CONSISTENCY_CAP = 50;
const STREAK_3_BONUS = 5;
const STREAK_7_BONUS = 15;
const STREAK_30_BONUS = 40;
const ALL_HABITS_BONUS = 10;
const MISSED_HABIT_PENALTY = 10;
const OVERDUE_TASK_PENALTY = 5;
const ZERO_EFFORT_PENALTY = 25;
const TWO_BAD_DAYS_EXTRA = 30;
const INACTIVE_DAY_DECAY = 5;
const INACTIVE_ACCELERATION_AFTER = 3;

/** Good day = effort >= 50. Bad day = effort 0 or (effort < 30). */
function isGoodDay(effortScore) {
  return effortScore != null && effortScore >= 50;
}

function isBadDay(effortScore) {
  return effortScore == null || effortScore === 0 || effortScore < 30;
}

/** Consecutive good days ending the day before dateStr (streak from yesterday backwards). */
async function getConsistencyStreak(userId, dateStr) {
  const day = new Date(dateStr + 'T12:00:00');
  let count = 0;
  for (let i = 1; i <= 35; i++) {
    day.setDate(day.getDate() - 1);
    const key = toDateKey(day);
    const { data } = await supabase
      .from('daily_effort_scores')
      .select('effort_score')
      .eq('user_id', userId)
      .eq('date', key)
      .limit(1)
      .maybeSingle();
    if (!data || !isGoodDay(data.effort_score)) break;
    count += 1;
  }
  return count;
}

/** Consecutive bad days ending at dateStr (today counts as one if bad). */
async function getConsecutiveBadDays(userId, dateStr, todayEffort) {
  if (!isBadDay(todayEffort)) return 0;
  let count = 1;
  const day = new Date(dateStr + 'T12:00:00');
  for (let i = 1; i <= 5; i++) {
    day.setDate(day.getDate() - 1);
    const key = toDateKey(day);
    const { data } = await supabase
      .from('daily_effort_scores')
      .select('effort_score')
      .eq('user_id', userId)
      .eq('date', key)
      .limit(1)
      .maybeSingle();
    if (!data || !isBadDay(data.effort_score)) break;
    count += 1;
  }
  return count;
}

/** Inactive days: no effort record. Count consecutive inactive up to dateStr. */
async function getInactiveDaysBefore(userId, dateStr) {
  const day = new Date(dateStr + 'T12:00:00');
  let count = 0;
  for (let i = 0; i < 10; i++) {
    const key = toDateKey(day);
    const { data } = await supabase
      .from('daily_effort_scores')
      .select('id')
      .eq('user_id', userId)
      .eq('date', key)
      .limit(1)
      .maybeSingle();
    if (data) break;
    count += 1;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

export async function getOrCreateMomentum(dateStrInput) {
  const dateStr = toDateKey(dateStrInput || new Date());
  try {
    const { data: existing, error } = await supabase
      .from('momentum_history')
      .select('*')
      .eq('date', dateStr)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (existing) return existing;
  } catch (err) {
    logDbError('getOrCreateMomentum.select', err);
  }

  try {
    const userId = await getCurrentUserId();
    const effortRow = await getOrCreateDailyEffort(dateStr);
    const effortScore = effortRow?.effort_score ?? 0;

    let prevMomentum = INITIAL_MOMENTUM;
    const { data: prevRow } = await supabase
      .from('momentum_history')
      .select('momentum_score')
      .eq('user_id', userId)
      .lt('date', dateStr)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevRow?.momentum_score != null) prevMomentum = prevRow.momentum_score;

    const reasonBreakdown = { effort: effortScore, prev: prevMomentum };

    let consistencyBonus = 0;
    const streak = await getConsistencyStreak(userId, dateStr);
    if (effortRow?.habit_pct === 100 && (effortRow?.habit_pct != null) && (await fetchDayHabitsAndLogs(dateStr)).habits?.length) {
      consistencyBonus += ALL_HABITS_BONUS;
      reasonBreakdown.all_habits = ALL_HABITS_BONUS;
    }
    if (streak >= 30) {
      consistencyBonus += STREAK_30_BONUS;
      reasonBreakdown.streak_30 = STREAK_30_BONUS;
    } else if (streak >= 7) {
      consistencyBonus += STREAK_7_BONUS;
      reasonBreakdown.streak_7 = STREAK_7_BONUS;
    } else if (streak >= 3) {
      consistencyBonus += STREAK_3_BONUS;
      reasonBreakdown.streak_3 = STREAK_3_BONUS;
    }
    consistencyBonus = Math.min(consistencyBonus, CONSISTENCY_CAP);

    let missPenalty = 0;
    const { habits, logs } = await fetchDayHabitsAndLogs(dateStr);
    const logsByHabit = {};
    (logs || []).forEach((l) => { logsByHabit[l.habit_id] = (logsByHabit[l.habit_id] || 0) + (l.count ?? 0); });
    let missedHabits = 0;
    (habits || []).forEach((habit) => {
      const startDateStr = toDateKey(habit.start_date || new Date());
      if (!isRequiredDay(dateStr, habit.frequency_type, habit.frequency_value || {}, startDateStr)) return;
      const count = logsByHabit[habit.id] ?? 0;
      const target = habit.target_per_day ?? 1;
      if (count < target) missedHabits += 1;
    });
    missPenalty += missedHabits * MISSED_HABIT_PENALTY;
    if (missedHabits) reasonBreakdown.missed_habits = missedHabits * MISSED_HABIT_PENALTY;

    const overdue = await fetchOverdueTasksAsOf(dateStr);
    const overdueCount = overdue.length;
    missPenalty += overdueCount * OVERDUE_TASK_PENALTY;
    if (overdueCount) reasonBreakdown.overdue_tasks = overdueCount * OVERDUE_TASK_PENALTY;

    if (effortScore === 0) {
      missPenalty += ZERO_EFFORT_PENALTY;
      reasonBreakdown.zero_effort = ZERO_EFFORT_PENALTY;
    }

    const consecutiveBad = await getConsecutiveBadDays(userId, dateStr, effortScore);
    if (consecutiveBad >= 2) {
      missPenalty += TWO_BAD_DAYS_EXTRA;
      reasonBreakdown.two_bad_days = TWO_BAD_DAYS_EXTRA;
    }

    const inactiveDays = await getInactiveDaysBefore(userId, dateStr);
    if (inactiveDays >= INACTIVE_ACCELERATION_AFTER) {
      const decay = INACTIVE_DAY_DECAY * (inactiveDays - INACTIVE_ACCELERATION_AFTER + 1);
      missPenalty += decay;
      reasonBreakdown.inactive_decay = decay;
    } else if (effortScore === 0 && inactiveDays > 0) {
      missPenalty += INACTIVE_DAY_DECAY;
      reasonBreakdown.inactive_decay = INACTIVE_DAY_DECAY;
    }

    const delta =
      Math.round(effortScore * 0.5) +
      consistencyBonus -
      missPenalty;
    const momentumScore = Math.max(0, Math.min(1000, prevMomentum + delta));
    const actualDelta = momentumScore - prevMomentum;

    reasonBreakdown.delta = actualDelta;
    reasonBreakdown.consistency_bonus = consistencyBonus;
    reasonBreakdown.miss_penalty = missPenalty;

    const payload = {
      user_id: userId,
      date: dateStr,
      momentum_score: momentumScore,
      delta: actualDelta,
      reason_breakdown: reasonBreakdown,
    };

    const { data, error } = await supabase
      .from('momentum_history')
      .upsert([payload], { onConflict: 'user_id,date' })
      .select()
      .single();
    if (error) {
      logDbError('getOrCreateMomentum.upsert', error);
      throw error;
    }
    return data;
  } catch (err) {
    logDbError('getOrCreateMomentum', err);
    throw err;
  }
}

/** Get today's effort + momentum (engine entry point for UI). */
export async function getTodayEffortAndMomentum() {
  const today = toDateKey(new Date());
  const [effort, momentum] = await Promise.all([
    getOrCreateDailyEffort(today),
    getOrCreateMomentum(today),
  ]);
  return { effort, momentum };
}

/** Get effort + momentum for a date range (for calendar). Ensures today is computed when in range. */
export async function getEffortAndMomentumForRange(startDate, endDate) {
  try {
    const today = toDateKey(new Date());
    if (today >= startDate && today <= endDate) {
      await Promise.all([getOrCreateDailyEffort(today), getOrCreateMomentum(today)]);
    }
    const userId = await getCurrentUserId();
    const [effortRes, momentumRes] = await Promise.all([
      supabase.from('daily_effort_scores').select('*').eq('user_id', userId).gte('date', startDate).lte('date', endDate),
      supabase.from('momentum_history').select('*').eq('user_id', userId).gte('date', startDate).lte('date', endDate),
    ]);
    const effortByDate = {};
    (effortRes.data || []).forEach((r) => { effortByDate[r.date] = r; });
    const momentumByDate = {};
    (momentumRes.data || []).forEach((r) => { momentumByDate[r.date] = r; });
    const out = {};
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d);
      const effortRow = effortByDate[key];
      out[key] = {
        effort_score: effortRow?.effort_score ?? null,
        deep_work_minutes: effortRow?.deep_work_minutes ?? null,
        momentum_score: momentumByDate[key]?.momentum_score ?? null,
        momentum_delta: momentumByDate[key]?.delta ?? null,
        reason_breakdown: momentumByDate[key]?.reason_breakdown ?? null,
      };
    }
    return out;
  } catch (err) {
    logDbError('getEffortAndMomentumForRange', err);
    throw err;
  }
}

/** Identity message from momentum trend (no guilt language). */
export function getMomentumMessage(momentum, delta, previousMomentum) {
  if (delta == null) return 'Your momentum will build as you show up.';
  if (delta > 0) return 'Momentum building.';
  if (delta < 0) return 'Momentum declining.';
  return 'Momentum holding steady.';
}

// --- Weekly reflection (auto Sunday / on load) ---

/** Sunday of the week containing dateStr (week = Sun–Sat). */
function getWeekStartSunday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return toDateKey(d);
}

/** Last completed week: week that ended on or before yesterday. Returns its Sunday. */
function getLastCompletedWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getWeekStartSunday(toDateKey(d));
}

/**
 * Generate and upsert weekly_reflections for the given week (weekStart = Sunday YYYY-MM-DD).
 * Idempotent: if row exists, returns it.
 */
export async function generateWeeklyReflection(weekStartStr) {
  try {
    const userId = await getCurrentUserId();
    const { data: existing } = await supabase
      .from('weekly_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStartStr)
      .limit(1)
      .maybeSingle();
    if (existing) return existing;

    const start = new Date(weekStartStr + 'T12:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endStr = toDateKey(end);

    const [effortRes, momentumFirst, momentumLast, moodRes] = await Promise.all([
      supabase
        .from('daily_effort_scores')
        .select('*')
        .eq('user_id', userId)
        .gte('date', weekStartStr)
        .lte('date', endStr),
      supabase
        .from('momentum_history')
        .select('momentum_score')
        .eq('user_id', userId)
        .eq('date', weekStartStr)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('momentum_history')
        .select('momentum_score')
        .eq('user_id', userId)
        .eq('date', endStr)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('mood_logs')
        .select('mood_score')
        .eq('user_id', userId)
        .gte('date', weekStartStr)
        .lte('date', endStr),
    ]);

    const efforts = effortRes.data || [];
    const avgEffort =
      efforts.length > 0
        ? efforts.reduce((s, r) => s + (r.effort_score ?? 0), 0) / efforts.length
        : 0;
    const momentumChange =
      (momentumLast.data?.momentum_score ?? 0) - (momentumFirst.data?.momentum_score ?? 0);

    const habitAvg =
      efforts.length > 0
        ? efforts.reduce((s, r) => s + (r.habit_pct ?? 0), 0) / efforts.length
        : 0;
    const taskAvg =
      efforts.length > 0
        ? efforts.reduce((s, r) => s + (r.task_pct ?? 0), 0) / efforts.length
        : 0;
    const deepWorkAvg =
      efforts.length > 0
        ? efforts.reduce((s, r) => s + (r.deep_work_minutes ?? 0), 0) / efforts.length
        : 0;
    const mealAvg =
      efforts.length > 0
        ? efforts.reduce((s, r) => s + (r.meal_score ?? 0), 0) / efforts.length
        : 0;
    const areas = [
      { name: 'Habits', value: habitAvg },
      { name: 'Tasks', value: taskAvg },
      { name: 'Deep work', value: deepWorkAvg },
      { name: 'Meals', value: mealAvg },
    ];
    areas.sort((a, b) => b.value - a.value);
    const strongest_area = areas[0]?.name ?? null;
    const weakest_area = areas[3]?.name ?? null;

    const moodSummary = {};
    (moodRes.data || []).forEach((r) => {
      const s = r.mood_score ?? 0;
      moodSummary[s] = (moodSummary[s] || 0) + 1;
    });

    const effortByDate = {};
    efforts.forEach((r) => { effortByDate[r.date] = r.effort_score; });
    let run = 0;
    let longestStreakDays = 0;
    for (let i = 0; i <= 6; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      if (isGoodDay(effortByDate[key])) {
        run += 1;
        if (run > longestStreakDays) longestStreakDays = run;
      } else {
        run = 0;
      }
    }

    const payload = {
      user_id: userId,
      week_start: weekStartStr,
      avg_effort: Math.round(avgEffort * 10) / 10,
      momentum_change: Math.round(momentumChange),
      strongest_area,
      weakest_area,
      mood_summary: moodSummary,
      longest_streak_days: longestStreakDays > 0 ? longestStreakDays : null,
    };

    const { data, error } = await supabase
      .from('weekly_reflections')
      .upsert([payload], { onConflict: 'user_id,week_start' })
      .select()
      .single();
    if (error) {
      logDbError('generateWeeklyReflection.upsert', error);
      throw error;
    }
    return data;
  } catch (err) {
    logDbError('generateWeeklyReflection', err);
    throw err;
  }
}

/** Call on app load: ensure last completed week has a reflection (e.g. after Sunday). */
export async function ensureWeeklyReflectionForLastWeek() {
  try {
    const weekStart = getLastCompletedWeekStart();
    await generateWeeklyReflection(weekStart);
  } catch (err) {
    logDbError('ensureWeeklyReflectionForLastWeek', err);
  }
}
