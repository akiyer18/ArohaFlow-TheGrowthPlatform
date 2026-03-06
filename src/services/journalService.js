/**
 * Minimal-friction journal: optional fields, autosave, auto metadata.
 */

import { supabase } from '../config/supabase';
import { logDbError } from '../lib/db/logger';
import { getTodayEffortAndMomentum } from './momentumEngineService';
import { getTimeTheme } from '../utils/timeTheme';
import { toDateKey } from '../utils/date';
import { getCurrentUserId } from '../config/supabase';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Prompt pool: one prompt per day (deterministic by date string so same prompt all day). */
export const JOURNAL_PROMPTS = [
  'What went well today?',
  'What challenged me today?',
  'What did I learn today?',
  'When did I feel most present?',
  'What mattered most today?',
  'What drained my energy?',
  'Something I want to remember.',
];

/** Pick one prompt for the day (stable per date). */
export function getPromptForDate(dateStr) {
  const hash = dateStr.split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  const index = Math.abs(hash) % JOURNAL_PROMPTS.length;
  return { key: String(index), text: JOURNAL_PROMPTS[index] };
}

/** Consecutive days with a journal entry ending on dateStr (counting backwards). */
export async function getJournalStreak(dateStr) {
  try {
    const userId = await getCurrentUserId();
    let count = 0;
    const d = new Date(dateStr + 'T12:00:00');
    for (let i = 0; i < 366; i++) {
      const key = toDateKey(d);
      const { data } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('date', key)
        .limit(1)
        .maybeSingle();
      if (!data) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  } catch (err) {
    logDbError('getJournalStreak', err);
    return 0;
  }
}

/** Get journal entry for a specific date (or null). */
export async function getJournalEntryByDate(dateStr) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (err) {
    logDbError('getJournalEntryByDate', err);
    throw err;
  }
}

/** Get today's entry (or null). */
export async function getTodayJournalEntry() {
  const dateStr = toDateKey(new Date());
  return getJournalEntryByDate(dateStr);
}

/** Get list of dates that have journal entries in range (for log history). */
export async function getJournalDatesWithEntries(startDate, endDate) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => r.date);
  } catch (err) {
    logDbError('getJournalDatesWithEntries', err);
    return [];
  }
}

/** Build metadata (no user input). */
async function buildMetadata(dateStr, sessionLengthSeconds = null) {
  const now = new Date();
  const weekday = WEEKDAYS[now.getDay()];
  const { period: timeOfDay } = getTimeTheme();
  const streak = await getJournalStreak(dateStr);
  let momentumScore = null;
  try {
    const { momentum } = await getTodayEffortAndMomentum();
    if (momentum?.momentum_score != null) momentumScore = momentum.momentum_score;
  } catch (_) {}
  return {
    timestamp: now.toISOString(),
    weekday,
    timeOfDay,
    streak,
    momentumScore,
    sessionLength: sessionLengthSeconds,
    activeModules: null,
  };
}

/**
 * Upsert journal entry for the given date. All fields optional.
 * Fills metadata automatically (timestamp, weekday, timeOfDay, streak, momentumScore, sessionLength).
 */
export async function upsertJournalEntry(payload, sessionLengthSeconds = null) {
  try {
    const userId = await getCurrentUserId();
    const dateStr = payload.date || toDateKey(new Date());
    const { prompt_key } = payload;
    const prompt = prompt_key != null ? { key: prompt_key, text: JOURNAL_PROMPTS[Number(prompt_key)] ?? '' } : getPromptForDate(dateStr);

    const metadata = await buildMetadata(dateStr, sessionLengthSeconds);

    const row = {
      user_id: userId,
      date: dateStr,
      mood: payload.mood ?? null,
      energy: payload.energy ?? null,
      focus: payload.focus ?? null,
      stress: payload.stress ?? null,
      reflection_text: payload.reflectionText ?? payload.reflection_text ?? null,
      small_win: payload.smallWin ?? payload.small_win ?? null,
      tomorrow_intention: payload.tomorrowIntention ?? payload.tomorrow_intention ?? null,
      confidence_tomorrow: payload.confidenceTomorrow ?? payload.confidence_tomorrow ?? null,
      prompt_key: payload.prompt_key ?? prompt.key,
      metadata: { ...(payload.metadata || {}), ...metadata },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('journal_entries')
      .upsert([row], { onConflict: 'user_id,date' })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    logDbError('upsertJournalEntry', err);
    throw err;
  }
}
