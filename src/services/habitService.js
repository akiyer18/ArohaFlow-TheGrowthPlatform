import { supabase } from '../config/supabase';
import { logDbError } from '../lib/db/logger';
import { computeStreaks, completionRateInRange, toDateKey } from '../utils/streakUtils';

/**
 * Habit service: CRUD for habits and habit_logs.
 * Works with Supabase (production) or LocalService client (local mode).
 */

export async function getHabits(filters = {}) {
  try {
    let query = supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.archived !== undefined) {
      query = query.eq('archived', filters.archived);
    }
    if (filters.color) {
      query = query.eq('color', filters.color);
    }

    const { data, error } = await query;
    if (error) {
      logDbError('getHabits', error);
      throw error;
    }
    return data ?? [];
  } catch (err) {
    logDbError('getHabits', err);
    throw err;
  }
}

export async function getHabitById(habitId) {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('id', habitId)
    .single();
  if (error) {
    logDbError('getHabitById', error);
    throw error;
  }
  return data;
}

export async function createHabit(habitData) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('User not authenticated');

  const payload = {
    user_id: user.id,
    title: habitData.title,
    description: habitData.description ?? null,
    color: (habitData.color && String(habitData.color).trim()) || '#6e7dff',
    icon: habitData.icon ?? 'target',
    frequency_type: habitData.frequencyType,
    frequency_value: habitData.frequencyValue ?? {},
    target_per_day: habitData.targetPerDay ?? null,
    start_date: habitData.startDate || toDateKey(new Date()),
    archived: false,
  };

  const { data, error } = await supabase.from('habits').insert([payload]).select().single();
  if (error) {
    logDbError('createHabit', error);
    throw error;
  }
  return data;
}

export async function updateHabit(habitId, updates) {
  const payload = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.icon !== undefined) payload.icon = updates.icon;
  if (updates.frequencyType !== undefined) payload.frequency_type = updates.frequencyType;
  if (updates.frequencyValue !== undefined) payload.frequency_value = updates.frequencyValue;
  if (updates.targetPerDay !== undefined) payload.target_per_day = updates.targetPerDay;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.archived !== undefined) payload.archived = updates.archived;

  const { data, error } = await supabase
    .from('habits')
    .update(payload)
    .eq('id', habitId)
    .select()
    .single();
  if (error) {
    logDbError('updateHabit', error);
    throw error;
  }
  return data;
}

export async function archiveHabit(habitId) {
  return updateHabit(habitId, { archived: true });
}

export async function deleteHabit(habitId) {
  const { error } = await supabase.from('habits').delete().eq('id', habitId);
  if (error) {
    logDbError('deleteHabit', error);
    throw error;
  }
  return true;
}

export async function getHabitLogs(habitId, options = {}) {
  let query = supabase
    .from('habit_logs')
    .select('*')
    .eq('habit_id', habitId)
    .order('date', { ascending: false });

  if (options.fromDate) query = query.gte('date', options.fromDate);
  if (options.toDate) query = query.lte('date', options.toDate);

  const { data, error } = await query;
  if (error) {
    logDbError('getHabitLogs', error);
    throw error;
  }
  return data ?? [];
}

export async function getLogsForHabits(habitIds, fromDate, toDate) {
  if (!habitIds?.length) return {};
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .in('habit_id', habitIds)
    .gte('date', fromDate)
    .lte('date', toDate);
  if (error) {
    logDbError('getLogsForHabits', error);
    throw error;
  }
  const byHabit = {};
  (data ?? []).forEach((log) => {
    if (!byHabit[log.habit_id]) byHabit[log.habit_id] = [];
    byHabit[log.habit_id].push(log);
  });
  return byHabit;
}

export async function logCompletion(habitId, dateStr, increment = 1) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('User not authenticated');

  const { data: existingRows } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('habit_id', habitId)
    .eq('date', dateStr)
    .limit(1);

  const existing = existingRows?.[0];
  if (existing) {
    const newCount = (existing.count ?? 0) + increment;
    const { data, error } = await supabase
      .from('habit_logs')
      .update({ count: newCount })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      logDbError('logCompletion (update)', error);
      throw error;
    }
    return data;
  }

  const { data, error } = await supabase
    .from('habit_logs')
    .insert([
      {
        habit_id: habitId,
        user_id: user.id,
        date: dateStr,
        count: increment,
      },
    ])
    .select()
    .single();
  if (error) {
    logDbError('logCompletion (insert)', error);
    throw error;
  }
  return data;
}

export async function undoCompletion(habitId, dateStr) {
  const { data: rows } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('habit_id', habitId)
    .eq('date', dateStr)
    .limit(1);

  const row = rows?.[0];
  if (!row) return null;
  const newCount = Math.max(0, (row.count ?? 1) - 1);
  if (newCount === 0) {
    await supabase.from('habit_logs').delete().eq('id', row.id);
    return null;
  }
  const { data, error } = await supabase
    .from('habit_logs')
    .update({ count: newCount })
    .eq('id', row.id)
    .select()
    .single();
  if (error) {
    logDbError('undoCompletion', error);
    throw error;
  }
  return data;
}

export function getStreaksForHabit(habit, logs) {
  return computeStreaks(habit, logs);
}

export function getCompletionRateThisWeek(habit, logs) {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(now);
  const fromStr = toDateKey(start);
  const toStr = toDateKey(end);
  return completionRateInRange(habit, logs, fromStr, toStr);
}
