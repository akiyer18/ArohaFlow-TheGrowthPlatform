import React, { useEffect, useState } from 'react';
import { loadGoals } from './loadOsData';

export default function GoalsPage() {
  const [status, setStatus] = useState('loading');
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await loadGoals();
        if (cancelled) return;
        setGoals(Array.isArray(payload) ? payload : []);
        setStatus(payload?.length ? 'full' : 'empty');
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
            Goals
          </h1>
          <p className="os-meta">Goals → Actions → Microactions</p>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="os-state os-skeleton" aria-busy="true">
          <span style={{ width: '40%' }} />
          <span style={{ width: '72%' }} />
        </div>
      ) : null}
      {status === 'error' ? (
        <p className="os-state" role="alert">
          Could not load Goals. Start the Agent Service HTTP bridge or use fixtures.
        </p>
      ) : null}
      {status === 'empty' ? (
        <p className="os-state">No Goals yet. Seed via Weekly Plan or Store.</p>
      ) : null}

      {status === 'full'
        ? goals.map((goal) => (
            <section key={goal.id} className="os-panel" aria-labelledby={`goal-${goal.id}`}>
              <h2 id={`goal-${goal.id}`} className="os-panel-title">
                {goal.title || goal.id}
              </h2>
              <ul className="os-list">
                {(goal.actions || []).map((action) => (
                  <li key={action.id}>
                    <p className="os-list-title">
                      Action · {action.title || action.id}
                      {action.status ? ` · ${action.status}` : ''}
                    </p>
                    <ul className="os-list" style={{ marginTop: 'var(--space-xs)' }}>
                      {(action.microactions || []).map((micro) => (
                        <li key={micro.id}>
                          <p className="os-list-meta">
                            Microaction · {micro.title || micro.id}
                            {micro.status ? ` · ${micro.status}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ))
        : null}
    </div>
  );
}
