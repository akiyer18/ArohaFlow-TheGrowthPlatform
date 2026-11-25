import React, { useEffect, useMemo, useState } from 'react';
import {
  CLOSED_REASONS,
  STAGES,
  buildApplicationsView,
  daysInStage,
  getApplications,
  getApplicationsStore,
  moveStage,
  nextStepState,
  stageLabel,
} from '../modules/applications';
import './applications.css';

/* ---------- Formatting ---------- */

function formatDay(dateKey) {
  if (!dateKey) return '';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

const DUE_LABEL = { overdue: 'Overdue', today: 'Today', soon: 'Soon', later: '' };

function dueText(app, state) {
  if (!app.nextStepDue) return null;
  const when = state === 'today' ? 'today' : formatDay(app.nextStepDue);
  return state === 'overdue' ? `was due ${when}` : `due ${when}`;
}

function daysText(n) {
  if (n == null) return '';
  if (n === 0) return 'since today';
  return n === 1 ? '1 day' : `${n} days`;
}

/* ---------- Add form ---------- */

function AddApplicationForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ company: '', role: '', url: '', stage: 'saved', nextStep: '', nextStepDue: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form
      className="ap-add os-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await onSave(form);
        } catch (err) {
          setError(err.message);
          setSaving(false);
        }
      }}
    >
      <h2 className="ap-panel-title">New application</h2>
      <div className="ap-form-grid">
        <label className="ap-field">
          <span className="os-meta">Company</span>
          <input className="os-input" value={form.company} onChange={set('company')} required />
        </label>
        <label className="ap-field">
          <span className="os-meta">Role</span>
          <input className="os-input" value={form.role} onChange={set('role')} required />
        </label>
        <label className="ap-field ap-span-2">
          <span className="os-meta">Link to the posting, optional</span>
          <input className="os-input" type="url" value={form.url} onChange={set('url')} placeholder="https://" />
        </label>
        <fieldset className="ap-groove ap-span-2">
          <legend className="os-meta">Where it stands</legend>
          {['saved', 'applied', 'interviewing', 'offer'].map((id) => (
            <label key={id} className={form.stage === id ? 'ap-choice is-on' : 'ap-choice'}>
              <input type="radio" name="new-stage" value={id} checked={form.stage === id} onChange={set('stage')} />
              {stageLabel(id)}
            </label>
          ))}
        </fieldset>
        <label className="ap-field">
          <span className="os-meta">Next step, optional</span>
          <input className="os-input" value={form.nextStep} onChange={set('nextStep')} placeholder="Tailor CV and apply" />
        </label>
        <label className="ap-field">
          <span className="os-meta">By</span>
          <input className="os-input" type="date" value={form.nextStepDue} onChange={set('nextStepDue')} />
        </label>
      </div>
      {error ? (
        <p className="os-warn" role="alert">
          {error}
        </p>
      ) : null}
      <div className="ap-actions">
        <button type="button" className="os-btn os-btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="os-btn os-btn-primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving' : 'Add application'}
        </button>
      </div>
    </form>
  );
}

/* ---------- Card ---------- */

function ApplicationCard({ app, today, onMove, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [draft, setDraft] = useState({ nextStep: app.nextStep ?? '', nextStepDue: app.nextStepDue ?? '', notes: app.notes ?? '' });
  const state = nextStepState(app, today);
  const order = STAGES.map((s) => s.id);
  const next = order[order.indexOf(app.stage) + 1];
  const nextIsOpen = next && next !== 'closed';

  return (
    <li className={state === 'overdue' ? 'ap-card is-overdue' : 'ap-card'}>
      <div className="ap-card-head">
        <h3 className="ap-company">{app.company}</h3>
        <span className="os-meta">{daysText(daysInStage(app, today))}</span>
      </div>
      <p className="ap-role">{app.role}</p>
      {app.nextStep ? (
        <p className={`ap-next is-${state ?? 'none'}`}>
          {DUE_LABEL[state] ? <span className="ap-due">{DUE_LABEL[state]}</span> : null}
          {app.nextStep}
          {dueText(app, state) ? <span className="ap-when">, {dueText(app, state)}</span> : null}
        </p>
      ) : null}

      <div className="ap-card-foot">
        {nextIsOpen ? (
          <button type="button" className="os-block-btn" onClick={() => onMove(app, next)}>
            Move to {stageLabel(next)}
          </button>
        ) : null}
        <button
          type="button"
          className="ap-text-btn"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            setClosing(false);
          }}
        >
          {open ? 'Less' : 'Details'}
        </button>
      </div>

      {open ? (
        <div className="ap-detail">
          {app.url ? (
            <a className="os-inline-link os-meta" href={app.url} target="_blank" rel="noreferrer">
              Open the posting
            </a>
          ) : null}
          <form
            className="ap-detail-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onUpdate(app.id, draft);
              if (ok) setOpen(false);
            }}
          >
            <label className="ap-field">
              <span className="os-meta">Next step</span>
              <input
                className="os-input"
                value={draft.nextStep}
                onChange={(e) => setDraft((d) => ({ ...d, nextStep: e.target.value }))}
              />
            </label>
            <label className="ap-field">
              <span className="os-meta">By</span>
              <input
                className="os-input"
                type="date"
                value={draft.nextStepDue}
                onChange={(e) => setDraft((d) => ({ ...d, nextStepDue: e.target.value }))}
              />
            </label>
            <label className="ap-field">
              <span className="os-meta">Notes</span>
              <textarea
                className="os-input ap-notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </label>
            <div className="ap-actions">
              <button type="submit" className="os-btn os-btn-secondary">
                Save
              </button>
            </div>
          </form>

          <div className="ap-move">
            <span className="os-meta">Move to</span>
            <div className="ap-move-row">
              {STAGES.filter((s) => s.id !== app.stage && s.id !== 'closed').map((s) => (
                <button key={s.id} type="button" className="os-block-btn" onClick={() => onMove(app, s.id)}>
                  {s.label}
                </button>
              ))}
              <button type="button" className="os-block-btn" aria-expanded={closing} onClick={() => setClosing((v) => !v)}>
                Close
              </button>
            </div>
            {closing ? (
              <div className="ap-move-row" role="group" aria-label="Why it closed">
                {CLOSED_REASONS.map((reason) => (
                  <button key={reason} type="button" className="os-block-btn" onClick={() => onMove(app, 'closed', reason)}>
                    {reason}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ---------- Page ---------- */

export default function ApplicationsPage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getApplications();
        if (cancelled) return;
        setData(payload);
        setStatus(payload.applications.length ? 'full' : 'empty');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message);
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => (data ? buildApplicationsView(data) : null), [data]);

  const commit = async (apply, write, failMessage) => {
    const before = data;
    setData((prev) => apply(prev));
    try {
      await write(await getApplicationsStore());
      return true;
    } catch (err) {
      setData(before);
      setNotice(`${failMessage} ${err.message}`);
      return false;
    }
  };

  const patchApp = (id, patch) => (prev) => ({
    ...prev,
    applications: prev.applications.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  });

  const onMove = async (app, toStage, reason = null) => {
    setNotice(null);
    const { patch, event } = moveStage(app, toStage, data.today, reason);
    const ok = await commit(
      (prev) => ({ ...patchApp(app.id, patch)(prev), events: [...prev.events, event] }),
      async (store) => {
        await store.updateApplication(app.id, patch);
        await store.recordEvent(event);
      },
      'The move was not saved.',
    );
    if (ok) setNotice(`${app.company} moved to ${stageLabel(toStage)}${reason ? `, ${reason.toLowerCase()}` : ''}.`);
  };

  const onUpdate = (id, draft) => {
    setNotice(null);
    const patch = {
      nextStep: draft.nextStep.trim() || null,
      nextStepDue: draft.nextStepDue || null,
      notes: draft.notes.trim() || null,
    };
    return commit(patchApp(id, patch), (store) => store.updateApplication(id, patch), 'The changes were not saved.');
  };

  const onCreate = async (form) => {
    const store = await getApplicationsStore();
    const created = await store.createApplication(form);
    setData((prev) => ({
      ...prev,
      applications: [created, ...prev.applications],
      events: [...prev.events, { applicationId: created.id, fromStage: null, toStage: created.stage, onDate: prev.today }],
    }));
    setStatus('full');
    setAdding(false);
    setNotice(`${created.company} added to ${stageLabel(created.stage)}.`);
  };

  const stats = view?.stats;

  return (
    <div className="ap">
      <header className="ap-head">
        <div className="ap-head-text">
          <h1 className="ap-h1">Applications</h1>
          <p className="ap-lead">
            {stats ? (
              <>
                <span className="os-fig">{stats.open}</span> open, <span className="os-fig">{stats.interviewing}</span>{' '}
                interviewing, <span className="os-fig">{stats.offers}</span> {stats.offers === 1 ? 'offer' : 'offers'}
              </>
            ) : (
              'Your job search, one board'
            )}
          </p>
        </div>
        <div className="ap-head-end">
          {stats ? (
            <p className="ap-moved">
              <span className="os-fig">{stats.movedThisWeek}</span>
              <span className="os-meta">moved this week</span>
            </p>
          ) : null}
          {!adding && status !== 'empty' ? (
            <button type="button" className="os-btn os-btn-primary" onClick={() => setAdding(true)} disabled={status === 'loading'}>
              Add application
            </button>
          ) : null}
        </div>
      </header>

      {notice ? (
        <p className="ap-notice" role="status">
          {notice}
        </p>
      ) : null}

      {adding ? <AddApplicationForm onSave={onCreate} onCancel={() => setAdding(false)} /> : null}

      {status === 'loading' ? (
        <div className="os-state os-skeleton" aria-busy="true">
          <span style={{ width: '30%' }} />
          <span style={{ width: '70%' }} />
          <span style={{ width: '50%' }} />
        </div>
      ) : status === 'error' ? (
        <div className="os-state" role="alert">
          Could not load applications{loadError ? ` (${loadError})` : ''}. Check that you are signed in and that
          database/applications-store.sql has been run, then refresh.
        </div>
      ) : status === 'empty' ? (
        <div className="ap-empty">
          <p className="os-state">
            No applications yet. Add the first one, even if it is only saved for later; the board fills from there.
          </p>
          <AddApplicationForm onSave={onCreate} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <>
          <div className="ap-focus">
            <section className="os-panel" aria-labelledby="ap-next-heading">
              <div className="ap-section-head">
                <h2 id="ap-next-heading" className="ap-panel-title">
                  Next steps
                </h2>
                <p className="os-meta">
                  <span className="os-fig">{view.nextSteps.length}</span> dated
                </p>
              </div>
              {view.nextSteps.length ? (
                <ul className="os-list">
                  {view.nextSteps.slice(0, 5).map(({ app, state }) => (
                    <li key={app.id} className={`ap-step is-${state}`}>
                      <div className="ap-step-text">
                        <p className="os-list-title">{app.nextStep}</p>
                        <p className="os-list-meta">
                          {app.company}, {stageLabel(app.stage).toLowerCase()}
                        </p>
                      </div>
                      <span className="ap-step-when">{state === 'today' ? 'Today' : formatDay(app.nextStepDue)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="os-state">No dated next steps. Add one from a card&rsquo;s details.</p>
              )}
            </section>

            <section className="os-panel" aria-labelledby="ap-follow-heading">
              <div className="ap-section-head">
                <h2 id="ap-follow-heading" className="ap-panel-title">
                  Worth a follow-up
                </h2>
              </div>
              {view.followUps.length ? (
                <ul className="os-list">
                  {view.followUps.map(({ app, days }) => (
                    <li key={app.id} className="ap-step">
                      <div className="ap-step-text">
                        <p className="os-list-title">{app.company}</p>
                        <p className="os-list-meta">
                          {app.role}, quiet for <span className="os-fig">{days}</span> days
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="os-state">Nothing has gone quiet for 10 days.</p>
              )}
            </section>
          </div>

          <section className="ap-board" aria-label="Pipeline">
            {view.columns.map((col) => (
              <div key={col.id} className="ap-col">
                <div className="ap-col-head">
                  <h2 className="ap-col-title">{col.label}</h2>
                  <span className="os-meta os-fig">{col.items.length}</span>
                </div>
                {col.items.length ? (
                  <ul className="ap-cards">
                    {col.items.map((app) => (
                      <ApplicationCard key={app.id} app={app} today={data.today} onMove={onMove} onUpdate={onUpdate} />
                    ))}
                  </ul>
                ) : (
                  <p className="ap-col-empty">Nothing here.</p>
                )}
              </div>
            ))}
          </section>

          {view.closed.length ? (
            <details className="ap-closed">
              <summary>
                Closed <span className="os-fig">{view.closed.length}</span>
              </summary>
              <ul className="os-list">
                {view.closed.map((app) => (
                  <li key={app.id} className="ap-step">
                    <div className="ap-step-text">
                      <p className="os-list-title">
                        {app.company}, {app.role}
                      </p>
                      <p className="os-list-meta">
                        {app.closedReason}, {formatDay(app.stageChangedOn)}
                      </p>
                    </div>
                    <button type="button" className="os-block-btn" onClick={() => onMove(app, 'applied')}>
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
