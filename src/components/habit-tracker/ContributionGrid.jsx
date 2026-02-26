import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toDateKey } from '../../utils/streakUtils';
import { cn } from '../ui/cn';

const DAYS = 90;
const CELL_SIZE = 12;
const GAP = 3;

/**
 * Build array of date keys for last 90 days (oldest first for left-to-right display).
 */
function getLast90Days() {
  const out = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(toDateKey(d));
  }
  return out;
}

export default function ContributionGrid({ habit, logs, targetPerDay }) {
  const [tooltip, setTooltip] = useState(null);

  const logByDate = useMemo(() => {
    const map = {};
    (logs || []).forEach((log) => {
      const key = log.date?.slice ? log.date.slice(0, 10) : toDateKey(log.date);
      map[key] = (map[key] || 0) + (log.count ?? 0);
    });
    return map;
  }, [logs]);

  const dates = useMemo(() => getLast90Days(), []);
  const target = targetPerDay ?? 1;

  const getLevel = (dateStr) => {
    const count = logByDate[dateStr] || 0;
    if (count === 0) return 0;
    if (count >= target) return 3;
    if (count >= target * 0.5) return 2;
    return 1;
  };

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-[3px]"
        style={{ width: (CELL_SIZE + GAP) * 13 }}
        role="img"
        aria-label="Last 90 days activity"
      >
        {dates.map((dateStr, index) => {
          const level = getLevel(dateStr);
          const count = logByDate[dateStr] || 0;
          return (
            <motion.div
              key={dateStr}
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.002, duration: 0.15 }}
              className={cn(
                'rounded-[3px] border border-white/5 transition-colors',
                level === 0 && 'bg-app-bg-primary/60',
                level === 1 && 'bg-app-accent/30',
                level === 2 && 'bg-app-accent/60',
                level === 3 && 'bg-app-accent'
              )}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              onMouseEnter={() =>
                setTooltip({
                  date: dateStr,
                  count,
                  target,
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </div>
      {tooltip && (
        <div
          className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-lg border border-app-border bg-app-bg-secondary px-3 py-2 text-xs shadow-lg"
          style={{ whiteSpace: 'nowrap' }}
        >
          {new Date(tooltip.date + 'T12:00:00').toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
          {tooltip.target > 1 ? ` · ${tooltip.count}/${tooltip.target}` : tooltip.count > 0 ? ` · ${tooltip.count}` : ''}
        </div>
      )}
    </div>
  );
}
