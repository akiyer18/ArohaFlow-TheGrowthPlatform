import { supabase } from '../config/supabase';
import { logDbError } from '../lib/db/logger';
import { isRequiredDay } from '../utils/streakUtils';
import { toDateKey } from '../utils/date';
import { getCurrentUserId } from '../config/supabase';

const startOfDayIso = (dateStr) => `${dateStr}T00:00:00.000Z`;
const endOfDayIso = (dateStr) => `${dateStr}T23:59:59.999Z`;

const MOOD_TO_SCORE = {
  great: 5,
  good: 4,
  neutral: 3,
  low: 2,
  difficult: 1,
};

export async function upsertDailyReflection(dateStr, mood, note) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('daily_reflection')
      .upsert(
        [{
          user_id: userId,
          date: dateStr,
          mood,
          note: note || null,
        }],
        { onConflict: 'user_id,date' },
      )
      .select()
      .single();
    if (error) {
      logDbError('upsertDailyReflection', error);
      throw error;
    }

    const moodScore = mood ? MOOD_TO_SCORE[mood] : null;
    if (moodScore != null) {
      const { error: moodError } = await supabase
        .from('mood_logs')
        .upsert(
          [{
            user_id: userId,
            date: dateStr,
            mood_score: moodScore,
            note: note || null,
          }],
          { onConflict: 'user_id,date' },
        );
      if (moodError) {
        logDbError('upsertMoodLog', moodError);
        throw moodError;
      }
    }

    return data;
  } catch (err) {
    logDbError('upsertDailyReflection', err);
    throw err;
  }
}

export async function getDailyReflectionsInRange(startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('daily_reflection')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) {
      logDbError('getDailyReflectionsInRange', error);
      throw error;
    }
    return data || [];
  } catch (err) {
    logDbError('getDailyReflectionsInRange', err);
    throw err;
  }
}

/**
 * Log a deep work / flow session for the given date.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} durationMinutes
 * @param {string|null} taskId - optional linked task
 */
export async function createFlowSession(dateStr, durationMinutes, taskId = null) {
  try {
    const userId = await getCurrentUserId();
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);
    const payload = {
      user_id: userId,
      date: dateStr,
      task_id: taskId || null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
      flow_rating: null,
    };
    const { data, error } = await supabase
      .from('flow_sessions')
      .insert([payload])
      .select()
      .single();
    if (error) {
      logDbError('createFlowSession', error);
      throw error;
    }
    return data;
  } catch (err) {
    logDbError('createFlowSession', err);
    throw err;
  }
}

async function fetchDayTasks(dateStr) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id,status,due_date')
    .gte('due_date', startOfDayIso(dateStr))
    .lte('due_date', endOfDayIso(dateStr));
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

export async function getOrCreateDailyFlowScore(dateStrInput) {
  const dateStr = toDateKey(dateStrInput || new Date());
  try {
    const { data: existing, error: existingError } = await supabase
      .from('daily_flow_scores')
      .select('*')
      .eq('date', dateStr)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;
  } catch (err) {
    logDbError('getOrCreateDailyFlowScore.select', err);
  }

  try {
    const userId = await getCurrentUserId();
    const [tasks, { habits, logs }, meals, sessions] = await Promise.all([
      fetchDayTasks(dateStr),
      fetchDayHabitsAndLogs(dateStr),
      fetchDayMeals(dateStr),
      fetchDayFlowSessions(dateStr),
    ]);

    // Task completion %
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
    const taskPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 100;

    // Habit completion %
    const logsByHabit = {};
    logs.forEach((log) => {
      logsByHabit[log.habit_id] = (logsByHabit[log.habit_id] || 0) + (log.count ?? 0);
    });
    let requiredCount = 0;
    let completedRequired = 0;
    habits.forEach((habit) => {
      const startDateStr = toDateKey(habit.start_date || new Date());
      if (!isRequiredDay(dateStr, habit.frequency_type, habit.frequency_value || {}, startDateStr)) {
        return;
      }
      requiredCount += 1;
      const count = logsByHabit[habit.id] ?? 0;
      const target = habit.target_per_day ?? 1;
      if (count >= target) completedRequired += 1;
    });
    const habitPct = requiredCount
      ? Math.round((completedRequired / requiredCount) * 100)
      : 100;

    const mealPlanned = meals.length > 0;
    const deepWorkMinutes = sessions.reduce(
      (sum, s) => sum + (s.duration_minutes || 0),
      0,
    );

    // Flow Score calculation
    const habitComponent = habitPct * 0.4;
    const taskComponent = taskPct * 0.3;
    const mealComponent = mealPlanned ? 10 : 0;
    const deepWorkComponent = Math.min(deepWorkMinutes / 60 * 20, 20); // up to +20
    const flowScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(habitComponent + taskComponent + mealComponent + deepWorkComponent),
      ),
    );

    const payload = {
      user_id: userId,
      date: dateStr,
      flow_score: flowScore,
      habit_completion_pct: habitPct,
      task_completion_pct: taskPct,
      meal_planned: mealPlanned,
      deep_work_minutes: deepWorkMinutes,
    };

    const { data, error } = await supabase
      .from('daily_flow_scores')
      .upsert([payload], { onConflict: 'user_id,date' })
      .select()
      .single();
    if (error) {
      logDbError('getOrCreateDailyFlowScore.upsert', error);
      throw error;
    }
    return data;
  } catch (err) {
    logDbError('getOrCreateDailyFlowScore', err);
    throw err;
  }
}

export async function getOrCreateMomentumSnapshot(dateStrInput) {
  const dateStr = toDateKey(dateStrInput || new Date());
  try {
    const { data: existing, error } = await supabase
      .from('momentum_snapshots')
      .select('*')
      .eq('date', dateStr)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (existing) return existing;
  } catch (err) {
    logDbError('getOrCreateMomentumSnapshot.select', err);
  }

  try {
    const userId = await getCurrentUserId();
    const start = new Date(dateStr + 'T12:00:00');
    start.setDate(start.getDate() - 13);
    const startKey = toDateKey(start);

    const { data: scores, error: scoresError } = await supabase
      .from('daily_flow_scores')
      .select('*')
      .gte('date', startKey)
      .lte('date', dateStr)
      .order('date', { ascending: true });
    if (scoresError) throw scoresError;

    if (!scores || scores.length === 0) {
      // No data yet; create a neutral snapshot.
      const neutral = {
        user_id: userId,
        date: dateStr,
        momentum_score: 50,
        rolling_14_day_habit_avg: 50,
        rolling_14_day_task_avg: 50,
        meal_consistency: 0,
        deep_work_sessions: 0,
      };
      const { data, error } = await supabase
        .from('momentum_snapshots')
        .upsert([neutral], { onConflict: 'user_id,date' })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const habitAvg =
      scores.reduce((sum, s) => sum + (s.habit_completion_pct || 0), 0) /
      scores.length;
    const taskAvg =
      scores.reduce((sum, s) => sum + (s.task_completion_pct || 0), 0) /
      scores.length;
    const mealConsistency =
      scores.reduce((sum, s) => sum + (s.meal_planned ? 1 : 0), 0) /
      scores.length;

    const startDay = new Date(startKey + 'T12:00:00');
    const endDay = new Date(dateStr + 'T12:00:00');
    const totalDays =
      Math.round(
        (endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;

    const { data: sessions, error: sessionError } = await supabase
      .from('flow_sessions')
      .select('date')
      .gte('date', startKey)
      .lte('date', dateStr);
    if (sessionError) throw sessionError;
    const uniqueSessionDays = new Set((sessions || []).map((s) => toDateKey(s.date)));
    const deepWorkSessions = uniqueSessionDays.size;

    const rawScore =
      habitAvg * 0.4 +
      taskAvg * 0.3 +
      mealConsistency * 100 * 0.2 +
      (totalDays > 0
        ? (Math.min(deepWorkSessions, totalDays) / totalDays) * 100 * 0.1
        : 0);

    let previousMomentum = rawScore;
    try {
      const { data: prev, error: prevError } = await supabase
        .from('momentum_snapshots')
        .select('*')
        .lt('date', dateStr)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevError) throw prevError;
      if (prev?.momentum_score != null) previousMomentum = prev.momentum_score;
    } catch (err) {
      logDbError('getOrCreateMomentumSnapshot.prev', err);
    }

    const smoothed = Math.round(
      previousMomentum * 0.7 + (rawScore / 100) * 100 * 0.3,
    );
    const clamped = Math.max(0, Math.min(100, smoothed));

    const payload = {
      user_id: userId,
      date: dateStr,
      momentum_score: clamped,
      rolling_14_day_habit_avg: habitAvg,
      rolling_14_day_task_avg: taskAvg,
      meal_consistency: mealConsistency,
      deep_work_sessions: deepWorkSessions,
    };

    const { data, error } = await supabase
      .from('momentum_snapshots')
      .upsert([payload], { onConflict: 'user_id,date' })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    logDbError('getOrCreateMomentumSnapshot', err);
    throw err;
  }
}

export async function getTodayFlowAndMomentum() {
  const today = toDateKey(new Date());
  const [flow, momentum] = await Promise.all([
    getOrCreateDailyFlowScore(today),
    getOrCreateMomentumSnapshot(today),
  ]);
  return { flow, momentum };
}

