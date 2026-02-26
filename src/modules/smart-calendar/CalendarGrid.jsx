import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { getMonthGridDays } from './calendarUtils';

const DOT_COLORS = {
  habit: (color) => color || '#6e7dff',
  task: '#95a0b5',
  meal: '#1fa66a',
  event: '#6e7dff',
  knowledge: '#a78bfa',
};

/** Effort 0-100 → ring color (low: amber, high: emerald). */
function effortRingColor(score) {
  if (score == null) return 'transparent';
  if (score >= 70) return '#34d399';
  if (score >= 40) return '#818cf8';
  return '#f59e0b';
}

function DayCell({ dayInfo, dayData, onSelectDay }) {
  const { dateKey, isCurrentMonth, isToday } = dayInfo;
  const data = dayData || {
    tasks: [],
    habitsCompleted: [],
    habitsPending: [],
    meals: [],
    events: [],
  };
  const mood = dayData?.mood;
  const effortScore = dayData?.effort?.effort_score ?? null;
  const deepWorkMinutes = dayData?.effort?.deep_work_minutes ?? 0;
  const momentumDelta = dayData?.momentum?.delta ?? null;
  const dots = [];
  data.habitsCompleted.forEach(({ habit }) => {
    dots.push({ type: 'habit', color: DOT_COLORS.habit(habit?.color), completed: true });
  });
  data.habitsPending.forEach(() => {
    dots.push({ type: 'habit', color: 'rgba(148,163,184,0.5)', completed: false });
  });
  if (data.tasks.length) dots.push({ type: 'task', color: DOT_COLORS.task });
  if (data.meals.length) dots.push({ type: 'meal', color: DOT_COLORS.meal });
  if (data.events.length) dots.push({ type: 'event', color: DOT_COLORS.event });
  if (dayData?.hasKnowledge) dots.push({ type: 'knowledge', color: DOT_COLORS.knowledge });
  const moreCount = dots.length > 4 ? dots.length - 3 : 0;
  const displayDots = moreCount ? dots.slice(0, 3) : dots;

  let moodBarClass = '';
  if (mood === 'great') moodBarClass = 'bg-emerald-500/70';
  else if (mood === 'good') moodBarClass = 'bg-emerald-400/60';
  else if (mood === 'neutral') moodBarClass = 'bg-slate-500/60';
  else if (mood === 'low') moodBarClass = 'bg-amber-400/70';
  else if (mood === 'difficult') moodBarClass = 'bg-rose-500/70';

  const ringColor = effortRingColor(effortScore);

  return (
    <motion.button
      type="button"
      layout
      initial={false}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelectDay(dateKey)}
      className={`
        min-h-[80px] md:min-h-[100px] rounded-xl border text-left p-2 transition-all duration-200
        ${isCurrentMonth
          ? 'bg-white/5 border-white/10 text-app-text-primary hover:bg-white/10 hover:border-white/20'
          : 'bg-white/[0.02] border-white/5 text-app-text-muted'}
        ${isToday ? 'ring-2 ring-app-accent/50 shadow-lg shadow-app-accent/10' : ''}
      `}
      style={
        ringColor !== 'transparent'
          ? { borderLeftWidth: '3px', borderLeftColor: ringColor }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`text-sm font-medium ${isToday ? 'text-app-accent' : ''}`}>
          {dayInfo.date.getDate()}
        </span>
        {momentumDelta != null && momentumDelta !== 0 && (
          <span
            className={`text-[10px] font-medium ${
              momentumDelta > 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}
            title="Momentum change"
          >
            {momentumDelta > 0 ? '↑' : '↓'} {Math.abs(momentumDelta)}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-0.5">
        {deepWorkMinutes > 0 && (
          <span className="text-amber-400" title={`Deep work: ${deepWorkMinutes} min`}>
            <Flame className="h-3.5 w-3.5" />
          </span>
        )}
        {displayDots.map((dot, i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: dot.color,
              opacity: dot.completed === false ? 0.7 : 1,
            }}
            title={dot.type}
          />
        ))}
        {moreCount > 0 && (
          <span className="text-[10px] text-app-text-muted pl-0.5">+{moreCount}</span>
        )}
      </div>
      {moodBarClass ? (
        <div className={`mt-2 h-1 w-full rounded-full ${moodBarClass}`} />
      ) : null}
    </motion.button>
  );
}

export default function CalendarGrid({ year, month, dataByDay, onSelectDay, singleWeek }) {
  const gridDays = singleWeek && singleWeek.length ? singleWeek : getMonthGridDays(year, month);

  return (
    <div className="grid grid-cols-7 gap-1 md:gap-2">
      {gridDays.map((dayInfo) => (
        <DayCell
          key={dayInfo.dateKey}
          dayInfo={dayInfo}
          dayData={dataByDay[dayInfo.dateKey]}
          onSelectDay={onSelectDay}
        />
      ))}
    </div>
  );
}
