import { useState, useCallback, useEffect } from 'react';
import {
  getKnowledgeEntries,
  getKnowledgeStats,
  upsertKnowledgeEntry,
  deleteKnowledgeEntry,
} from '../../services';

const PAGE_SIZE = 24;

export function useKnowledge() {
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    thisWeek: 0,
    currentStreak: 0,
    longestStreak: 0,
    mostUsedTag: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    tag: '',
    startDate: '',
    endDate: '',
    sourceType: '',
    ratingMin: '',
    search: '',
  });
  const [page, setPage] = useState(0);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const opts = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (filters.startDate) opts.startDate = filters.startDate;
      if (filters.endDate) opts.endDate = filters.endDate;
      if (filters.tag && filters.tag.trim()) opts.tag = filters.tag.trim();
      if (filters.sourceType) opts.sourceType = filters.sourceType;
      if (filters.ratingMin !== '' && filters.ratingMin != null) opts.ratingMin = Number(filters.ratingMin);
      if (filters.search && filters.search.trim()) opts.search = filters.search.trim();
      const { data, count } = await getKnowledgeEntries(opts);
      setEntries(data || []);
      setTotalCount(count != null ? count : 0);
    } catch (err) {
      setError(err.message || 'Failed to load entries');
      setEntries([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters.tag, filters.startDate, filters.endDate, filters.sourceType, filters.ratingMin, filters.search]);

  const loadStats = useCallback(async () => {
    try {
      const s = await getKnowledgeStats();
      setStats(s);
    } catch (_) {
      setStats({ total: 0, thisWeek: 0, currentStreak: 0, longestStreak: 0, mostUsedTag: null });
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const refetch = useCallback(() => { loadEntries(); loadStats(); }, [loadEntries, loadStats]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      tag: '',
      startDate: '',
      endDate: '',
      sourceType: '',
      ratingMin: '',
      search: '',
    });
    setPage(0);
  }, []);

  const addOrUpdateEntry = useCallback(async (payload) => {
    setSaving(true);
    setError('');
    try {
      const saved = await upsertKnowledgeEntry(payload);
      refetch();
      return saved;
    } catch (err) {
      setError(err.message || 'Failed to save');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refetch]);

  const removeEntry = useCallback(async (id) => {
    setSaving(true);
    setError('');
    try {
      await deleteKnowledgeEntry(id);
      refetch();
    } catch (err) {
      setError(err.message || 'Failed to delete');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refetch]);

  const hasMore = (page + 1) * PAGE_SIZE < totalCount;
  const loadMore = useCallback(() => setPage((p) => p + 1), []);

  return {
    entries,
    totalCount,
    stats,
    loading,
    saving,
    error,
    filters,
    setFilter,
    clearFilters,
    page,
    hasMore,
    loadMore,
    refetch,
    addOrUpdateEntry,
    removeEntry,
  };
}
