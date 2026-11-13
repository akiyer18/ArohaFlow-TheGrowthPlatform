import React, { useEffect, useState } from 'react';
import { loadAnalytics } from './loadToday';

function formatClock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function AnalyticsPage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await loadAnalytics();
        if (cancelled) return;
        setData(payload);
        setStatus('full');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Analytics
          </h1>
          <p className="os-meta">
            Weekly review · {data?.weekLabel ?? '…'} · not for daily triage
          </p>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="os-state os-skeleton" aria-busy="true">
          <span style={{ width: '40%' }} />
          <span style={{ width: '65%' }} />
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="os-state" role="alert">
          Could not load Analytics.
        </div>
      ) : null}

      {status === 'full' && data ? (
        <>
          <div className="os-today-grid">
            <section className="os-panel" aria-labelledby="plan-done-heading">
              <h2 id="plan-done-heading" className="os-panel-title">
                Plan versus done
              </h2>
              <ul className="os-list">
                <li>
                  <p className="os-list-title">
                    {data.planVersusDone.daysWithAllMicroactionsComplete} of{' '}
                    {data.planVersusDone.lockedDays} locked days fully done
                  </p>
                  <p className="os-list-meta">
                    Microactions {data.planVersusDone.microactionsCompleted}/
                    {data.planVersusDone.microactionsPlanned} completed
                  </p>
                </li>
              </ul>
            </section>

            <section className="os-panel" aria-labelledby="habit-heading">
              <h2 id="habit-heading" className="os-panel-title">
                Habit consistency
              </h2>
              <ul className="os-list">
                {data.habitConsistency.habits.map((h) => (
                  <li key={h.habitId}>
                    <p className="os-list-title">{h.label}</p>
                    <p className="os-list-meta">
                      {h.checkIns} check-ins on {h.scheduledDays} scheduled days
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="os-panel" aria-labelledby="goal-time-heading">
              <h2 id="goal-time-heading" className="os-panel-title">
                Time per Goal
              </h2>
              <ul className="os-list">
                {data.timePerGoal.map((g) => (
                  <li key={g.goalId}>
                    <p className="os-list-title">{g.title}</p>
                    <p className="os-list-meta">
                      {g.completedMinutes} / {g.plannedMinutes} min in Blocks
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="os-panel" aria-labelledby="apps-heading">
              <h2 id="apps-heading" className="os-panel-title">
                Application pipeline
              </h2>
              <p className="os-meta" style={{ marginBottom: 'var(--space-sm)' }}>
                {data.applicationPipeline.movedThisWeek} status moves this week
              </p>
              <ul className="os-list">
                {data.applicationPipeline.byStatus.map((row) => (
                  <li key={row.status}>
                    <p className="os-list-title">{row.status}</p>
                    <p className="os-list-meta">{row.count}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="os-panel" aria-labelledby="activity-heading">
            <div className="os-panel-head">
              <h2 id="activity-heading" className="os-panel-title">
                Agent activity
              </h2>
              <p className="os-meta">Audit log for weekly review</p>
            </div>
            <ul className="os-list">
              {data.agentActivity.map((entry, idx) => (
                <li key={`${entry.type}-${entry.at}-${idx}`}>
                  <p className="os-list-title">{entry.summary}</p>
                  <p className="os-list-meta">
                    {entry.type} · {formatClock(entry.at)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
