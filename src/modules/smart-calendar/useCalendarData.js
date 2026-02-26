import { useState, useCallback } from 'react';
import {
  getTasks,
  getHabits,
  getLogsForHabits,
  getMealPlans,
  getCalendarEvents,
  getDailyReflectionsInRange,
  getEffortAndMomentumForRange,
  getKnowledgeDatesInRange,
} from '../../services';
import { isRequiredDay } from '../../utils/streakUtils';
import { toDateKey, getMonthRange } from '../../utils/date';

export { toDateKey, getMonthRange };

/**
 * Unified calendar data hook.
 * Fetches tasks, habits + logs, meal plans, events for a month in parallel.
 * Returns: { dataByDay, habits, loading, error, refetch }
 * dataByDay[dateKey] = { tasks, habitsCompleted, habitsPending, meals, events, productivityScore }
 */
export function useCalendarData(year, month) {
  const [dataByDay, setDataByDay] = useState({});
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { startDate, endDate, endDateEod } = getMonthRange(year, month);

    try {
      const [
        tasksRes,
        habitsRes,
        mealsRes,
        eventsRes,
        reflectionsRes,
        effortMomentum,
        knowledgeDates,
      ] = await Promise.all([
        getTasks({ startDate, endDate: endDateEod }),
        getHabits({ archived: false }),
        getMealPlans(startDate, endDate),
        getCalendarEvents(startDate, endDate),
        getDailyReflectionsInRange(startDate, endDate),
        getEffortAndMomentumForRange(startDate, endDate),
        getKnowledgeDatesInRange(startDate, endDate),
      ]);

      const habitsList = habitsRes ?? [];
      const habitIds = habitsList.map((h) => h.id);
      const logsByHabit = habitIds.length
        ? await getLogsForHabits(habitIds, startDate, endDate)
        : {};

      const dayMap = {};

      const addDay = (dateKey) => {
        if (!dayMap[dateKey]) {
          dayMap[dateKey] = {
            tasks: [],
            habitsCompleted: [],
            habitsPending: [],
            meals: [],
            events: [],
          };
        }
        return dayMap[dateKey];
      };

      (tasksRes ?? []).forEach((task) => {
        const key = toDateKey(task.due_date);
        addDay(key).tasks.push(task);
      });

      habitsList.forEach((habit) => {
        const startDateStr = habit.start_date ? toDateKey(habit.start_date) : toDateKey(new Date());
        const logs = logsByHabit[habit.id] ?? [];
        const logByDate = {};
        logs.forEach((log) => {
          const dk = (log.date || '').slice(0, 10);
          logByDate[dk] = (logByDate[dk] || 0) + (log.count ?? 1);
        });
        const start = new Date(startDate + 'T12:00:00');
        const end = new Date(endDate + 'T12:00:00');
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = toDateKey(d);
          if (!isRequiredDay(dateStr, habit.frequency_type, habit.frequency_value || {}, startDateStr)) continue;
          const count = logByDate[dateStr] ?? 0;
          const target = habit.target_per_day ?? 1;
          const completed = count >= target;
          const entry = { habit, count, target, completed };
          if (completed) addDay(dateStr).habitsCompleted.push(entry);
          else addDay(dateStr).habitsPending.push(entry);
        }
      });

      (mealsRes ?? []).forEach((plan) => {
        const key = plan.planned_date ? plan.planned_date.slice(0, 10) : toDateKey(plan.planned_date);
        addDay(key).meals.push(plan);
      });

      (eventsRes ?? []).forEach((ev) => {
        const key = toDateKey(ev.start_at);
        addDay(key).events.push(ev);
      });

      (reflectionsRes ?? []).forEach((reflection) => {
        const key = toDateKey(reflection.date);
        const day = addDay(key);
        day.mood = reflection.mood;
      });

      const knowledgeDateSet = new Set(knowledgeDates ?? []);
      knowledgeDateSet.forEach((dateKey) => {
        addDay(dateKey).hasKnowledge = true;
      });

      if (effortMomentum && typeof effortMomentum === 'object') {
        Object.entries(effortMomentum).forEach(([dateKey, v]) => {
          const day = addDay(dateKey);
          day.effort =
            v.effort_score != null
              ? {
                  effort_score: v.effort_score,
                  deep_work_minutes: v.deep_work_minutes ?? null,
                }
              : null;
          day.momentum =
            v.momentum_score != null
              ? {
                  momentum_score: v.momentum_score,
                  delta: v.momentum_delta,
                  reason_breakdown: v.reason_breakdown,
                }
              : null;
        });
      }

      Object.keys(dayMap).forEach((key) => {
        const d = dayMap[key];
        const totalHabits = d.habitsCompleted.length + d.habitsPending.length;
        const completedHabits = d.habitsCompleted.length;
        const completedTasks = d.tasks.filter((t) => t.status === 'Completed').length;
        const totalTasks = d.tasks.length;
        const hasMeals = d.meals.length > 0;
        const habitPct = totalHabits ? Math.round((completedHabits / totalHabits) * 100) : 100;
        const taskPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 100;
        d.productivityScore = {
          habitsPct: habitPct,
          tasksPct: taskPct,
          mealPlanned: hasMeals,
          totalItems: totalHabits + totalTasks + d.meals.length + d.events.length,
        };
      });

      setDataByDay(dayMap);
      setHabits(habitsList);
    } catch (err) {
      setError(err.message || 'Failed to load calendar data');
      setDataByDay({});
      setHabits([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  return { dataByDay, habits, loading, error, refetch };
}
