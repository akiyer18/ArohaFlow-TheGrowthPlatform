import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, Flame, Tag } from 'lucide-react';

export default function KnowledgeStats({ stats }) {
  const { total, thisWeek, currentStreak, longestStreak, mostUsedTag } = stats;

  const items = [
    { label: 'Total entries', value: total, icon: BookOpen },
    { label: 'This week', value: thisWeek, icon: Calendar },
    { label: 'Learning streak', value: currentStreak, suffix: currentStreak === 1 ? 'day' : 'days', icon: Flame, highlight: currentStreak > 0 },
    { label: 'Longest streak', value: longestStreak, suffix: longestStreak === 1 ? 'day' : 'days', icon: Flame },
    { label: 'Top tag', value: mostUsedTag || '—', icon: Tag },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={"rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 backdrop-blur-sm " + (item.highlight ? 'ring-1 ring-violet-500/30' : '')}
          >
            <div className="flex items-center gap-2 text-app-text-muted">
              <Icon className="h-4 w-4 text-violet-400/80" />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-white">
              {typeof item.value === 'number' ? item.value : item.value}
              {item.suffix ? ' ' + item.suffix : ''}
            </p>
          </motion.div>
        );
      })}
    </motion.section>
  );
}
