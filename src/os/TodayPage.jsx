import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assessOvercommit,
  compactDigest,
  nextMicroactionBlock,
} from './fixtures/todayFixture';
import { loadToday, loadTomorrowPlan } from './loadToday';
import './today.css';

/* ---------- Formatting ---------- */

function formatClock(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function minutesBetween(startIso, endIso) {
  return Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 60000));
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatPlanDate(date) {
  if (!date) return 'Today';
  return new Date(`${date}T12:00:00`).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function localDateKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hourOf(iso) {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

const PURPOSE_LABEL = {
  gym: 'Health',
  'deep-work': 'Deep work',
  meal: 'Meal',
  'wind-down': 'Wind-down',
  'work-window': 'Work window',
  applications: 'Applications',
};

function purposeLabel(purpose) {
  return PURPOSE_LABEL[purpose] ?? (purpose ? purpose.replace(/-/g, ' ') : '');
}

/* ---------- Day rhythm ---------- */

const PHASES = [
  { id: 'plan', label: 'Plan' },
  { id: 'focus', label: 'Focus' },
  { id: 'shutdown', label: 'Shut down' },
];

function phaseFor(date = new Date()) {
  const h = date.getHours();
  if (h < 9) return 'plan';
  if (h < 18) return 'focus';
  return 'shutdown';
}

/* ---------- Day column layout ---------- */

/** Greedy lanes so overlapping Blocks sit side by side instead of on top of each other. */
function layoutBlocks(blocks) {
  const sorted = [...blocks].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const laneEnds = [];
  const placed = sorted.map((block) => {
    const start = new Date(block.startAt).getTime();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = new Date(block.endAt).getTime();
    return { block, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}

function hourRange(blocks) {
  if (!blocks.length) return { from: 7, to: 22 };
  const from = Math.max(0, Math.floor(Math.min(...blocks.map((b) => hourOf(b.startAt)))) - 1);
  const to = Math.min(24, Math.ceil(Math.max(...blocks.map((b) => hourOf(b.endAt)))) + 1);
  return { from, to: Math.max(to, from + 6) };
}

/* ---------- Region states ---------- */

function RegionState({ status, empty, errorLabel, children }) {
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
        {errorLabel} Refresh, or run the Agent Service morning cadence.
      </div>
    );
  }
  if (status === 'empty') {
    return <div className="os-state">{empty}</div>;
  }
  return children;
}

function completionLabel(entry) {
  if (entry.summary) return entry.summary;
  if (entry.type === 'plan_ready') return 'Plan-ready Completion';
  return entry.type.replace(/_/g, ' ');
}

/* ---------- Page ---------- */

export default function TodayPage() {
  const [status, setStatus] = useState('loading');
  const [today, setToday] = useState(null);
  const [openedMicroactionId, setOpenedMicroactionId] = useState(null);
  const [lockPanel, setLockPanel] = useState(null);
  const [lockMessage, setLockMessage] = useState(null);
  const [now, setNow] = useState(() => new Date());

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
    const tick = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  const beginShutdown = async () => {
    setLockMessage(null);
    try {
      const plan = await loadTomorrowPlan();
      const assessment = assessOvercommit(plan);
      setLockPanel({ plan, assessment, intention: '' });
    } catch {
      setLockMessage('Could not load tomorrow’s Day Plan.');
    }
  };

  const confirmLock = ({ acknowledgeOvercommit }) => {
    if (!lockPanel) return;
    const { plan, assessment, intention } = lockPanel;
    if (assessment.overcommitted && !acknowledgeOvercommit) return;
    const note = intention.trim() ? ` with the intention “${intention.trim()}”` : '';
    setLockMessage(
      `Tomorrow (${formatPlanDate(plan.date)}) is locked${note}${
        acknowledgeOvercommit ? ', overcommit acknowledged' : ''
      }. The facade lock_day_plan call wires in when the live bridge is connected.`,
    );
    setLockPanel(null);
  };

  const blocks = today?.dayPlan?.blocks ?? [];
  const workWindow = blocks.find((b) => b.kind === 'fixed' && b.purpose === 'work-window');
  const listBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b !== workWindow)
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [blocks, workWindow],
  );
  const nextBlock = useMemo(
    () => nextMicroactionBlock(today?.dayPlan, today?.nextMicroaction),
    [today],
  );
  const digestItems = useMemo(() => compactDigest(today?.emailDigest, 4), [today]);

  const isToday = today?.date === localDateKey(now);
  const phase = phaseFor(now);
  const nextTitle = today?.nextMicroaction?.title ?? nextBlock?.title;

  const openNext = () => {
    const id = today?.nextMicroaction?.id ?? nextBlock?.microactionId;
    if (id) setOpenedMicroactionId(id);
  };

  const planStatus = !today ? status : listBlocks.length ? 'full' : 'empty';
  const microactionMinutes = listBlocks
    .filter((b) => b.microactionId)
    .reduce((sum, b) => sum + minutesBetween(b.startAt, b.endAt), 0);

  const points = today?.dailyPoints ?? 0;
  const target = today?.dailyPointTarget ?? 100;
  const pointsRatio = Math.min(1, target ? points / target : 0);

  const range = hourRange(blocks);
  const hours = [];
  for (let h = range.from; h <= range.to; h += 1) hours.push(h);
  const placed = layoutBlocks(listBlocks);
  const nowOffset = hourOf(now.toISOString()) - range.from;
  const showNow = isToday && nowOffset >= 0 && nowOffset <= range.to - range.from;

  const primary =
    phase === 'shutdown'
      ? { label: 'Shut down and lock tomorrow', onClick: beginShutdown, disabled: !today }
      : {
          label: nextTitle ? `Start ${nextTitle}` : 'Start next Microaction',
          onClick: openNext,
          disabled: !nextTitle,
        };
  const secondary =
    phase === 'shutdown'
      ? { label: nextTitle ? `Open ${nextTitle}` : 'Open next Microaction', onClick: openNext, disabled: !nextTitle }
      : { label: 'Lock tomorrow', onClick: beginShutdown, disabled: !today };

  return (
    <div className="td">
      <header className="td-head">
        <div className="td-head-text">
          <h1 className="td-date">{today ? formatPlanDate(today.date) : 'Today'}</h1>
          {today?.intention ? (
            <p className="td-intention">{today.intention}</p>
          ) : status === 'full' ? (
            <p className="td-intention is-empty">
              No intention yet. Set one when you lock tomorrow this evening.
            </p>
          ) : null}
        </div>

        <div className="td-points" aria-label="Daily points">
          <p className="td-points-figure">
            <span className="os-fig">{today ? points : '0'}</span>
            <span className="td-points-of"> of {target} points</span>
          </p>
          <div className="td-meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${pointsRatio})` }} />
          </div>
        </div>
      </header>

      <section className="td-rhythm" aria-label="Day rhythm">
        <ol className="td-phases">
          {PHASES.map((p) => (
            <li
              key={p.id}
              className={p.id === phase ? 'td-phase is-current' : 'td-phase'}
              aria-current={p.id === phase ? 'step' : undefined}
            >
              {p.label}
            </li>
          ))}
        </ol>
        <div className="td-rhythm-actions">
          <button
            type="button"
            className="os-btn os-btn-secondary"
            onClick={secondary.onClick}
            disabled={secondary.disabled}
          >
            {secondary.label}
          </button>
          <button
            type="button"
            className="os-btn os-btn-primary"
            onClick={primary.onClick}
            disabled={primary.disabled}
          >
            {primary.label}
          </button>
        </div>
      </section>

      {lockMessage ? (
        <p className="td-notice" role="status">
          {lockMessage}
        </p>
      ) : null}

      {openedMicroactionId ? (
        <p className="td-notice" role="status">
          Opened {today?.nextMicroaction?.id === openedMicroactionId ? today.nextMicroaction.title : openedMicroactionId}.
          Mark it complete or park it with the Agent Service tools.
        </p>
      ) : null}

      {lockPanel ? (
        <section className="td-shutdown os-panel" aria-labelledby="shutdown-heading">
          <div className="os-panel-head">
            <h2 id="shutdown-heading" className="os-panel-title">
              Lock {formatPlanDate(lockPanel.plan.date)}
            </h2>
            <p className="os-meta">
              {lockPanel.plan.blocks.filter((b) => b.kind === 'flexible').length} Flexible Blocks proposed
            </p>
          </div>
          <label className="td-field">
            <span className="os-meta">Intention for tomorrow</span>
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
              Flexible Blocks add up to {formatDuration(lockPanel.assessment.plannedMinutes)}, which is{' '}
              {formatDuration(lockPanel.assessment.overByMinutes)} more than the{' '}
              {formatDuration(lockPanel.assessment.availableMinutes)} work window. Edit the plan, or lock it
              anyway.
            </p>
          ) : (
            <p className="os-meta td-field-note">It fits inside the work window.</p>
          )}
          <div className="os-toolbar-actions td-shutdown-actions">
            <button type="button" className="os-btn os-btn-secondary" onClick={() => setLockPanel(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="os-btn os-btn-primary"
              onClick={() =>
                confirmLock({ acknowledgeOvercommit: lockPanel.assessment.overcommitted })
              }
            >
              {lockPanel.assessment.overcommitted ? 'Lock anyway' : 'Lock tomorrow'}
            </button>
          </div>
        </section>
      ) : null}

      <div className="td-grid">
        {/* The list: what the day holds, in order */}
        <section className="td-list" aria-labelledby="plan-heading">
          <div className="td-section-head">
            <h2 id="plan-heading" className="td-section-title">
              Day plan
            </h2>
            <p className="os-meta">
              {today?.dayPlan?.status === 'locked' ? 'Locked' : today?.dayPlan?.status ?? ''}
              {microactionMinutes ? `, ${formatDuration(microactionMinutes)} of focus` : ''}
            </p>
          </div>
          {workWindow ? (
            <p className="td-window">
              Work window from <span className="os-fig">{formatClock(workWindow.startAt)}</span> to{' '}
              <span className="os-fig">{formatClock(workWindow.endAt)}</span>
            </p>
          ) : null}
          <RegionState
            status={planStatus}
            empty="No Day Plan yet. The morning cadence proposes Blocks from your Fixed Blocks, Calendar Events and open Microactions."
            errorLabel="Could not load the Day Plan."
          >
            <ol className="td-blocks">
              {listBlocks.map((block) => {
                const isNext = nextBlock && block.id === nextBlock.id;
                const isPast = isToday && new Date(block.endAt) < now;
                const cls = [
                  'td-block',
                  block.microactionId ? 'is-micro' : 'is-fixed',
                  isNext ? 'is-next' : '',
                  isPast ? 'is-past' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={block.id} className={cls}>
                    <div className="td-block-top">
                      <time className="td-block-time os-fig" dateTime={block.startAt}>
                        {formatClock(block.startAt)}
                      </time>
                      {isNext ? <span className="td-next">Next</span> : null}
                      <span className="td-block-dur os-fig">
                        {formatDuration(minutesBetween(block.startAt, block.endAt))}
                      </span>
                    </div>
                    <p className="td-block-title">{block.title}</p>
                    <div className="td-block-foot">
                      <span className="td-tag">{purposeLabel(block.purpose)}</span>
                      {block.publishToCalendar ? <span className="td-tag">On Google Calendar</span> : null}
                      {block.microactionId ? (
                        <button
                          type="button"
                          className="os-block-btn"
                          onClick={() => setOpenedMicroactionId(block.microactionId)}
                        >
                          Open
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </RegionState>
        </section>

        {/* The day column: the same plan, drawn in time */}
        <section className="td-day os-panel" aria-labelledby="day-heading">
          <div className="td-section-head">
            <h2 id="day-heading" className="td-section-title">
              {today ? new Date(`${today.date}T12:00:00`).toLocaleDateString([], { weekday: 'short' }) : 'Day'}{' '}
              <span className="td-day-num os-fig">
                {today ? Number(today.date.slice(8, 10)) : ''}
              </span>
            </h2>
            <Link to="/calendar" className="os-inline-link os-meta">
              Week and month
            </Link>
          </div>
          {status === 'loading' || status === 'error' || planStatus === 'empty' ? (
            <RegionState
              status={planStatus === 'empty' ? 'empty' : status}
              empty="Blocks appear here once the plan is proposed."
              errorLabel="Could not load the day."
            />
          ) : (
            <div
              className="td-column"
              style={{ '--hours': range.to - range.from }}
              aria-hidden="true"
            >
              {hours.map((h, i) => (
                <div key={h} className="td-hour" style={{ '--i': i }}>
                  <span className="td-hour-label os-fig">{String(h % 24).padStart(2, '0')}:00</span>
                </div>
              ))}
              {workWindow ? (
                <div
                  className="td-band"
                  style={{
                    '--start': hourOf(workWindow.startAt) - range.from,
                    '--span': hourOf(workWindow.endAt) - hourOf(workWindow.startAt),
                  }}
                />
              ) : null}
              {placed.map(({ block, lane, lanes }) => {
                const start = hourOf(block.startAt) - range.from;
                const span = Math.max(0.4, hourOf(block.endAt) - hourOf(block.startAt));
                const isNext = nextBlock && block.id === nextBlock.id;
                return (
                  <div
                    key={block.id}
                    className={[
                      'td-event',
                      block.microactionId ? 'is-micro' : 'is-fixed',
                      isNext ? 'is-next' : '',
                      span < 0.9 ? 'is-short' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ '--start': start, '--span': span, '--lane': lane, '--lanes': lanes }}
                  >
                    <span className="td-event-title">{block.title}</span>
                    <span className="td-event-time os-fig">
                      {formatClock(block.startAt)}
                    </span>
                  </div>
                );
              })}
              {showNow ? <div className="td-now" style={{ '--start': nowOffset }} /> : null}
            </div>
          )}
        </section>

        {/* The rail: what feeds the day */}
        <aside className="td-rail" aria-label="Today at a glance">
          <section className="os-panel" aria-labelledby="habits-heading">
            <div className="td-section-head">
              <h2 id="habits-heading" className="td-section-title">
                Habits
              </h2>
              <Link to="/habits" className="os-inline-link os-meta">
                All habits
              </Link>
            </div>
            <RegionState
              status={!today ? status : today.habitCheckIns?.length ? 'full' : 'empty'}
              empty="No check-ins yet today."
              errorLabel="Could not load habits."
            >
              <ul className="os-list">
                {(today?.habitCheckIns ?? []).map((c) => (
                  <li key={`${c.habitId}-${c.at}`} className="td-row">
                    <span className="os-list-title">{c.label}</span>
                    <span className="os-list-meta os-fig">{formatClock(c.at)}</span>
                  </li>
                ))}
              </ul>
            </RegionState>
          </section>

          <section className="os-panel" aria-labelledby="points-heading">
            <div className="td-section-head">
              <h2 id="points-heading" className="td-section-title">
                Completions
              </h2>
              <p className="os-meta">
                <span className="os-fig">{today ? points : '0'}</span> pts
              </p>
            </div>
            <RegionState
              status={!today ? status : today.pointsExplanation?.length ? 'full' : 'empty'}
              empty="Nothing completed yet. Points come only from Completions."
              errorLabel="Could not load points."
            >
              <ul className="os-list">
                {(today?.pointsExplanation ?? []).map((entry, idx) => (
                  <li key={`${entry.type}-${idx}`} className="td-row">
                    <span className="os-list-title">{completionLabel(entry)}</span>
                    <span className="os-list-meta os-fig">+{entry.points}</span>
                  </li>
                ))}
              </ul>
            </RegionState>
          </section>

          <section className="os-panel" aria-labelledby="digest-heading">
            <div className="td-section-head">
              <h2 id="digest-heading" className="td-section-title">
                Email
              </h2>
              <Link to="/email-digest" className="os-inline-link os-meta">
                Full digest
              </Link>
            </div>
            <RegionState
              status={!today ? status : digestItems.length ? 'full' : 'empty'}
              empty="No Important Emails today."
              errorLabel="Could not load the Email Digest."
            >
              <ul className="os-list">
                {digestItems.map((item) => (
                  <li key={item.messageId}>
                    <span className="os-list-title">{item.subject}</span>
                    <span className="os-list-meta">{item.from}</span>
                  </li>
                ))}
              </ul>
            </RegionState>
          </section>
        </aside>
      </div>
    </div>
  );
}
