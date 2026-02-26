import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Flame,
  MoreVertical,
  Plus,
  Pencil,
  Archive,
  Trash2,
  Target,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button, Card, Badge } from '../ui';
import ContributionGrid from './ContributionGrid';
import { cn } from '../ui/cn';

const ICON_OPTIONS = [
  'Target',
  'Flame',
  'Droplets',
  'BookOpen',
  'Coffee',
  'Dumbbell',
  'Moon',
  'Sun',
  'Heart',
  'Zap',
  'Leaf',
  'Medal',
];

export default function HabitCard({
  habit,
  logs,
  currentStreak,
  longestStreak,
  isCompletedToday,
  todayCount,
  targetPerDay,
  onComplete,
  onUndo,
  onEdit,
  onArchive,
  onDelete,
  completionRateThisWeek,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [animating, setAnimating] = useState(false);

  const IconComponent = LucideIcons[habit.icon] || Target;
  const color = (habit.color && String(habit.color).trim()) ? habit.color : '#6e7dff';

  const handleComplete = async () => {
    setAnimating(true);
    await onComplete();
    setAnimating(false);
  };

  const handleUndo = async () => {
    await onUndo();
  };

  const isTargetMultiple = (targetPerDay ?? 1) > 1;

  return (
    <Card
        className={cn(
          'relative overflow-hidden rounded-2xl border-white/10 bg-gradient-to-br from-app-bg-secondary to-app-bg-primary/80 backdrop-blur-sm',
          'flex flex-col gap-4 p-6'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white"
              style={{ backgroundColor: color + '30' }}
            >
              <IconComponent className="h-5 w-5" style={{ color }} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-app-text-primary">{habit.title}</h3>
              {habit.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-app-text-muted">{habit.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {currentStreak > 0 && (
                  <span className="inline-flex items-center gap-1 text-app-warning">
                    <Flame className="h-3.5 w-3.5" />
                    {currentStreak} day streak
                  </span>
                )}
                {longestStreak > 0 && (
                  <span className="app-muted">Best: {longestStreak}</span>
                )}
                {completionRateThisWeek != null && (
                  <span className="app-muted">{Math.round(completionRateThisWeek)}% this week</span>
                )}
                {completionRateThisWeek === 100 && (
                  <Badge tone="success" className="text-xs">Perfect week</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <AnimatePresence mode="wait">
                {isCompletedToday ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <motion.span
                      animate={animating ? { scale: [1, 1.15, 1], boxShadow: ['0 0 0 0 rgba(110,125,255,0)', '0 0 20px 4px rgba(110,125,255,0.4)', '0 0 0 0 rgba(110,125,255,0)'] } : {}}
                      transition={{ duration: 0.5 }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-app-success bg-app-success/20 text-app-success"
                    >
                      <Check className="h-5 w-5" />
                    </motion.span>
                    {isTargetMultiple && (
                      <span className="text-xs app-muted">{todayCount}/{targetPerDay}</span>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleUndo} className="text-xs">
                      Undo
                    </Button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="add"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    type="button"
                    onClick={handleComplete}
                    disabled={animating}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 border-app-border bg-app-bg-primary',
                      'hover:border-app-accent hover:bg-app-accent/10 hover:shadow-[0_0_20px_rgba(110,125,255,0.2)] transition-ui'
                    )}
                  >
                    <Plus className="h-5 w-5 text-app-text-muted" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-app-border bg-app-bg-secondary py-1 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-app-bg-primary"
                      onClick={() => { onEdit(); setMenuOpen(false); }}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-app-bg-primary"
                      onClick={() => { onArchive(); setMenuOpen(false); }}
                    >
                      <Archive className="h-4 w-4" /> Archive
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-danger hover:bg-app-danger/10"
                      onClick={() => { onDelete(); setMenuOpen(false); }}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-app-text-muted">Last 90 days</p>
          <ContributionGrid
            habit={habit}
            logs={logs}
            targetPerDay={targetPerDay ?? 1}
          />
        </div>
      </Card>
  );
}

export { ICON_OPTIONS };
