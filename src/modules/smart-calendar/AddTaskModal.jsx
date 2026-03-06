import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../components/ui';

export default function AddTaskModal({ open, onClose, defaultDateKey, onSave }) {
  const [taskName, setTaskName] = useState('');
  const [dueDate, setDueDate] = useState(defaultDateKey || '');
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
    if (!taskName.trim()) return;
    setSaving(true);
    try {
      const dueDateIso = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null;
      await onSave({
        taskName: taskName.trim(),
        dueDate: dueDateIso,
        priority,
      });
      setTaskName('');
      setDueDate(defaultDateKey || '');
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
          />
        )}
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
