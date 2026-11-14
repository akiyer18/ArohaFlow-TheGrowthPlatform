import React, { useEffect, useState } from 'react';
import {
  loadGoals,
  upsertGoal,
  upsertAction,
  upsertMicroaction,
  loadWeeklyPlanProposal,
  proposeWeeklyPlan,
  editWeeklyPlan,
  acceptWeeklyPlan,
  scheduleMicroaction,
} from './loadOsData';
import { isAgentHttpConfigured } from './agentHttp';

const EMPTY_GOAL = { id: '', title: '' };
const EMPTY_ACTION = { goalId: '', id: '', title: '', status: 'active' };
const EMPTY_MICRO = { actionId: '', id: '', title: '', status: 'open' };

function tomorrowDateKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function GoalsPage() {
  const [status, setStatus] = useState('loading');
  const [goals, setGoals] = useState([]);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL);
  const [actionForm, setActionForm] = useState(EMPTY_ACTION);
  const [microForm, setMicroForm] = useState(EMPTY_MICRO);
  const [weeklyGoalId, setWeeklyGoalId] = useState('');
  const [proposal, setProposal] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(tomorrowDateKey);
  const [message, setMessage] = useState(null);

  const refresh = async () => {
    const payload = await loadGoals();
    setGoals(Array.isArray(payload) ? payload : []);
    setStatus(payload?.length ? 'full' : 'empty');
    if (isAgentHttpConfigured()) {
      const weekly = await loadWeeklyPlanProposal();
      setProposal(weekly);
      if (weekly?.goalId) setWeeklyGoalId(weekly.goalId);
    }
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

  const saveGoal = async (event) => {
    event.preventDefault();
    setMessage(null);
    try {
      const saved = await upsertGoal({
        id: goalForm.id.trim() || undefined,
        title: goalForm.title.trim(),
      });
      setGoalForm(EMPTY_GOAL);
      await refresh();
      if (saved?.id) {
        setActionForm((f) => ({ ...f, goalId: saved.id }));
        setWeeklyGoalId(saved.id);
      }
      setMessage('Saved Goal — selected in Action and Weekly Plan');
    } catch (err) {
      setMessage(err.message || 'Could not save Goal');
    }
  };

  const saveAction = async (event) => {
    event.preventDefault();
    setMessage(null);
    try {
      const saved = await upsertAction({
        goalId: actionForm.goalId,
        id: actionForm.id.trim() || undefined,
        title: actionForm.title.trim(),
        status: actionForm.status,
      });
      const goalId = actionForm.goalId;
      setActionForm({ ...EMPTY_ACTION, goalId });
      await refresh();
      if (saved?.id) {
        setMicroForm((f) => ({ ...f, actionId: saved.id }));
      }
      setMessage('Saved Action — selected for Microaction');
    } catch (err) {
      setMessage(err.message || 'Could not save Action');
    }
  };

  const saveMicro = async (event) => {
    event.preventDefault();
    setMessage(null);
    try {
      await upsertMicroaction({
        actionId: microForm.actionId,
        id: microForm.id.trim() || undefined,
        title: microForm.title.trim(),
        status: microForm.status,
      });
      setMicroForm(EMPTY_MICRO);
      await refresh();
      setMessage('Saved Microaction');
    } catch (err) {
      setMessage(err.message || 'Could not save Microaction');
    }
  };

  const actionOptions = goals.flatMap((goal) =>
    (goal.actions || []).map((action) => ({
      value: action.id,
      label: `${goal.title || goal.id} · ${action.title || action.id}`,
    })),
  );

  const onProposeWeekly = async () => {
    setMessage(null);
    try {
      const next = await proposeWeeklyPlan({ goalId: weeklyGoalId });
      setProposal(next);
      setMessage('Weekly Plan proposed (candidates only — not locked)');
    } catch (err) {
      setMessage(err.message || 'Could not propose Weekly Plan');
    }
  };

  const onEditWeeklyTitle = (actionIndex, title) => {
    if (!proposal || proposal.committed) return;
    const actions = (proposal.actions || []).map((action, idx) =>
      idx === actionIndex ? { ...action, title } : action,
    );
    setProposal({ ...proposal, actions });
  };

  const onEditWeeklyMicroTitle = (actionIndex, microIndex, title) => {
    if (!proposal || proposal.committed) return;
    const actions = (proposal.actions || []).map((action, idx) => {
      if (idx !== actionIndex) return action;
      const microactions = (action.microactions || []).map((micro, mIdx) =>
        mIdx === microIndex ? { ...micro, title } : micro,
      );
      return { ...action, microactions };
    });
    setProposal({ ...proposal, actions });
  };

  const onSaveWeeklyEdit = async () => {
    setMessage(null);
    try {
      const next = await editWeeklyPlan({
        actions: (proposal?.actions || []).map((action) => ({
          title: action.title,
          microactions: (action.microactions || []).map((m) => ({ title: m.title })),
        })),
      });
      setProposal(next);
      setMessage('Weekly Plan candidates updated');
    } catch (err) {
      setMessage(err.message || 'Could not edit Weekly Plan');
    }
  };

  const onAcceptWeekly = async () => {
    setMessage(null);
    try {
      const next = await acceptWeeklyPlan();
      setProposal(next);
      await refresh();
      setMessage('Accepted into Goals (Day Plan not locked)');
    } catch (err) {
      setMessage(err.message || 'Could not accept Weekly Plan');
    }
  };

  const onScheduleMicro = async (microactionId) => {
    setMessage(null);
    try {
      await scheduleMicroaction({ microactionId, date: scheduleDate });
      setMessage(`Scheduled on ${scheduleDate} (proposed — not locked)`);
    } catch (err) {
      setMessage(err.message || 'Could not schedule Microaction');
    }
  };

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Goals
          </h1>
          <p className="os-meta">Goals → Actions → Microactions · Weekly Plan</p>
        </div>
      </div>

      {message ? (
        <p className="os-meta" role="status">
          {message}
        </p>
      ) : null}

      {!isAgentHttpConfigured() ? (
        <p className="os-meta">
          Fixture preview — set VITE_AGENT_HTTP_URL and run npm run dev:os to save.
        </p>
      ) : null}

      <section className="os-panel" aria-labelledby="weekly-plan-heading">
        <h2 id="weekly-plan-heading" className="os-panel-title">
          Weekly Plan
        </h2>
        <p className="os-meta">Propose → edit → accept → schedule. Accept does not lock Today.</p>
        <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
          <span className="os-meta">Goal</span>
          <select
            className="os-input"
            value={weeklyGoalId}
            onChange={(e) => setWeeklyGoalId(e.target.value)}
          >
            <option value="">Select Goal</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title || goal.id}
              </option>
            ))}
          </select>
        </label>
        <div className="os-toolbar-actions" style={{ marginTop: 'var(--space-sm)' }}>
          <button
            type="button"
            className="os-btn os-btn-primary"
            disabled={!isAgentHttpConfigured() || !weeklyGoalId}
            onClick={onProposeWeekly}
          >
            Propose
          </button>
          <button
            type="button"
            className="os-btn os-btn-secondary"
            disabled={!isAgentHttpConfigured() || !proposal || proposal.committed}
            onClick={onSaveWeeklyEdit}
          >
            Save edits
          </button>
          <button
            type="button"
            className="os-btn os-btn-primary"
            disabled={!isAgentHttpConfigured() || !proposal || proposal.committed}
            onClick={onAcceptWeekly}
          >
            Accept
          </button>
        </div>
        <label className="os-stack" style={{ gap: 'var(--space-2xs)', marginTop: 'var(--space-sm)' }}>
          <span className="os-meta">Schedule date</span>
          <input
            className="os-input"
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
          />
        </label>
        {proposal ? (
          <ul className="os-list" style={{ marginTop: 'var(--space-sm)' }}>
            <li>
              <p className="os-list-meta">
                {proposal.committed ? 'Accepted' : 'Candidates'} · Goal {proposal.goalId}
              </p>
            </li>
            {(proposal.actions || []).map((action, actionIndex) => (
              <li key={`wa-${actionIndex}`}>
                {proposal.committed ? (
                  <p className="os-list-title">Action · {action.title}</p>
                ) : (
                  <input
                    className="os-input"
                    value={action.title || ''}
                    onChange={(e) => onEditWeeklyTitle(actionIndex, e.target.value)}
                    aria-label={`Candidate Action ${actionIndex + 1}`}
                  />
                )}
                <ul className="os-list" style={{ marginTop: 'var(--space-xs)' }}>
                  {(action.microactions || []).map((micro, microIndex) => (
                    <li key={micro.id || `wm-${actionIndex}-${microIndex}`}>
                      {proposal.committed ? (
                        <p className="os-list-meta">Microaction · {micro.title}</p>
                      ) : (
                        <input
                          className="os-input"
                          value={micro.title || ''}
                          onChange={(e) =>
                            onEditWeeklyMicroTitle(actionIndex, microIndex, e.target.value)
                          }
                          aria-label={`Candidate Microaction ${actionIndex + 1}.${microIndex + 1}`}
                        />
                      )}
                      {proposal.committed && micro.id ? (
                        <button
                          type="button"
                          className="os-btn os-btn-secondary"
                          style={{ marginTop: 'var(--space-2xs)' }}
                          disabled={!isAgentHttpConfigured()}
                          onClick={() => onScheduleMicro(micro.id)}
                        >
                          Schedule
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="os-meta" style={{ marginTop: 'var(--space-sm)' }}>
            No proposal yet.
          </p>
        )}
      </section>

      <section className="os-panel" aria-labelledby="goal-form-heading">
        <h2 id="goal-form-heading" className="os-panel-title">
          {goalForm.id ? 'Edit Goal' : 'Add Goal'}
        </h2>
        <form className="os-stack" onSubmit={saveGoal}>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Title</span>
            <input
              className="os-input"
              required
              value={goalForm.title}
              onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <button type="submit" className="os-btn os-btn-primary" disabled={!isAgentHttpConfigured()}>
            Save Goal
          </button>
        </form>
      </section>

      <section className="os-panel" aria-labelledby="action-form-heading">
        <h2 id="action-form-heading" className="os-panel-title">
          {actionForm.id ? 'Edit Action' : 'Add Action'}
        </h2>
        <form className="os-stack" onSubmit={saveAction}>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Goal</span>
            <select
              className="os-input"
              required
              value={actionForm.goalId}
              onChange={(e) => setActionForm((f) => ({ ...f, goalId: e.target.value }))}
            >
              <option value="">Select Goal</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title || goal.id}
                </option>
              ))}
            </select>
            {goals.length === 0 ? (
              <span className="os-meta">No Goals yet — save a Goal above first.</span>
            ) : null}
          </label>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Title</span>
            <input
              className="os-input"
              required
              value={actionForm.title}
              onChange={(e) => setActionForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Status</span>
            <select
              className="os-input"
              value={actionForm.status}
              onChange={(e) => setActionForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="active">active</option>
              <option value="parked">parked</option>
              <option value="completed">completed</option>
            </select>
          </label>
          <button type="submit" className="os-btn os-btn-primary" disabled={!isAgentHttpConfigured()}>
            Save Action
          </button>
        </form>
      </section>

      <section className="os-panel" aria-labelledby="micro-form-heading">
        <h2 id="micro-form-heading" className="os-panel-title">
          {microForm.id ? 'Edit Microaction' : 'Add Microaction'}
        </h2>
        <form className="os-stack" onSubmit={saveMicro}>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Action</span>
            <select
              className="os-input"
              required
              value={microForm.actionId}
              onChange={(e) => setMicroForm((f) => ({ ...f, actionId: e.target.value }))}
            >
              <option value="">Select Action</option>
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Title</span>
            <input
              className="os-input"
              required
              value={microForm.title}
              onChange={(e) => setMicroForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Status</span>
            <select
              className="os-input"
              value={microForm.status}
              onChange={(e) => setMicroForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="open">open</option>
              <option value="active">active</option>
              <option value="parked">parked</option>
              <option value="completed">completed</option>
            </select>
          </label>
          <button type="submit" className="os-btn os-btn-primary" disabled={!isAgentHttpConfigured()}>
            Save Microaction
          </button>
        </form>
      </section>

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
      {status === 'empty' ? <p className="os-state">No Goals yet. Add one above.</p> : null}

      {status === 'full'
        ? goals.map((goal) => (
            <section key={goal.id} className="os-panel" aria-labelledby={`goal-${goal.id}`}>
              <div className="os-panel-head">
                <h2 id={`goal-${goal.id}`} className="os-panel-title">
                  {goal.title || goal.id}
                </h2>
                <button
                  type="button"
                  className="os-btn os-btn-secondary"
                  onClick={() => setGoalForm({ id: goal.id, title: goal.title || '' })}
                >
                  Edit
                </button>
              </div>
              <ul className="os-list">
                {(goal.actions || []).map((action) => (
                  <li key={action.id}>
                    <p className="os-list-title">
                      Action · {action.title || action.id}
                      {action.status ? ` · ${action.status}` : ''}
                    </p>
                    <button
                      type="button"
                      className="os-btn os-btn-secondary"
                      style={{ marginTop: 'var(--space-2xs)' }}
                      onClick={() =>
                        setActionForm({
                          goalId: goal.id,
                          id: action.id,
                          title: action.title || '',
                          status: action.status || 'active',
                        })
                      }
                    >
                      Edit Action
                    </button>
                    <ul className="os-list" style={{ marginTop: 'var(--space-xs)' }}>
                      {(action.microactions || []).map((micro) => (
                        <li key={micro.id}>
                          <p className="os-list-meta">
                            Microaction · {micro.title || micro.id}
                            {micro.status ? ` · ${micro.status}` : ''}
                          </p>
                          <button
                            type="button"
                            className="os-btn os-btn-secondary"
                            style={{ marginTop: 'var(--space-2xs)' }}
                            onClick={() =>
                              setMicroForm({
                                actionId: action.id,
                                id: micro.id,
                                title: micro.title || '',
                                status: micro.status || 'open',
                              })
                            }
                          >
                            Edit Microaction
                          </button>
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
