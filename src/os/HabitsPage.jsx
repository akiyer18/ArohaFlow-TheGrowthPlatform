import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GRADES,
  addDays,
  buildHabitsView,
  checkInPoints,
  getHabits,
  setCheckIn,
} from '../modules/habits';
import './habits.css';

/* ---------- Formatting ---------- */

function formatDay(dateKey, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], opts);
}

const STATUS_LABEL = {
  full: 'kept',
  minimum: 'kept, minimum',
  missed: 'missed',
  season: 'on a season',
  off: 'not scheduled',
  open: 'today, open',
  future: 'ahead',
};

const SEASON_REASONS = ['Travel', 'Sick', 'Exam week', 'Rest'];

/* ---------- Pieces ---------- */

function ConsistencyStrip({ days }) {
  const kept = days.filter((d) => d.status === 'full' || d.status === 'minimum').length;
  return (
    <ol className="hb-strip" aria-label={`Last 14 days, ${kept} kept`}>
      {days.map((d) => (
        <li
          key={d.date}
          className={`hb-day is-${d.status}`}
          title={`${formatDay(d.date)}: ${STATUS_LABEL[d.status]}`}
        />
      ))}
    </ol>
  );
}

function SeasonForm({ asOf, onSave, onCancel }) {
  const [reason, setReason] = useState(SEASON_REASONS[0]);
  const [until, setUntil] = useState(addDays(asOf, 6));
  return (
    <form
      className="hb-season-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (until >= asOf) onSave({ reason, from: asOf, until });
      }}
    >
      <fieldset className="hb-reasons">
        <legend className="os-meta">Why the pause</legend>
        {SEASON_REASONS.map((r) => (
          <label key={r} className={r === reason ? 'hb-reason is-on' : 'hb-reason'}>
            <input
              type="radio"
              name="season-reason"
              value={r}
              checked={r === reason}
              onChange={() => setReason(r)}
            />
            {r}
          </label>
        ))}
      </fieldset>
      <label className="hb-until">
        <span className="os-meta">Until</span>
        <input
          className="os-input"
          type="date"
          min={asOf}
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          required
        />
      </label>
      <div className="hb-form-actions">
        <button type="button" className="os-btn os-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="os-btn os-btn-primary">
          Start the season
        </button>
      </div>
    </form>
  );
}

function HabitCard({ row, asOf, onCheckIn, onSeason }) {
  const { habit, consistency, today } = row;
  const [pausing, setPausing] = useState(false);
  const settled = today === 'full' || today === 'minimum';

  return (
    <li className={settled ? 'hb-card is-settled' : 'hb-card'}>
      <div className="hb-card-head">
        <div className="hb-card-name">
          <h3 className="hb-title">{habit.label}</h3>
          {habit.timeAnchor ? <span className="os-meta os-fig">{habit.timeAnchor}</span> : null}
        </div>
        <p className="hb-consistency">
          <span className="os-fig">{consistency.kept}</span>
          <span className="hb-of"> of {consistency.scheduled}</span>
          <span className="hb-consistency-label">last 14 days</span>
        </p>
      </div>

      <ConsistencyStrip days={consistency.days} />

      <div className="hb-card-foot">
        {today === 'off' ? (
          <p className="os-meta">Not scheduled today.</p>
        ) : settled ? (
          <>
            <p className="hb-pressed" aria-live="polite">
              {today === 'minimum' ? 'Minimum kept' : 'Done'}
            </p>
            <span className="os-meta">
              +<span className="os-fig">{checkInPoints(today)}</span> points
            </span>
            <button type="button" className="hb-text-btn" onClick={() => onCheckIn(habit.id, null)}>
              Undo
            </button>
          </>
        ) : (
          <>
            <button type="button" className="os-btn os-btn-secondary" onClick={() => onCheckIn(habit.id, 'full')}>
              Done
            </button>
            {habit.minimum ? (
              <button
                type="button"
                className="os-btn os-btn-secondary"
                onClick={() => onCheckIn(habit.id, 'minimum')}
              >
                Minimum: {habit.minimum.label}
              </button>
            ) : null}
          </>
        )}
        {!pausing ? (
          <button type="button" className="hb-text-btn hb-pause" onClick={() => setPausing(true)}>
            Pause for a season
          </button>
        ) : null}
      </div>

      {pausing ? (
        <SeasonForm
          asOf={asOf}
          onCancel={() => setPausing(false)}
          onSave={(season) => {
            setPausing(false);
            onSeason(habit.id, season);
          }}
        />
      ) : null}
    </li>
  );
}

/* ---------- Page ---------- */

export default function HabitsPage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getHabits();
        if (cancelled) return;
        setData(payload);
        setStatus(payload.habits.length ? 'full' : 'empty');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => (data ? buildHabitsView(data) : null), [data]);

  const pointsToday = useMemo(
    () =>
      (data?.checkIns ?? [])
        .filter((c) => c.date === data.asOf)
        .reduce((sum, c) => sum + checkInPoints(c.level), 0),
    [data],
  );

  const updateHabit = (habitId, patch) =>
    setData((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h.id === habitId ? { ...h, ...patch } : h)),
    }));

  const onCheckIn = (habitId, level) =>
    setData((prev) => ({ ...prev, checkIns: setCheckIn(prev.checkIns, habitId, prev.asOf, level) }));

  const onSeason = (habitId, season) => {
    updateHabit(habitId, { season });
    const label = data.habits.find((h) => h.id === habitId)?.label;
    setNotice(`${label} is on a season until ${formatDay(season.until)}. Nothing counts against it.`);
  };

  const onResume = (habitId) => {
    updateHabit(habitId, { season: null });
    setNotice(null);
  };

  const onPickUp = (habitId) => {
    updateHabit(habitId, { restartedOn: data.asOf });
    const label = data.habits.find((h) => h.id === habitId)?.label;
    setNotice(`${label} starts fresh today. Earlier days no longer count.`);
  };

  const week = view?.week;
  const gradeId = week?.grade?.id;

  return (
    <div className="hb">
      <header className="hb-head">
        <div className="hb-head-text">
          <h1 className="hb-h1">Habits</h1>
          <p className="hb-lead">
            {view ? `Week of ${formatDay(week.weekStart, { day: 'numeric', month: 'long' })}` : 'This week'}
          </p>
        </div>

        <div className="hb-grade" aria-live="polite">
          <p className="hb-grade-word">{week?.grade ? week.grade.label : 'No grade yet'}</p>
          <p className="os-meta">
            {week?.scheduled
              ? (
                <>
                  <span className="os-fig">{week.kept}</span> of <span className="os-fig">{week.scheduled}</span>{' '}
                  scheduled days kept so far
                </>
              )
              : 'The grade starts with the first scheduled check-in of the week.'}
          </p>
        </div>
      </header>

      <ol className="hb-scale" aria-label="Weekly grade scale">
        {GRADES.map((g) => (
          <li key={g.id} className={g.id === gradeId ? 'hb-step is-current' : 'hb-step'} aria-current={g.id === gradeId ? 'true' : undefined}>
            {g.label}
          </li>
        ))}
      </ol>

      {notice ? (
        <p className="hb-notice" role="status">
          {notice}
        </p>
      ) : null}

      {status === 'loading' ? (
        <div className="os-state os-skeleton" aria-busy="true">
          <span style={{ width: '30%' }} />
          <span style={{ width: '70%' }} />
          <span style={{ width: '50%' }} />
        </div>
      ) : status === 'error' ? (
        <div className="os-state" role="alert">
          Could not load habits. Refresh, or check the Agent Service connection.
        </div>
      ) : status === 'empty' ? (
        <div className="os-state">
          No habits yet. A habit needs a name, the days it is scheduled, and ideally a Minimum Version for
          bad days.
        </div>
      ) : (
        <div className="hb-grid">
          <section aria-labelledby="hb-today-heading">
            <div className="hb-section-head">
              <h2 id="hb-today-heading" className="hb-section-title">
                Today
              </h2>
              <p className="os-meta">
                +<span className="os-fig">{pointsToday}</span> points from habits,{' '}
                <Link to="/today" className="os-inline-link">
                  see the day
                </Link>
              </p>
            </div>
            {view.active.length ? (
              <ul className="hb-cards">
                {view.active.map((row) => (
                  <HabitCard key={row.habit.id} row={row} asOf={data.asOf} onCheckIn={onCheckIn} onSeason={onSeason} />
                ))}
              </ul>
            ) : (
              <p className="os-state">Every habit is on a season or resting. Nothing is due today.</p>
            )}
          </section>

          <aside className="hb-side" aria-label="Paused and quiet habits">
            <section className="os-panel" aria-labelledby="hb-season-heading">
              <div className="hb-section-head">
                <h2 id="hb-season-heading" className="hb-side-title">
                  On a season
                </h2>
              </div>
              {view.season.length ? (
                <ul className="os-list">
                  {view.season.map(({ habit }) => (
                    <li key={habit.id} className="hb-side-row">
                      <div>
                        <p className="os-list-title">{habit.label}</p>
                        <p className="os-list-meta">
                          {habit.season.reason}, until {formatDay(habit.season.until)}
                        </p>
                      </div>
                      <button type="button" className="os-block-btn" onClick={() => onResume(habit.id)}>
                        Resume
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="os-state">
                  Nothing paused. Travelling, ill or in exams? Pause a habit and it costs nothing.
                </p>
              )}
            </section>

            <section className="os-panel" aria-labelledby="hb-quiet-heading">
              <div className="hb-section-head">
                <h2 id="hb-quiet-heading" className="hb-side-title">
                  Gone quiet
                </h2>
              </div>
              {view.quiet.length ? (
                <ul className="os-list">
                  {view.quiet.map(({ habit }) => (
                    <li key={habit.id} className="hb-side-row">
                      <div>
                        <p className="os-list-title">{habit.label}</p>
                        <p className="os-list-meta">Resting for 14 days. Left out of the grade.</p>
                      </div>
                      <button type="button" className="os-block-btn" onClick={() => onPickUp(habit.id)}>
                        Pick it back up
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="os-state">No habit has gone quiet.</p>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
