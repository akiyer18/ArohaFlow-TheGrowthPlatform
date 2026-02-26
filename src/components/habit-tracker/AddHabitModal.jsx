import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Modal, Button, Input, Textarea } from '../ui';
import { ICON_OPTIONS } from './HabitCard';
import { toDateKey } from '../../utils/streakUtils';
import { cn } from '../ui/cn';

const COLORS = [
  '#6e7dff', '#1fa66a', '#d1973b', '#d9515f', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
];

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function AddHabitModal({ open, onClose, onSubmit, initialHabit }) {
  const isEdit = !!initialHabit?.id;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState('Target');
  const [frequencyType, setFrequencyType] = useState('daily');
  const [frequencyValue, setFrequencyValue] = useState({ count: 1, days: [] });
  const [targetPerDay, setTargetPerDay] = useState('');
  const [startDate, setStartDate] = useState(toDateKey(new Date()));

  useEffect(() => {
    if (open) {
      if (initialHabit) {
        setTitle(initialHabit.title || '');
        setDescription(initialHabit.description || '');
        setColor(initialHabit.color || COLORS[0]);
        setIcon(initialHabit.icon || 'Target');
        setFrequencyType(initialHabit.frequency_type || 'daily');
        setFrequencyValue(initialHabit.frequency_value || { count: 1, days: [] });
        setTargetPerDay(initialHabit.target_per_day != null ? String(initialHabit.target_per_day) : '');
        setStartDate(initialHabit.start_date ? initialHabit.start_date.slice(0, 10) : toDateKey(new Date()));
      } else {
        setTitle('');
        setDescription('');
        setColor(COLORS[0]);
        setIcon('Target');
        setFrequencyType('daily');
        setFrequencyValue({ count: 1, days: [] });
        setTargetPerDay('');
        setStartDate(toDateKey(new Date()));
      }
    }
  }, [open, initialHabit]);

  const toggleWeekday = (day) => {
    setFrequencyValue((prev) => {
      const days = prev.days?.includes(day) ? prev.days.filter((d) => d !== day) : [...(prev.days || []), day];
      return { ...prev, days };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      color: color || COLORS[0],
      icon,
      frequencyType,
      frequencyValue:
        frequencyType === 'weekly_count'
          ? { count: Math.max(1, parseInt(frequencyValue.count, 10) || 1) }
          : frequencyType === 'specific_days'
            ? { days: frequencyValue.days?.length ? frequencyValue.days : [new Date().getDay()] }
            : {},
      targetPerDay: targetPerDay === '' ? null : Math.max(1, parseInt(targetPerDay, 10) || 1),
      startDate: startDate || toDateKey(new Date()),
    };
    onSubmit(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit habit' : 'Create habit'} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-text-muted">Habit name</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Drink 8 glasses of water"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-text-muted">Description (optional)</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short instructions or reminder"
            rows={2}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-text-muted">Icon</label>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map((name) => {
              const Icon = LucideIcons[name];
              const active = icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border transition-ui',
                    active ? 'border-app-accent bg-app-accent/20' : 'border-app-border hover:border-app-accent/50'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-text-muted">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'h-8 w-8 rounded-lg border-2 transition-ui',
                  color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-text-muted">Frequency</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly_count', label: 'X times per week' },
              { value: 'specific_days', label: 'Specific days' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFrequencyType(opt.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-ui',
                  frequencyType === opt.value
                    ? 'border-app-accent bg-app-accent/20 text-app-accent'
                    : 'border-app-border hover:border-app-accent/50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {frequencyType === 'weekly_count' && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={7}
                value={frequencyValue.count ?? 1}
                onChange={(e) => setFrequencyValue((p) => ({ ...p, count: parseInt(e.target.value, 10) || 1 }))}
                className="w-20"
              />
              <span className="text-sm text-app-text-muted">times per week</span>
            </div>
          )}
          {frequencyType === 'specific_days' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {WEEKDAYS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleWeekday(value)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-xs transition-ui',
                    frequencyValue.days?.includes(value)
                      ? 'border-app-accent bg-app-accent/20'
                      : 'border-app-border'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-text-muted">Target per day (optional)</label>
          <Input
            type="number"
            min={1}
            value={targetPerDay}
            onChange={(e) => setTargetPerDay(e.target.value)}
            placeholder="1"
          />
          <p className="mt-1 text-xs text-app-text-muted">e.g. 8 for &quot;drink water 8 times&quot;</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-text-muted">Start date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-app-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{isEdit ? 'Save' : 'Create habit'}</Button>
        </div>
      </form>
    </Modal>
  );
}
