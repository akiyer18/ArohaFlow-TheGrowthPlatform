import React from 'react';
import { cn } from './cn';

const tones = {
  neutral: 'bg-slate-800 text-app-text-muted border border-app-border',
  success: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800',
  warning: 'bg-amber-900/40 text-amber-300 border border-amber-800',
  danger: 'bg-rose-900/40 text-rose-300 border border-rose-800',
  accent: 'bg-indigo-900/40 text-indigo-300 border border-indigo-800',
};

const Badge = ({ tone = 'neutral', className, children }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
      tones[tone],
      className
    )}
  >
    {children}
  </span>
);

export default Badge;
