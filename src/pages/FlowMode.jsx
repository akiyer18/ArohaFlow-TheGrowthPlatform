import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Circle, Flame, Play, Square } from 'lucide-react';
import AppHeader from '../components/layout/AppHeader';
import { PageContainer } from '../components/ui';
import {
  getTasks,
  getHabits,
  getLogsForHabits,
  completeTask,
  updateTask,
  logCompletion,
  getTodayEffortAndMomentum,
  createFlowSession,
} from '../services';
import { isRequiredDay } from '../utils/streakUtils';
import { toDateKey } from '../utils/date';

export default function FlowMode() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const today = toDateKey(new Date());
  const todayStart = `${today}T00:00:00.000Z`;
  const todayEnd = `${today}T23:59:59.999Z`;

  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [effort, setEffort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [savingSession, setSavingSession] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, habitsRes, effortMomentum] = await Promise.all([
        getTasks({ startDate: todayStart, endDate: todayEnd }),
        getHabits({ archived: false }),
        getTodayEffortAndMomentum(),
      ]);
      setTasks(tasksRes ?? []);
      setEffort(effortMomentum?.effort ?? null);
      const habitList = habitsRes ?? [];
      if (!habitList.length) {
        setHabits([]);
        setLoading(false);
        return;
      }
      const habitIds = habitList.map((h) => h.id);
      const logsByHabit = await getLogsForHabits(habitIds, today, today);
      const countByHabit = {};
      Object.entries(logsByHabit || {}).forEach(([hid, logs]) => {
        const total = (logs || []).reduce((s, log) => s + (log.count ?? 1), 0);
        if (total > 0) countByHabit[hid] = total;
      });
      const startDateStr = today;
      const withStatus = habitList
        .filter((habit) => {
          const start = habit.start_date ? toDateKey(habit.start_date) : today;
          return isRequiredDay(today, habit.frequency_type, habit.frequency_value || {}, start);
        })
        .map((habit) => {
          const count = countByHabit[habit.id] ?? 0;
          const target = habit.target_per_day ?? 1;
          return { habit, count, target, completed: count >= target };
        });
      setHabits(withStatus);
    } catch (err) {
      console.error('FlowMode load', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleStartPause = useCallback(() => {
    if (timerRunning) {
      setTimerRunning(false);
    } else {
      setTimerStartedAt((prev) => prev || Date.now());
      setTimerRunning(true);
    }
  }, [timerRunning]);

  const handleSaveSession = useCallback(async () => {
    const minutes = Math.floor(timerSeconds / 60);
    if (minutes < 1) return;
    setSavingSession(true);
    try {
      await createFlowSession(today, minutes);
      setTimerSeconds(0);
      setTimerStartedAt(null);
      setTimerRunning(false);
      await load();
    } catch (err) {
      console.error('Save flow session', err);
    } finally {
      setSavingSession(false);
    }
  }, [today, timerSeconds, load]);

  const handleToggleTask = useCallback(
    async (task) => {
      try {
        if (task.status === 'Completed') {
          await updateTask(task.id, { status: 'Pending', currentStatus: 'Completed' });
        } else {
          await completeTask(task.id);
        }
        load();
      } catch (err) {
        console.error('Toggle task', err);
      }
    },
    [load]
  );

  const handleLogHabit = useCallback(
    async (habitId) => {
      try {
        await logCompletion(habitId, today, 1);
        load();
      } catch (err) {
        console.error('Log habit', err);
      }
    },
    [today, load]
  );

  const effortPct = effort?.effort_score ?? 0;
  const timerDisplay = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-950/95 text-slate-100">
      <AppHeader
        title="Flow Mode"
        subtitle="Focus on today"
        onLogout={() => { logout(); navigate('/login'); }}
        backTo="/dashboard"
      />
      <PageContainer className="max-w-2xl">
        {/* Live effort bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Today&apos;s effort</span>
            <span>{effortPct}/100</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, effortPct)}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>

        {/* Timer */}
        <motion.section
          className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              <Flame className="h-5 w-5 text-amber-400" />
              <span className="text-sm">Deep work</span>
            </div>
            <span className="text-4xl font-mono tabular-nums text-slate-100">{timerDisplay}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleStartPause}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-medium hover:bg-white/15 transition-colors"
            >
              {timerRunning ? (
                <>
                  <Square className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={timerSeconds < 60 || savingSession}
              className="rounded-xl border border-emerald-500/50 bg-emerald-500/20 py-3 px-4 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {savingSession ? 'Saving…' : 'Save session'}
            </button>
          </div>
          {timerSeconds > 0 && timerSeconds < 60 && (
            <p className="mt-2 text-xs text-slate-500">Log at least 1 minute to save.</p>
          )}
        </motion.section>

        {/* Today's commitments */}
        {loading ? (
          <div className="text-center text-slate-500 py-8">Loading…</div>
        ) : (
          <>
            <section className="mb-6">
              <h2 className="text-sm font-medium text-slate-400 mb-3">Tasks</h2>
              <ul className="space-y-2">
                {tasks.length === 0 ? (
                  <li className="text-sm text-slate-500 py-2">No tasks due today</li>
                ) : (
                  tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        className="flex-shrink-0 rounded p-1 hover:bg-white/10"
                        aria-label={task.status === 'Completed' ? 'Mark incomplete' : 'Complete'}
                      >
                        {task.status === 'Completed' ? (
                          <Check className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-500" />
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          task.status === 'Completed' ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}
                      >
                        {task.task_name}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-medium text-slate-400 mb-3">Habits</h2>
              <ul className="space-y-2">
                {habits.length === 0 ? (
                  <li className="text-sm text-slate-500 py-2">No habits due today</li>
                ) : (
                  habits.map(({ habit, count, target, completed }) => (
                    <li
                      key={habit.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => !completed && handleLogHabit(habit.id)}
                        className="flex-shrink-0 rounded p-1 hover:bg-white/10"
                        aria-label={completed ? 'Done' : 'Mark complete'}
                      >
                        {completed ? (
                          <Check className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-500" />
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          completed ? 'text-slate-400' : 'text-slate-200'
                        }`}
                      >
                        {habit.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        {count}/{target}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        )}
      </PageContainer>
    </div>
  );
}
