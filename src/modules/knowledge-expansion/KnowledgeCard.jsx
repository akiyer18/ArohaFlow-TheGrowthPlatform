import React from 'react';
import { motion } from 'framer-motion';
import { Star, BookOpen } from 'lucide-react';

function previewText(text, maxLines = 3) {
  if (!text || !text.trim()) return '';
  const lines = text.trim().split(/\n/).filter(Boolean).slice(0, maxLines);
  return lines.join(' ').slice(0, 180) + (lines.join(' ').length > 180 ? '…' : '');
}

export default function KnowledgeCard({ entry, onClick }) {
  const preview = previewText(entry.content);
  const rating = entry.impact_rating != null && entry.impact_rating >= 1 && entry.impact_rating <= 5 ? entry.impact_rating : null;
  const tags = Array.isArray(entry.tags) ? entry.tags : [];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className="cursor-pointer rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 backdrop-blur-sm transition-all hover:border-violet-500/20 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-white line-clamp-2">{entry.title || 'Untitled'}</h3>
        {rating != null && (
          <span className="flex shrink-0 items-center gap-0.5 text-amber-400/90">
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm">{rating}</span>
          </span>
        )}
      </div>
      {preview && (
        <p className="mt-2 text-sm text-app-text-muted line-clamp-3">{preview}</p>
      )}
      {entry.source && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-violet-300/80">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{entry.source}</span>
          {entry.source_type && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] capitalize">{entry.source_type}</span>
          )}
        </p>
      )}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-200"
            >
              {t}
            </span>
          ))}
          {tags.length > 5 && <span className="text-xs text-app-text-muted">+{tags.length - 5}</span>}
        </div>
      )}
      <p className="mt-2 text-xs text-app-text-muted">{entry.date}</p>
    </motion.article>
  );
}
