import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal, Button, Input, Textarea } from '../../components/ui';

function toLocalISO(dateStr, timeStr = '09:00') {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const d = new Date(dateStr + 'T12:00:00');
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export default function AddEventModal({
  open,
  onClose,
  defaultDateKey,
  eventToEdit,
  onSave,
  onDelete,
}) {
  const isEdit = !!eventToEdit;
  const isDateLocked = !!defaultDateKey && !eventToEdit;
  const [title, setTitle] = useState(eventToEdit?.title ?? '');
  const [description, setDescription] = useState(eventToEdit?.description ?? '');
  const [dateKey, setDateKey] = useState(
    defaultDateKey || (eventToEdit?.start_at ? eventToEdit.start_at.slice(0, 10) : '')
  );
  const [startTime, setStartTime] = useState(
    eventToEdit?.start_at
      ? new Date(eventToEdit.start_at).toTimeString().slice(0, 5)
      : '09:00'
  );
  const [endTime, setEndTime] = useState(
    eventToEdit?.end_at
      ? new Date(eventToEdit.end_at).toTimeString().slice(0, 5)
      : '10:00'
  );
  const [location, setLocation] = useState(eventToEdit?.location ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && defaultDateKey) {
      setDateKey(defaultDateKey);
    }
  }, [open, defaultDateKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !dateKey) return;
    setSaving(true);
    try {
      const startAt = toLocalISO(dateKey, startTime);
      const endAt = toLocalISO(dateKey, endTime);
      await onSave({
        id: eventToEdit?.id,
        title: title.trim(),
        description: description.trim() || null,
        startAt,
        endAt,
        location: location.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit?.id || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(eventToEdit.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Event' : 'New Event'} maxWidth="max-w-md">
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            {isDateLocked ? (
              <>
                <label className="block text-xs text-app-text-muted mb-1">Date</label>
                <p className="text-sm text-app-text-primary py-2">
                  {dateKey
                    ? new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : ''}
                </p>
              </>
            ) : (
              <>
                <label className="block text-xs text-app-text-muted mb-1">Date</label>
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  required
                />
              </>
            )}
          </div>
          <div>
            <label className="block text-xs text-app-text-muted mb-1">Start</label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-app-text-muted mb-1">End</label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        <Input
          placeholder="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <div className="flex gap-2 justify-end pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Event'}
          </Button>
        </div>
      </motion.form>
    </Modal>
  );
}
