import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Plus, Target, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getHabits,
  getLogsForHabits,
  createHabit,
  updateHabit,
  archiveHabit,
  deleteHabit,
  logCompletion,
  undoCompletion,
  getStreaksForHabit,
  getCompletionRateThisWeek,
} from '../services';
import { toDateKey } from '../utils/streakUtils';
import AppHeader from '../components/layout/AppHeader';
import { Badge, Button, PageContainer, SectionHeader } from '../components/ui';
import HabitCard from '../components/habit-tracker/HabitCard';
import AddHabitModal from '../components/habit-tracker/AddHabitModal';

const SORT_OPTIONS = [
  { value: 'streak', label: 'Highest streak' },
  { value: 'recent', label: 'Recently created' },
  { value: 'completion', label: 'Completion rate' },
];

export default function HabitTracker() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [habits, setHabits] = useState([]);
  const [logsByHabit, setLogsByHabit] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active'); // active | archived
  const [sort, setSort] = useState('recent');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  const todayStr = useMemo(() => toDateKey(new Date()), []);
  const rangeEnd = todayStr;
  const rangeStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return toDateKey(d);
  })();

  useEffect(() => {
    if (user) loadAll();
  }, [user, filter]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const list = await getHabits({ archived: filter === 'archived' });
      setHabits(list);
      const ids = list.map((h) => h.id);
      const logs = await getLogsForHabits(ids, rangeStart, rangeEnd);
      setLogsByHabit(logs);
    } catch (err) {
      setError(err.message || 'Failed to load habits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && habits.length > 0) {
      const ids = habits.map((h) => h.id);
      getLogsForHabits(ids, rangeStart, rangeEnd).then(setLogsByHabit);
    }
  }, [filter]);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const stats = useMemo(() => {
    let totalActive = activeHabits.length;
    let bestStreak = 0;
    let weekCompleted = 0;
    let weekTotal = 0;
    activeHabits.forEach((h) => {
      const logs = logsByHabit[h.id] || [];
      const { longestStreak } = getStreaksForHabit(h, logs);
      if (longestStreak > bestStreak) bestStreak = longestStreak;
      const rate = getCompletionRateThisWeek(h, logs);
      weekCompleted += rate.completed;
      weekTotal += rate.total;
    });
    const overallRate = weekTotal > 0 ? (weekCompleted / weekTotal) * 100 : 0;
    return { totalActive, bestStreak, overallRate: Math.round(overallRate) };
  }, [activeHabits, logsByHabit]);

  const sortedHabits = useMemo(() => {
    const list = [...habits];
    if (sort === 'recent') return list;
    if (sort === 'streak') {
      return list.sort((a, b) => {
        const logsA = logsByHabit[a.id] || [];
        const logsB = logsByHabit[b.id] || [];
        const longA = getStreaksForHabit(a, logsA).longestStreak;
        const longB = getStreaksForHabit(b, logsB).longestStreak;
        return longB - longA;
      });
    }
    if (sort === 'completion') {
      return list.sort((a, b) => {
        const logsA = logsByHabit[a.id] || [];
        const logsB = logsByHabit[b.id] || [];
        const rateA = getCompletionRateThisWeek(a, logsA).rate;
        const rateB = getCompletionRateThisWeek(b, logsB).rate;
        return rateB - rateA;
      });
    }
    return list;
  }, [habits, sort, logsByHabit]);

  const handleCreate = async (payload) => {
    await createHabit(payload);
    setAddModalOpen(false);
    loadAll();
  };

  const handleUpdate = async (payload) => {
    if (!editingHabit?.id) return;
    await updateHabit(editingHabit.id, {
      title: payload.title,
      description: payload.description,
      color: payload.color,
      icon: payload.icon,
      frequencyType: payload.frequencyType,
      frequencyValue: payload.frequencyValue,
      targetPerDay: payload.targetPerDay,
      startDate: payload.startDate,
    });
    setEditingHabit(null);
    loadAll();
  };

  const handleArchive = async (habit) => {
    await archiveHabit(habit.id);
    loadAll();
  };

  const handleDelete = async (habit) => {
    if (!window.confirm(`Delete "${habit.title}"? This cannot be undone.`)) return;
    await deleteHabit(habit.id);
    loadAll();
  };

  const handleComplete = async (habit) => {
    await logCompletion(habit.id, todayStr, 1);
    setLogsByHabit((prev) => {
      const next = { ...prev };
      const arr = next[habit.id] || [];
      const existing = arr.find((l) => (l.date?.slice ? l.date.slice(0, 10) : l.date) === todayStr);
      if (existing) existing.count = (existing.count || 0) + 1;
      else arr.push({ habit_id: habit.id, date: todayStr, count: 1 });
      next[habit.id] = arr;
      return next;
    });
  };

  const handleUndo = async (habit) => {
    await undoCompletion(habit.id, todayStr);
    setLogsByHabit((prev) => {
      const next = { ...prev };
      const arr = (next[habit.id] || []).filter((l) => (l.date?.slice ? l.date.slice(0, 10) : l.date) !== todayStr);
      const existing = (next[habit.id] || []).find((l) => (l.date?.slice ? l.date.slice(0, 10) : l.date) === todayStr);
      if (existing && existing.count > 1) {
        arr.push({ ...existing, count: existing.count - 1 });
      }
      next[habit.id] = arr;
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Habit Tracker" subtitle="Build consistency" onLogout={() => { logout(); navigate('/login'); }} backTo="/dashboard" />
        <PageContainer><div className="app-muted">Loading…</div></PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Habit Tracker"
        subtitle="Build consistency"
        onLogout={() => { logout(); navigate('/login'); }}
        backTo="/dashboard"
      />
      <PageContainer className="max-w-5xl">
        <SectionHeader
          title="Habit Tracker"
          subtitle="Track daily habits, streaks, and progress."
          actions={
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4" /> Add habit
            </Button>
          }
        />

        {error && (
          <div className="mb-4 rounded-lg border border-app-danger/50 bg-app-danger/10 px-4 py-2 text-sm text-app-danger">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {['active', 'archived'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-ui ${
                  filter === f ? 'border-app-accent bg-app-accent/20' : 'border-app-border hover:border-app-accent/50'
                }`}
              >
                {f === 'active' ? 'Active' : 'Archived'}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-app-border bg-app-bg-secondary px-3 py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {filter === 'active' && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-app-bg-secondary/80 to-app-bg-primary/60 p-6 backdrop-blur-sm sm:grid-cols-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-app-accent/20">
                <Target className="h-5 w-5 text-app-accent" />
              </span>
              <div>
                <p className="text-2xl font-semibold">{stats.totalActive}</p>
                <p className="text-xs text-app-text-muted">Active habits</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-app-warning/20">
                <Flame className="h-5 w-5 text-app-warning" />
              </span>
              <div>
                <p className="text-2xl font-semibold">{stats.overallRate}%</p>
                <p className="text-xs text-app-text-muted">This week</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-app-success/20">
                <Trophy className="h-5 w-5 text-app-success" />
              </span>
              <div>
                <p className="text-2xl font-semibold">{stats.bestStreak}</p>
                <p className="text-xs text-app-text-muted">Best streak</p>
              </div>
            </div>
          </motion.section>
        )}

        {sortedHabits.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-app-border bg-app-bg-secondary/50 p-12 text-center"
          >
            <Target className="mx-auto h-12 w-12 text-app-text-muted" />
            <p className="mt-4 font-medium text-app-text-primary">
              {filter === 'archived' ? 'No archived habits' : 'No habits yet'}
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              {filter === 'archived' ? 'Archive habits from the card menu.' : 'Create your first habit to start tracking.'}
            </p>
            {filter === 'active' && (
              <Button className="mt-4" onClick={() => setAddModalOpen(true)}>
                <Plus className="h-4 w-4" /> Add habit
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="app-grid grid-cols-1 lg:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {sortedHabits.map((habit) => {
                const logs = logsByHabit[habit.id] || [];
                const { currentStreak, longestStreak } = getStreaksForHabit(habit, logs);
                const todayLog = logs.find((l) => (l.date?.slice ? l.date.slice(0, 10) : l.date) === todayStr);
                const todayCount = todayLog?.count ?? 0;
                const targetPerDay = habit.target_per_day ?? 1;
                const isCompletedToday = todayCount >= targetPerDay;
                const rate = getCompletionRateThisWeek(habit, logs);

                return (
                  <motion.div key={habit.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <HabitCard
                      habit={habit}
                      logs={logs}
                      currentStreak={currentStreak}
                      longestStreak={longestStreak}
                      isCompletedToday={isCompletedToday}
                      todayCount={todayCount}
                      targetPerDay={targetPerDay}
                      completionRateThisWeek={rate.rate}
                      onComplete={() => handleComplete(habit)}
                      onUndo={() => handleUndo(habit)}
                      onEdit={() => setEditingHabit(habit)}
                      onArchive={() => handleArchive(habit)}
                      onDelete={() => handleDelete(habit)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <AddHabitModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onSubmit={handleCreate}
        />
        <AddHabitModal
          open={!!editingHabit}
          onClose={() => setEditingHabit(null)}
          onSubmit={handleUpdate}
          initialHabit={editingHabit}
        />
      </PageContainer>
    </div>
  );
}
