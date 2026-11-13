import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assessOvercommit,
  compactDigest,
  nextMicroactionBlock,
} from './fixtures/todayFixture';
import {
  loadToday,
  loadTomorrowPlan,
  lockTomorrowPlan,
  startMicroactionViaAgent,
  completeMicroactionViaAgent,
} from './loadToday';
import { isAgentHttpConfigured } from './agentHttp';

function formatClock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function RegionState({ status, emptyLabel, errorLabel, children }) {
  if (status === 'loading') {
    return (
      <div className="os-state os-skeleton" aria-busy="true">
        <span style={{ width: '40%' }} />
        <span style={{ width: '72%' }} />
        <span style={{ width: '55%' }} />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="os-state" role="alert">
        {errorLabel} Refresh or run the Agent Service morning cadence.
      </div>
    );
  }
  if (status === 'empty') {
    return <div className="os-state">{emptyLabel}</div>;
  }
  return children;
}

function completionLabel(entry) {
  if (entry.summary) return entry.summary;
  if (entry.type === 'plan_ready') return `Plan-ready · ${entry.points} pts`;
  return `${entry.type} · ${entry.points} pts`;
}

export default function TodayPage() {
  const [status, setStatus] = useState('loading');
  const [today, setToday] = useState(null);
  const [openedMicroactionId, setOpenedMicroactionId] = useState(null);
  const [lockPanel, setLockPanel] = useState(null);
  const [lockMessage, setLockMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await loadToday();
        if (cancelled) return;
        setToday(payload);
        setStatus('full');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const beginEveningLock = async () => {
    setLockMessage(null);
    try {
      const plan = await loadTomorrowPlan();
      const assessment = assessOvercommit(plan);
      setLockPanel({ plan, assessment, intention: '' });
    } catch {
      setLockMessage('Could not load tomorrow’s Day Plan for lock.');
    }
  };

  const confirmLock = async ({ acknowledgeOvercommit }) => {
    if (!lockPanel) return;
    const { plan, assessment, intention } = lockPanel;
    if (assessment.overcommitted && !acknowledgeOvercommit) {
      setLockMessage(
        `Overcommit: Flexible Blocks ${assessment.plannedMinutes} min exceed available ${assessment.availableMinutes} min by ${assessment.overByMinutes} min. Edit the plan or acknowledge to proceed.`,
      );
      return;
    }
    try {
      const result = await lockTomorrowPlan({
        date: plan.date,
        intention: intention.trim() || null,
        acknowledgeOvercommit,
      });
      setLockMessage(
        result?.stub
          ? result.message
          : `Locked ${plan.date}${intention.trim() ? ` · “${intention.trim()}”` : ''}${
              acknowledgeOvercommit ? ' (overcommit acknowledged)' : ''
            }.`,
      );
      setLockPanel(null);
    } catch (err) {
      setLockMessage(err.message || 'Could not lock tomorrow’s Day Plan.');
    }
  };

  const nextBlock = useMemo(
    () => nextMicroactionBlock(today?.dayPlan, today?.nextMicroaction),
    [today],
  );
  const digestItems = useMemo(() => compactDigest(today?.emailDigest, 5), [today]);

  const planStatus = !today
    ? status
    : today.dayPlan?.blocks?.length
      ? 'full'
      : status === 'loading'
        ? 'loading'
        : 'empty';

  const digestStatus = !today
    ? status
    : digestItems.length
      ? 'full'
      : status === 'loading'
        ? 'loading'
        : 'empty';

  const openMicroaction = async (id) => {
    if (!id) return;
    setOpenedMicroactionId(id);
    if (!isAgentHttpConfigured()) return;
    try {
      await startMicroactionViaAgent({ microactionId: id });
      const payload = await loadToday();
      setToday(payload);
    } catch (err) {
      setLockMessage(err.message || 'Could not start Microaction.');
    }
  };

  const openNext = () => {
    const id = today?.nextMicroaction?.id ?? nextBlock?.microactionId;
    return openMicroaction(id);
  };

  const completeOpened = async () => {
    if (!openedMicroactionId || !isAgentHttpConfigured()) return;
    try {
      await completeMicroactionViaAgent({ microactionId: openedMicroactionId });
      setOpenedMicroactionId(null);
      const payload = await loadToday();
      setToday(payload);
    } catch (err) {
      setLockMessage(err.message || 'Could not complete Microaction.');
    }
  };

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Today
          </h1>
          <p className="os-meta">{today?.date ?? '…'}</p>
        </div>
        <div className="os-figures" aria-label="Daily points and streak">
          <div className="os-figure">
            <strong>
              {today ? `${today.dailyPoints}/${today.dailyPointTarget}` : '—'}
            </strong>
            <span>Daily points</span>
          </div>
          <div className="os-figure">
            <strong>{today ? today.streak.count : '—'}</strong>
            <span>
              Streak · {today ? `${today.streak.freezeRemainingThisWeek} freeze left` : '…'}
            </span>
          </div>
        </div>
        <div className="os-toolbar-actions">
          <button
            type="button"
            className="os-btn os-btn-primary"
            disabled={!today?.nextMicroaction && !nextBlock}
            onClick={openNext}
          >
            Open next Microaction
          </button>
          <button
            type="button"
            className="os-btn os-btn-secondary"
            disabled={!today}
            title="Evening lock confirm — secondary near Today"
            onClick={beginEveningLock}
          >
            Lock tomorrow
          </button>
        </div>
      </div>

      {lockMessage ? (
        <p className="os-meta" role="status">
          {lockMessage}
        </p>
      ) : null}

      {lockPanel ? (
        <section className="os-panel" aria-labelledby="lock-tomorrow-heading">
          <div className="os-panel-head">
            <h2 id="lock-tomorrow-heading" className="os-panel-title">
              Lock tomorrow
            </h2>
            <p className="os-meta">{lockPanel.plan.date}</p>
          </div>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Intention</span>
            <input
              className="os-input"
              type="text"
              value={lockPanel.intention}
              onChange={(e) =>
                setLockPanel((prev) => (prev ? { ...prev, intention: e.target.value } : prev))
              }
              placeholder="One sentence for the day"
            />
          </label>
          {lockPanel.assessment.overcommitted ? (
            <p className="os-warn" role="status">
              Overcommit warning: Flexible Blocks {lockPanel.assessment.plannedMinutes} min exceed
              available {lockPanel.assessment.availableMinutes} min by{' '}
              {lockPanel.assessment.overByMinutes} min. Cancel to edit the Day Plan, or acknowledge to
              lock anyway.
            </p>
          ) : (
            <p className="os-meta">Within the work window — ready to lock.</p>
          )}
          <div className="os-toolbar-actions" style={{ marginTop: 'var(--space-sm)' }}>
            {!lockPanel.assessment.overcommitted ? (
              <button
                type="button"
                className="os-btn os-btn-primary"
                onClick={() => confirmLock({ acknowledgeOvercommit: false })}
              >
                Confirm lock
              </button>
            ) : (
              <button
                type="button"
                className="os-btn os-btn-primary"
                onClick={() => confirmLock({ acknowledgeOvercommit: true })}
              >
                Acknowledge overcommit and lock
              </button>
            )}
            <button
              type="button"
              className="os-btn os-btn-secondary"
              onClick={() => setLockPanel(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {today?.intention ? (
        <section className="os-panel" aria-labelledby="intention-heading">
          <h2 id="intention-heading" className="os-panel-title">
            Intention
          </h2>
          <p className="os-intention">{today.intention}</p>
          <p className="os-meta">Set at lock · read-only for the day</p>
        </section>
      ) : status === 'full' ? (
        <p className="os-meta">No Intention yet — lock tomorrow in the evening to set one.</p>
      ) : null}

      {openedMicroactionId ? (
        <div className="os-panel" role="status">
          <p className="os-meta">
            Next Microaction <code>{openedMicroactionId}</code>
            {today?.nextMicroaction?.title ? ` · ${today.nextMicroaction.title}` : ''}.
          </p>
          {isAgentHttpConfigured() ? (
            <div className="os-toolbar-actions" style={{ marginTop: 'var(--space-sm)' }}>
              <button type="button" className="os-btn os-btn-primary" onClick={completeOpened}>
                Complete Microaction
              </button>
            </div>
          ) : (
            <p className="os-meta">Complete or park via Agent Service tools when the bridge is connected.</p>
          )}
        </div>
      ) : null}

      <div className="os-today-grid">
        <section className="os-panel" aria-labelledby="day-plan-heading">
          <div className="os-panel-head">
            <h2 id="day-plan-heading" className="os-panel-title">
              Day plan
            </h2>
            <p className="os-meta">{today?.dayPlan?.status ?? '…'}</p>
          </div>
          <RegionState
            status={planStatus}
            emptyLabel="No Day Plan yet. Run morning cadence to propose Blocks."
            errorLabel="Could not load Day Plan."
          >
            <ol className="os-timeline">
              {(today?.dayPlan?.blocks ?? []).map((block) => {
                const isNext = nextBlock && block.id === nextBlock.id;
                return (
                  <li key={block.id} className={isNext ? 'os-block is-next' : 'os-block'}>
                    <time className="os-block-time" dateTime={block.startAt}>
                      {formatClock(block.startAt)}
                    </time>
                    <div className="os-block-body">
                      <p className="os-block-title">{block.title}</p>
                      <p className="os-block-kind">
                        {block.kind}
                        {block.purpose ? ` · ${block.purpose}` : ''}
                        {block.microactionId ? ` · ${block.microactionId}` : ''}
                      </p>
                    </div>
                    {block.microactionId ? (
                      <button
                        type="button"
                        className="os-block-btn"
                        onClick={() => openMicroaction(block.microactionId)}
                      >
                        Open
                      </button>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ol>
          </RegionState>
        </section>

        <div className="os-stack">
          <section className="os-panel" aria-labelledby="points-heading">
            <div className="os-panel-head">
              <h2 id="points-heading" className="os-panel-title">
                Points
              </h2>
              <p className="os-meta">
                {today ? `${today.dailyPoints} / ${today.dailyPointTarget}` : '…'}
              </p>
            </div>
            <RegionState
              status={!today ? status : today.pointsExplanation?.length ? 'full' : 'empty'}
              emptyLabel="No Completions yet today. Lock prior evening for Plan-ready (+10)."
              errorLabel="Could not load points."
            >
              <ul className="os-list">
                {(today?.pointsExplanation ?? []).map((entry, idx) => (
                  <li key={`${entry.type}-${idx}`}>
                    <p className="os-list-title">{completionLabel(entry)}</p>
                    <p className="os-list-meta">
                      {entry.type} · {entry.points} pts
                    </p>
                  </li>
                ))}
              </ul>
            </RegionState>
          </section>

          <section className="os-panel" aria-labelledby="digest-heading">
            <div className="os-panel-head">
              <h2 id="digest-heading" className="os-panel-title">
                Email digest
              </h2>
              <p className="os-meta">
                {digestItems.length}
                {today?.emailDigest?.length > digestItems.length
                  ? ` of ${today.emailDigest.length}`
                  : ''}{' '}
                to open
              </p>
            </div>
            <RegionState
              status={digestStatus}
              emptyLabel="No Important Emails in the digest yet."
              errorLabel="Could not load Email Digest."
            >
              <ul className="os-list">
                {digestItems.map((item) => (
                  <li key={item.messageId}>
                    <p className="os-list-title">{item.subject}</p>
                    <p className="os-list-meta">
                      {item.from}
                    </p>
                    <p className="os-list-meta">{item.reason}</p>
                  </li>
                ))}
              </ul>
              <p className="os-meta" style={{ marginTop: 'var(--space-md)' }}>
                <Link to="/email-digest" className="os-inline-link">
                  Full Email Digest
                </Link>
              </p>
            </RegionState>
          </section>
        </div>
      </div>
    </div>
  );
}
