/**
 * Knowledge Expansion: structured learning entries. Paginated, filterable, streak-aware.
 */

import { supabase } from '../config/supabase';
import { getCurrentUserId } from '../config/supabase';
import { logDbError } from '../lib/db/logger';
import { toDateKey } from '../utils/date';

const SOURCE_TYPES = ['book', 'article', 'youtube', 'course', 'podcast', 'other'];

export { SOURCE_TYPES };

/**
 * Get entries with optional filters and pagination.
 * @param {Object} opts - { startDate, endDate, tag, sourceType, ratingMin, search, limit, offset }
 */
export async function getKnowledgeEntries(opts = {}) {
  try {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('knowledge_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (opts.startDate) query = query.gte('date', opts.startDate);
    if (opts.endDate) query = query.lte('date', opts.endDate);
    if (opts.tag) query = query.contains('tags', [opts.tag]);
    if (opts.sourceType) query = query.eq('source_type', opts.sourceType);
    if (opts.ratingMin != null) query = query.gte('impact_rating', opts.ratingMin);

    const limit = Math.min(opts.limit ?? 50, 100);
    const offset = opts.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    let rows = data || [];
    if (opts.search && opts.search.trim()) {
      const term = opts.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.title && r.title.toLowerCase().includes(term)) ||
          (r.content && r.content.toLowerCase().includes(term))
      );
    }

    return { data: rows, count: opts.search ? rows.length : (count ?? rows.length) };
  } catch (err) {
    logDbError('getKnowledgeEntries', err);
    throw err;
  }
}

export async function getKnowledgeEntryById(id) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (err) {
    logDbError('getKnowledgeEntryById', err);
    throw err;
  }
}

/**
 * Create or update. Payload: title, content, source?, source_type?, tags?, impact_rating?, date?
 */
export async function upsertKnowledgeEntry(payload) {
  try {
    const userId = await getCurrentUserId();
    const dateStr = payload.date ? toDateKey(payload.date) : toDateKey(new Date());
    const row = {
      user_id: userId,
      title: payload.title?.trim() || 'Untitled',
      content: payload.content?.trim() || '',
      source: payload.source?.trim() || null,
      source_type: SOURCE_TYPES.includes(payload.source_type) ? payload.source_type : null,
      tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
      impact_rating: payload.impact_rating != null && payload.impact_rating >= 1 && payload.impact_rating <= 5 ? payload.impact_rating : null,
      date: dateStr,
    };

    if (payload.id) {
      const { data, error } = await supabase
        .from('knowledge_entries')
        .update(row)
        .eq('id', payload.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('knowledge_entries')
      .insert([row])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    logDbError('upsertKnowledgeEntry', err);
    throw err;
  }
}

export async function deleteKnowledgeEntry(id) {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('knowledge_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (err) {
    logDbError('deleteKnowledgeEntry', err);
    throw err;
  }
}

/** Consecutive days with ≥1 entry. Fetches distinct dates once then computes in JS. */
export async function getKnowledgeStreak() {
  try {
    const userId = await getCurrentUserId();
    const today = toDateKey(new Date());
    const { data: rows, error } = await supabase
      .from('knowledge_entries')
      .select('date')
      .eq('user_id', userId)
      .lte('date', today);
    if (error) throw error;
    const dateSet = new Set((rows || []).map((r) => r.date).filter(Boolean));
    const sorted = Array.from(dateSet).sort();

    let current = 0;
    const d = new Date(today + 'T12:00:00');
    for (let i = 0; i < 366; i++) {
      const key = toDateKey(d);
      if (!dateSet.has(key)) break;
      current++;
      d.setDate(d.getDate() - 1);
    }

    let longest = 0;
    let run = 0;
    let prev = null;
    for (const dateStr of sorted) {
      if (prev) {
        const prevD = new Date(prev + 'T12:00:00');
        const currD = new Date(dateStr + 'T12:00:00');
        const diffDays = Math.round((currD - prevD) / 86400000);
        if (diffDays === 1) run++;
        else run = 1;
      } else run = 1;
      prev = dateStr;
      if (run > longest) longest = run;
    }

    return { currentStreak: current, longestStreak: longest };
  } catch (err) {
    logDbError('getKnowledgeStreak', err);
    return { currentStreak: 0, longestStreak: 0 };
  }
}

/** Total count, this week count, most used tag. */
export async function getKnowledgeStats() {
  try {
    const userId = await getCurrentUserId();
    const today = toDateKey(new Date());
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - 6);
    const weekStart = toDateKey(d);

    const [allRes, weekRes, streak] = await Promise.all([
      supabase.from('knowledge_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('knowledge_entries').select('id,tags').eq('user_id', userId).gte('date', weekStart).lte('date', today),
      getKnowledgeStreak(),
    ]);

    const total = allRes.count ?? 0;
    const thisWeek = (weekRes.data || []).length;
    const tagCounts = {};
    (weekRes.data || []).forEach((row) => {
      (row.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const mostUsedTag = sortedTags[0]?.[0] ?? null;

    return {
      total,
      thisWeek,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      mostUsedTag,
    };
  } catch (err) {
    logDbError('getKnowledgeStats', err);
    return { total: 0, thisWeek: 0, currentStreak: 0, longestStreak: 0, mostUsedTag: null };
  }
}

/** Return list of date strings that have at least one entry in [startDate, endDate]. For calendar. */
export async function getKnowledgeDatesInRange(startDate, endDate) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw error;
    const set = new Set((data || []).map((r) => r.date));
    return Array.from(set);
  } catch (err) {
    logDbError('getKnowledgeDatesInRange', err);
    return [];
  }
}
