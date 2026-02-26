import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../components/ui';

const toLocalISO = (dateKey, timeStr) => {
  if (!dateKey) return null;
  const [h, m] = (timeStr && timeStr.length ? timeStr : '12:00').split(':').map(Number);
  const d = new Date(`${dateKey}T12:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
};

export default function AddTaskModal({ open, onClose, defaultDateKey, onSave }) {
  const [taskName, setTaskName] = useState('');
  const [dueDate, setDueDate] = useState(defaultDateKey || '');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [saving, setSaving] = useState(false);
  const isDateLocked = !!defaultDateKey;

  useEffect(() => {
    if (open && defaultDateKey) {
      setDueDate(defaultDateKey);
    }
  }, [open, defaultDateKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!taskName.trim() || !dueDate) return;
    setSaving(true);
    try {
      const dueDateIso = toLocalISO(dueDate, time);
      await onSave({
        taskName: taskName.trim(),
        dueDate: dueDateIso,
        priority,
      });
      setTaskName('');
      setDueDate(defaultDateKey || '');
      setTime('');
      setPriority('Medium');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="New Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder="Task name"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          required
        />
        {isDateLocked ? (
          <div>
            <p className="text-xs text-app-text-muted mb-1">Scheduled for</p>
            <p className="text-sm text-app-text-primary">
              {dueDate
                ? new Date(`${dueDate}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : ''}
            </p>
          </div>
        ) : (
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        )}
        <div>
          <label className="block text-xs text-app-text-muted mb-1">
            Time <span className="text-app-text-muted">(optional)</span>
          </label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </Select>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !taskName.trim()}>
            {saving ? 'Adding…' : 'Add Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
