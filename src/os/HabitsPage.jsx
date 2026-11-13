import React, { useEffect, useState } from 'react';
import { loadHabits, upsertHabit } from './loadOsData';
import { isAgentHttpConfigured } from './agentHttp';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_FORM = {
  id: '',
  label: '',
  timeAnchor: '07:00',
  scheduledDays: [1, 2, 3, 4, 5],
};

export default function HabitsPage() {
  const [status, setStatus] = useState('loading');
  const [habits, setHabits] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);

  const refresh = async () => {
    const payload = await loadHabits();
    setHabits(Array.isArray(payload) ? payload : []);
    setStatus(payload?.length ? 'full' : 'empty');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDay = (day) => {
    setForm((f) => {
      const has = f.scheduledDays.includes(day);
      return {
        ...f,
        scheduledDays: has
          ? f.scheduledDays.filter((d) => d !== day)
          : [...f.scheduledDays, day].sort((a, b) => a - b),
      };
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    const id = form.id.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      await upsertHabit({
        id,
        label: form.label.trim(),
        timeAnchor: form.timeAnchor,
        scheduledDays: form.scheduledDays,
      });
      setForm(EMPTY_FORM);
      await refresh();
      setMessage(`Saved ${form.label.trim()}`);
    } catch (err) {
      setMessage(err.message || 'Could not save Habit');
    }
  };

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Habits
          </h1>
          <p className="os-meta">Scheduled days + time anchor (Calendar View heatmap)</p>
        </div>
      </div>

      {message ? (
        <p className="os-meta" role="status">
          {message}
        </p>
      ) : null}

      {!isAgentHttpConfigured() ? (
        <p className="os-meta">
          Fixture preview — set VITE_AGENT_HTTP_URL and run npm run agent:start to save.
        </p>
      ) : null}

      <section className="os-panel" aria-labelledby="habit-form-heading">
        <h2 id="habit-form-heading" className="os-panel-title">
          {form.id ? 'Edit Habit' : 'Add Habit'}
        </h2>
        <form className="os-stack" onSubmit={onSubmit}>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Label</span>
            <input
              className="os-input"
              required
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Time anchor</span>
            <input
              className="os-input"
              required
              type="time"
              value={form.timeAnchor}
              onChange={(e) => setForm((f) => ({ ...f, timeAnchor: e.target.value }))}
            />
          </label>
          <fieldset className="os-stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="os-meta">Scheduled days</legend>
            <div className="os-toolbar-actions">
              {WEEKDAY_LABELS.map((label, day) => (
                <label key={label} className="os-meta" style={{ display: 'inline-flex', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={form.scheduledDays.includes(day)}
                    onChange={() => toggleDay(day)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="os-btn os-btn-primary" disabled={!isAgentHttpConfigured()}>
            Save
          </button>
        </form>
      </section>

      {status === 'loading' ? <p className="os-state">Loading…</p> : null}
      {status === 'error' ? (
        <p className="os-state" role="alert">
          Could not load Habits.
        </p>
      ) : null}
      {status === 'empty' ? <p className="os-state">No Habits yet.</p> : null}

      {habits.length > 0 ? (
        <section className="os-panel" aria-labelledby="habit-list-heading">
          <h2 id="habit-list-heading" className="os-panel-title">
            Schedule
          </h2>
          <ul className="os-list">
            {habits.map((habit) => (
              <li key={habit.id}>
                <p className="os-list-title">
                  {habit.label} · {habit.timeAnchor}
                </p>
                <p className="os-list-meta">
                  {(habit.scheduledDays || []).map((d) => WEEKDAY_LABELS[d]).join(', ')}
                </p>
                <button
                  type="button"
                  className="os-btn os-btn-secondary"
                  style={{ marginTop: 'var(--space-xs)' }}
                  onClick={() =>
                    setForm({
                      id: habit.id,
                      label: habit.label,
                      timeAnchor: habit.timeAnchor,
                      scheduledDays: [...(habit.scheduledDays || [])],
                    })
                  }
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
