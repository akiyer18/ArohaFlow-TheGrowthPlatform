import React from 'react';
import { motion } from 'framer-motion';
import { Modal, Button } from '../../components/ui';
import { Star, BookOpen, Calendar, Tag, Pencil, Trash2 } from 'lucide-react';

export default function ViewKnowledgeModal({ open, onClose, entry, onEdit, onDelete }) {
  if (!open || !entry) return null;

  const rating = entry.impact_rating != null && entry.impact_rating >= 1 && entry.impact_rating <= 5 ? entry.impact_rating : null;
  const tags = Array.isArray(entry.tags) ? entry.tags : [];

  const contentLines =
    typeof entry.content === 'string'
      ? entry.content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  const looksNumbered = contentLines.filter((line) => /^\d+[\).\-\)]\s+/.test(line)).length >= 2;

  return (
    <Modal open={open} onClose={onClose} title={entry.title || 'Untitled'} maxWidth="max-w-4xl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {rating != null && (
          <div className="flex items-center gap-1.5 text-amber-400">
            {[1, 2, 3, 4, 5].map((r) => (
              <Star
                key={r}
                className={`h-5 w-5 ${r <= rating ? 'fill-current' : 'opacity-30'}`}
              />
            ))}
            <span className="ml-1 text-sm text-app-text-muted">Impact</span>
          </div>
        )}
        {entry.source && (
          <div className="flex items-center gap-2 text-sm text-violet-300/90">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>{entry.source}</span>
            {entry.source_type && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs capitalize">
                {entry.source_type}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-app-text-muted">
          <Calendar className="h-4 w-4" />
          {entry.date}
        </div>
        {entry.content && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 max-h-[70vh] overflow-y-auto">
            {looksNumbered && contentLines.length > 0 ? (
              <ol className="list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-app-text-primary">
                {contentLines.map((line, idx) => (
                  <li key={idx} className="font-medium">
                    {line.replace(/^\d+[\).\-\)]\s+/, '')}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="space-y-3 text-[15px] leading-relaxed text-app-text-primary">
                {contentLines.length > 0 ? (
                  contentLines.map((line, idx) => (
                    <p key={idx} className="font-medium">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="whitespace-pre-wrap font-medium">{entry.content}</p>
                )}
              </div>
            )}
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="h-4 w-4 text-app-text-muted" />
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          {onDelete && (
            <Button type="button" variant="danger" onClick={() => onDelete(entry.id)}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          )}
          {onEdit && (
            <Button type="button" variant="secondary" onClick={() => onEdit(entry)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>
    </Modal>
  );
}
