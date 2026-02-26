import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import {
  getTodayEffortAndMomentum,
  getMomentumMessage,
} from '../../services';

/** Momentum 0-1000 as horizontal bar (width = score/10 %) */
const MomentumBar = ({ value }) => {
  const safe = Math.max(0, Math.min(1000, value ?? 0));
  const pct = safe / 10;
  return (
    <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-500 to-emerald-400"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
};

/** Small ring for daily effort 0-100 (SVG circle stroke-dashoffset). */
const EffortRing = ({ value }) => {
  const safe = Math.max(0, Math.min(100, value ?? 0));
  const circumference = 2 * Math.PI * 24;
  const offset = circumference - (safe / 100) * circumference;
  return (
    <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
      <circle
        cx="28"
        cy="28"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-white/10"
      />
      <motion.circle
        cx="28"
        cy="28"
        r="24"
        fill="none"
        stroke="url(#effortGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
      <defs>
        <linearGradient id="effortGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default function FlowOverview() {
  const [loading, setLoading] = useState(true);
  const [effort, setEffort] = useState(null);
  const [momentum, setMomentum] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { effort: e, momentum: m } = await getTodayEffortAndMomentum();
        if (!mounted) return;
        setEffort(e ?? null);
        setMomentum(m ?? null);
        setMessage(getMomentumMessage(m?.momentum_score, m?.delta, null));
      } catch (err) {
        setMessage('Your momentum will build as you show up.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <motion.div
      className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-5 shadow-lg"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-app-text-muted">Today</p>
          <h2 className="text-xl font-semibold text-app-text-primary">
            What are we building today?
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-app-border px-3 py-1 text-xs app-muted">
          <Sparkles className="h-3.5 w-3.5" />
          Momentum Engine
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr] items-start">
        <div className="flex items-center gap-3">
          <EffortRing value={effort?.effort_score ?? 0} />
          <div>
            <p className="text-xs text-app-text-muted">Daily Effort</p>
            <p className="text-2xl font-semibold text-app-text-primary">
              {effort?.effort_score ?? 0}<span className="text-sm font-normal text-app-text-muted">/100</span>
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-app-text-muted">Momentum</p>
            <p className="text-lg font-semibold text-app-text-primary">
              {momentum?.momentum_score ?? 0}
              <span className="text-sm font-normal text-app-text-muted">/1000</span>
              {momentum?.delta != null && (
                <span
                  className={`ml-2 text-sm ${
                    momentum.delta > 0
                      ? 'text-emerald-400'
                      : momentum.delta < 0
                        ? 'text-amber-400'
                        : 'text-app-text-muted'
                  }`}
                >
                  {momentum.delta > 0 ? '↑' : momentum.delta < 0 ? '↓' : ''}
                  {momentum.delta !== 0 ? Math.abs(momentum.delta) : ''}
                </span>
              )}
            </p>
          </div>
          <MomentumBar value={momentum?.momentum_score ?? 0} />
          <p className="mt-2 text-sm text-app-text-muted">{message}</p>
        </div>
      </div>
    </motion.div>
  );
}
