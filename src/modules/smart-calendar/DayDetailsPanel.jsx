import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Check,
  Circle,
  UtensilsCrossed,
  Calendar,
  Plus,
  X,
  ChevronRight,
  TrendingUp,
  Zap,
  BookOpen,
} from 'lucide-react';
import { Button } from '../../components/ui';

function formatEventTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatEventRange(startAt, endAt) {
  const start = formatEventTime(startAt);
  const end = formatEventTime(endAt);
  if (end && end !== start) return `${start} – ${end}`;
  return start;
}

export default function DayDetailsPanel({
  dateKey,
  dayData,
  onClose,
  onAddEvent,
  onAddTask,
  onAddMeal,
  onEditEvent,
  onToggleTask,
  onSetMood,
  onLogHabit,
  onUndoHabit,
  onRefresh,
  isMobile,
}) {
  const data = dayData || {
    tasks: [],
    habitsCompleted: [],
    habitsPending: [],
    meals: [],
    events: [],
    productivityScore: {},
  };
  const score = data.productivityScore || {};
  const effort = data.effort;
  const momentum = data.momentum;
  const reasonBreakdown = momentum?.reason_breakdown;
  const dateLabel = dateKey
    ? new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const breakdownLines = [];
  if (reasonBreakdown && typeof reasonBreakdown === 'object') {
    if (reasonBreakdown.consistency_bonus > 0) breakdownLines.push(`Consistency +${reasonBreakdown.consistency_bonus}`);
    if (reasonBreakdown.all_habits) breakdownLines.push('All habits +10');
    if (reasonBreakdown.streak_3) breakdownLines.push('3-day streak +5');
    if (reasonBreakdown.streak_7) breakdownLines.push('7-day streak +15');
    if (reasonBreakdown.streak_30) breakdownLines.push('30-day streak +40');
    if (reasonBreakdown.miss_penalty > 0) breakdownLines.push(`Penalties −${reasonBreakdown.miss_penalty}`);
    if (reasonBreakdown.missed_habits) breakdownLines.push('Missed habits −10 each');
    if (reasonBreakdown.overdue_tasks) breakdownLines.push('Overdue tasks −5 each');
    if (reasonBreakdown.zero_effort) breakdownLines.push('Zero effort −25');
    if (reasonBreakdown.two_bad_days) breakdownLines.push('2 bad days −30');
    if (reasonBreakdown.inactive_decay) breakdownLines.push('Inactive decay');
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className={`
        flex flex-col h-full bg-white/5 backdrop-blur-xl border-l border-white/10
        ${isMobile ? 'fixed inset-0 z-50' : 'w-full max-w-md'}
      `}
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h2 className="text-lg font-semibold text-app-text-primary">{dateLabel}</h2>
          {(score.habitsPct != null || score.tasksPct != null) && (
            <p className="text-xs text-app-text-muted mt-0.5">
              Habits {score.habitsPct ?? 0}% · Tasks {score.tasksPct ?? 0}%
              {score.mealPlanned ? ' · Meal planned' : ''}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Momentum & Effort */}
        {(effort?.effort_score != null || momentum?.momentum_score != null) && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-3">
            <h3 className="text-sm font-medium text-app-text-primary mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-app-accent" />
              Momentum
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              {effort?.effort_score != null && (
                <div>
                  <span className="text-xs text-app-text-muted">Effort </span>
                  <span className="text-sm font-semibold text-app-text-primary">{effort.effort_score}/100</span>
                </div>
              )}
              {momentum?.momentum_score != null && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-app-text-muted" />
                  <span className="text-sm font-semibold text-app-text-primary">{momentum.momentum_score}/1000</span>
                  {momentum.delta != null && momentum.delta > 0 && (
                    <span className="text-emerald-400">
                      ↑ {momentum.delta}
                    </span>
                  )}
                </div>
              )}
            </div>
            {breakdownLines.length > 0 && (
              <p className="text-xs text-app-text-muted mt-2">
                {breakdownLines.join(' · ')}
              </p>
            )}
          </section>
        )}

        {/* Knowledge entry indicator */}
        {data.hasKnowledge && (
          <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
            <Link
              to="/knowledge-expansion"
              className="flex items-center gap-2 text-sm text-violet-200 hover:text-violet-100"
            >
              <BookOpen className="h-4 w-4 text-violet-400" />
              <span>Knowledge entry this day</span>
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          </section>
        )}

        {/* Daily mood / reflection */}
        <section>
          <h3 className="text-sm font-medium text-app-text-primary mb-2">
            How did today feel?
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'great', label: 'Great' },
              { id: 'good', label: 'Good' },
              { id: 'neutral', label: 'Neutral' },
              { id: 'low', label: 'Low' },
              { id: 'difficult', label: 'Difficult' },
            ].map((option) => {
              const active = data.mood === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSetMood && onSetMood(dateKey, option.id).then(onRefresh)}
                  className={`rounded-full px-3 py-1 text-xs border transition-ui ${
                    active
                      ? 'border-app-accent bg-app-accent/20 text-app-accent'
                      : 'border-white/15 text-app-text-muted hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Habits */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-app-text-primary flex items-center gap-2">
              <Check className="h-4 w-4 text-app-success" />
              Habits
            </h3>
          </div>
          <ul className="space-y-1.5">
            {data.habitsCompleted.map(({ habit, count, target }) => (
              <li
                key={habit.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white/5 border border-white/10"
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: habit.color || '#6e7dff' }}
                />
                <span className="text-sm text-app-text-primary flex-1">{habit.title}</span>
                {onUndoHabit ? (
                  <button
                    type="button"
                    onClick={() => onUndoHabit(habit.id, dateKey).then(onRefresh)}
                    className="rounded p-1 hover:bg-white/10 text-app-success flex-shrink-0"
                    title="Mark incomplete"
                    aria-label="Mark habit incomplete"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <Check className="h-4 w-4 text-app-success flex-shrink-0" />
                )}
                <span className="text-xs text-app-text-muted">{count}/{target}</span>
              </li>
            ))}
            {data.habitsPending.map(({ habit, count, target }) => (
              <li
                key={habit.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white/5 border border-white/10 opacity-80"
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: habit.color || '#6e7dff' }}
                />
                <span className="text-sm text-app-text-muted flex-1">{habit.title}</span>
                {onLogHabit ? (
                  <button
                    type="button"
                    onClick={() => onLogHabit(habit.id, dateKey).then(onRefresh)}
                    className="rounded border border-white/20 p-1 hover:bg-white/10 flex-shrink-0"
                    title="Mark complete"
                    aria-label="Mark habit complete"
                  >
                    <Circle className="h-4 w-4 text-app-text-muted" />
                  </button>
                ) : (
                  <Circle className="h-4 w-4 text-app-text-muted flex-shrink-0" />
                )}
                <span className="text-xs text-app-text-muted">{count}/{target}</span>
              </li>
            ))}
            {data.habitsCompleted.length === 0 && data.habitsPending.length === 0 && (
              <li className="text-sm text-app-text-muted py-2">No habits due this day</li>
            )}
          </ul>
        </section>

        {/* Tasks */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-app-text-primary flex items-center gap-2">
              <Circle className="h-4 w-4 text-app-accent" />
              Tasks
            </h3>
            <Button variant="ghost" size="sm" onClick={() => onAddTask(dateKey)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ul className="space-y-1.5">
            {data.tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white/5 border border-white/10"
              >
                <button
                  type="button"
                  onClick={() => onToggleTask(task).then(onRefresh)}
                  className="flex-shrink-0 rounded border border-white/20 p-0.5 hover:bg-white/10"
                  aria-label={task.status === 'Completed' ? 'Mark incomplete' : 'Complete'}
                >
                  {task.status === 'Completed' ? (
                    <Check className="h-4 w-4 text-app-success" />
                  ) : (
                    <Circle className="h-4 w-4 text-app-text-muted" />
                  )}
                </button>
                <span
                  className={`text-sm flex-1 ${
                    task.status === 'Completed' ? 'line-through text-app-text-muted' : 'text-app-text-primary'
                  }`}
                >
                  {task.task_name}
                </span>
                {task.priority && (
                  <span className="text-xs text-app-text-muted">{task.priority}</span>
                )}
              </li>
            ))}
            {data.tasks.length === 0 && (
              <li className="text-sm text-app-text-muted py-2">No tasks due</li>
            )}
          </ul>
        </section>

        {/* Meals */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-app-text-primary flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-app-success" />
              Meals
            </h3>
            <Button variant="ghost" size="sm" onClick={() => onAddMeal(dateKey)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ul className="space-y-1.5">
            {data.meals.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 bg-white/5 border border-white/10"
              >
                <span className="text-sm text-app-text-primary capitalize">{plan.meal_type}</span>
                <span className="text-sm text-app-text-muted">{plan.recipe_name || 'Recipe'}</span>
                <ChevronRight className="h-4 w-4 text-app-text-muted" />
              </li>
            ))}
            {data.meals.length === 0 && (
              <li className="text-sm text-app-text-muted py-2">No meals planned</li>
            )}
          </ul>
        </section>

        {/* Events */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-app-text-primary flex items-center gap-2">
              <Calendar className="h-4 w-4 text-app-accent" />
              Events
            </h3>
            <Button variant="ghost" size="sm" onClick={() => onAddEvent(dateKey)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ul className="space-y-1.5">
            {data.events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-lg px-3 py-2 bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-app-text-primary">{ev.title}</p>
                    <p className="text-xs text-app-text-muted">
                      {formatEventRange(ev.start_at, ev.end_at)}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditEvent(ev)}
                    aria-label="Edit event"
                  >
                    Edit
                  </Button>
                </div>
              </li>
            ))}
            {data.events.length === 0 && (
              <li className="text-sm text-app-text-muted py-2">No events</li>
            )}
          </ul>
        </section>
      </div>
    </motion.div>
  );
}
