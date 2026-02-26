import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CalendarGrid from './CalendarGrid';
import { getWeekdayLabels, getMonthLabel } from './calendarUtils';

export default function CalendarMonthView({
  year,
  month,
  dataByDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  viewMode = 'month',
  onViewModeChange,
}) {
  const weekdays = getWeekdayLabels();
  const monthLabel = getMonthLabel(month);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 md:p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPrevMonth}
          className="rounded-lg p-2 text-app-text-muted hover:bg-white/10 hover:text-app-text-primary transition-ui"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </motion.button>
        <AnimatePresence mode="wait">
          <motion.h2
            key={`${year}-${month}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="text-xl font-semibold text-app-text-primary"
          >
            {monthLabel} {year}
          </motion.h2>
        </AnimatePresence>
        {onViewModeChange && (
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => onViewModeChange('month')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'month' ? 'bg-app-accent text-white' : 'text-app-text-muted hover:bg-white/10'}`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('week')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'week' ? 'bg-app-accent text-white' : 'text-app-text-muted hover:bg-white/10'}`}
            >
              Week
            </button>
          </div>
        )}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNextMonth}
          className="rounded-lg p-2 text-app-text-muted hover:bg-white/10 hover:text-app-text-primary transition-ui"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </motion.button>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
        {weekdays.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-app-text-muted py-1"
          >
            {label}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <CalendarGrid
            year={year}
            month={month}
            dataByDay={dataByDay}
            onSelectDay={onSelectDay}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
