import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from '../components/layout/AppHeader';
import { PageContainer } from '../components/ui';
import {
  createTask,
  completeTask,
  updateTask,
  createMealPlan,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  logCompletion,
  undoCompletion,
  upsertDailyReflection,
} from '../services';
import { useCalendarData, toDateKey } from '../modules/smart-calendar/useCalendarData';
import { getWeekGridDays } from '../modules/smart-calendar/calendarUtils';
import CalendarMonthView from '../modules/smart-calendar/CalendarMonthView';
import CalendarGrid from '../modules/smart-calendar/CalendarGrid';
import DayDetailsPanel from '../modules/smart-calendar/DayDetailsPanel';
import AddEventModal from '../modules/smart-calendar/AddEventModal';
import AddTaskModal from '../modules/smart-calendar/AddTaskModal';
import AddMealModal from '../modules/smart-calendar/AddMealModal';

export default function SmartCalendar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today));
  const [panelOpen, setPanelOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [addEventDefaultDate, setAddEventDefaultDate] = useState(null);
  const [addTaskDefaultDate, setAddTaskDefaultDate] = useState(null);
  const [addMealDefaultDate, setAddMealDefaultDate] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'

  const { dataByDay, loading, error, refetch } = useCalendarData(year, month);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleSelectDay = useCallback((dateKey) => {
    setSelectedDateKey(dateKey);
    setPanelOpen(true);
  }, []);

  const handlePrevMonth = useCallback(() => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const handleNextMonth = useCallback(() => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const handleAddEvent = useCallback((dateKey) => {
    setAddEventDefaultDate(dateKey || selectedDateKey);
    setEventToEdit(null);
    setEventModalOpen(true);
  }, [selectedDateKey]);

  const handleEditEvent = useCallback((ev) => {
    setEventToEdit(ev);
    setEventModalOpen(true);
  }, []);

  const handleSaveEvent = useCallback(async (payload) => {
    if (payload.id) {
      await updateCalendarEvent(payload.id, {
        title: payload.title,
        description: payload.description,
        startAt: payload.startAt,
        endAt: payload.endAt,
        location: payload.location,
      });
    } else {
      await createCalendarEvent({
        title: payload.title,
        description: payload.description,
        startAt: payload.startAt,
        endAt: payload.endAt,
        location: payload.location,
      });
    }
    setEventToEdit(null);
    setEventModalOpen(false);
    refetch();
  }, [refetch]);

  const handleAddTask = useCallback((dateKey) => {
    setAddTaskDefaultDate(dateKey || selectedDateKey);
    setTaskModalOpen(true);
  }, [selectedDateKey]);

  const handleSaveTask = useCallback(async (payload) => {
    await createTask({
      taskName: payload.taskName,
      dueDate: payload.dueDate,
      priority: payload.priority,
    });
    setTaskModalOpen(false);
    refetch();
  }, [refetch]);

  const handleToggleTask = useCallback(async (task) => {
    if (task.status === 'Completed') {
      await updateTask(task.id, { status: 'Pending', currentStatus: 'Completed' });
    } else {
      await completeTask(task.id);
    }
    refetch();
  }, [refetch]);

  const handleLogHabit = useCallback((habitId, dateKey) => {
    return logCompletion(habitId, dateKey, 1);
  }, []);
  const handleUndoHabit = useCallback((habitId, dateKey) => {
    return undoCompletion(habitId, dateKey);
  }, []);

  const handleSetMood = useCallback((dateKey, mood) => {
    return upsertDailyReflection(dateKey, mood, null);
  }, []);

  const handleAddMeal = useCallback((dateKey) => {
    setAddMealDefaultDate(dateKey || selectedDateKey);
    setMealModalOpen(true);
  }, [selectedDateKey]);

  const handleSaveMeal = useCallback(async (payload) => {
    await createMealPlan(payload);
    setMealModalOpen(false);
    refetch();
  }, [refetch]);

  const handleTodayClick = useCallback(() => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedDateKey(toDateKey(t));
    setPanelOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!panelOpen || !selectedDateKey) return;
      const d = new Date(selectedDateKey + 'T12:00:00');
      if (e.key === 'ArrowLeft') {
        d.setDate(d.getDate() - 1);
        setSelectedDateKey(toDateKey(d));
      } else if (e.key === 'ArrowRight') {
        d.setDate(d.getDate() + 1);
        setSelectedDateKey(toDateKey(d));
      } else if (e.key === 'ArrowUp') {
        d.setDate(d.getDate() - 7);
        setSelectedDateKey(toDateKey(d));
      } else if (e.key === 'ArrowDown') {
        d.setDate(d.getDate() + 7);
        setSelectedDateKey(toDateKey(d));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelOpen, selectedDateKey]);

  const dayData = selectedDateKey ? dataByDay[selectedDateKey] : null;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const weekDays = viewMode === 'week'
    ? getWeekGridDays(selectedDateKey ? new Date(selectedDateKey + 'T12:00:00') : new Date())
    : [];

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Smart Calendar"
        subtitle="Your life dashboard"
        onLogout={() => { logout(); navigate('/login'); }}
        backTo="/dashboard"
      />
      <PageContainer>
        {error && (
          <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-900/20 px-4 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-app-text-muted">
                Loading calendar…
              </div>
            ) : viewMode === 'week' ? (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 md:p-6 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-app-text-primary">This week</h2>
                  <div className="flex rounded-lg border border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setViewMode('week')}
                      className="px-3 py-1.5 text-sm bg-app-accent text-white"
                    >
                      Week
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('month')}
                      className="px-3 py-1.5 text-sm text-app-text-muted hover:bg-white/10"
                    >
                      Month
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                    <div key={label} className="text-center text-xs font-medium text-app-text-muted py-1">
                      {label}
                    </div>
                  ))}
                </div>
                <CalendarGrid
                  year={year}
                  month={month}
                  dataByDay={dataByDay}
                  onSelectDay={handleSelectDay}
                  singleWeek={weekDays}
                />
              </div>
            ) : (
              <CalendarMonthView
                year={year}
                month={month}
                dataByDay={dataByDay}
                onSelectDay={handleSelectDay}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            )}
          </div>

          {panelOpen && (
            <div className="lg:w-[380px] flex-shrink-0">
              <AnimatePresence>
                <DayDetailsPanel
                  dateKey={selectedDateKey}
                  dayData={dayData}
                  onClose={() => setPanelOpen(false)}
                  onAddEvent={handleAddEvent}
                  onAddTask={handleAddTask}
                  onAddMeal={handleAddMeal}
                  onEditEvent={handleEditEvent}
                  onToggleTask={handleToggleTask}
                  onSetMood={handleSetMood}
                  onLogHabit={handleLogHabit}
                  onUndoHabit={handleUndoHabit}
                  onRefresh={refetch}
                  isMobile={isMobile}
                />
              </AnimatePresence>
            </div>
          )}
        </div>

        <motion.button
          type="button"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleTodayClick}
          className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-app-accent text-white shadow-lg hover:shadow-app-accent/30 md:bottom-8 md:right-8"
          aria-label="Go to today"
        >
          <CalendarDays className="h-6 w-6" />
        </motion.button>
      </PageContainer>

      <AddEventModal
        open={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setEventToEdit(null); }}
        defaultDateKey={addEventDefaultDate}
        eventToEdit={eventToEdit}
        onSave={handleSaveEvent}
        onDelete={deleteCalendarEvent}
      />
      <AddTaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        defaultDateKey={addTaskDefaultDate}
        onSave={handleSaveTask}
      />
      <AddMealModal
        open={mealModalOpen}
        onClose={() => setMealModalOpen(false)}
        defaultDateKey={addMealDefaultDate}
        onSave={handleSaveMeal}
      />
    </div>
  );
}
