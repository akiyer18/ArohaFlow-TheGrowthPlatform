import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal, Button, Input, Textarea, Select } from '../../components/ui';
import { SOURCE_TYPES } from '../../services/knowledgeService';
import { toDateKey } from '../../utils/date';
import { Star } from 'lucide-react';

function defaultDate() {
  return toDateKey(new Date());
}

export default function AddKnowledgeModal({ open, onClose, entryToEdit, onSave, saving }) {
  const isEdit = !!entryToEdit;
  const [title, setTitle] = useState(entryToEdit?.title ?? '');
  const [content, setContent] = useState(entryToEdit?.content ?? '');
  const [source, setSource] = useState(entryToEdit?.source ?? '');
  const [sourceType, setSourceType] = useState(entryToEdit?.source_type ?? '');
  const [tags, setTags] = useState(
    Array.isArray(entryToEdit?.tags) ? entryToEdit.tags.join(', ') : ''
  );
  const [impactRating, setImpactRating] = useState(
    entryToEdit?.impact_rating != null ? String(entryToEdit.impact_rating) : ''
  );
  const [date, setDate] = useState(entryToEdit?.date ?? defaultDate());

  useEffect(() => {
    if (!open) return;
    setTitle(entryToEdit?.title ?? '');
    setContent(entryToEdit?.content ?? '');
    setSource(entryToEdit?.source ?? '');
    setSourceType(entryToEdit?.source_type ?? '');
    setTags(Array.isArray(entryToEdit?.tags) ? entryToEdit.tags.join(', ') : '');
    setImpactRating(entryToEdit?.impact_rating != null ? String(entryToEdit.impact_rating) : '');
    setDate(entryToEdit?.date ?? defaultDate());
  }, [open, entryToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const tagList = tags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    const rating = impactRating === '' ? null : Math.min(5, Math.max(1, parseInt(impactRating, 10)));
    onSave({
      id: entryToEdit?.id,
      title: title.trim(),
      content: content.trim(),
      source: source.trim() || null,
      source_type: sourceType || null,
      tags: tagList,
      impact_rating: rating,
      date,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit entry' : 'Add learning entry'}
      maxWidth="max-w-lg"
    >
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-xs text-app-text-muted">Title *</label>
          <Input
            placeholder="What did you learn?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-app-text-muted">What did you learn?</label>
          <Textarea
            placeholder="Main content / explanation"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-app-text-muted">Source (optional)</label>
            <Input
              placeholder="Book, URL, course name"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-app-text-muted">Source type</label>
            <Select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              <option value="">—</option>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-app-text-muted">Tags (comma-separated)</label>
          <Input
            placeholder="e.g. react, systems, psychology"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-app-text-muted">Impact / depth (1–5)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setImpactRating(String(r))}
                className={
                  impactRating === String(r)
                    ? 'rounded-lg border border-amber-500/50 bg-amber-500/20 p-2 text-amber-400'
                    : 'rounded-lg border border-white/10 bg-white/5 p-2 text-app-text-muted hover:bg-white/10'
                }
              >
                <Star className="h-5 w-5" />
              </button>
            ))}
            {impactRating ? (
              <button
                type="button"
                onClick={() => setImpactRating('')}
                className="rounded-lg border border-white/10 px-2 text-xs text-app-text-muted"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-app-text-muted">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
          </Button>
        </div>
      </motion.form>
    </Modal>
  );
}
