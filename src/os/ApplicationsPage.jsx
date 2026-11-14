import React, { useEffect, useState } from 'react';
import { deleteApplication, loadApplications, upsertApplication } from './loadOsData';
import { isAgentHttpConfigured } from './agentHttp';

const STATUSES = [
  { value: 'to_apply', label: 'To apply' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
];

const EMPTY_FORM = {
  id: '',
  company: '',
  roleTitle: '',
  link: '',
  notes: '',
  status: 'to_apply',
};

function statusLabel(value) {
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}

function statusClass(value) {
  switch (value) {
    case 'to_apply':
      return 'os-status os-status-to-apply';
    case 'applied':
      return 'os-status os-status-applied';
    case 'interviewing':
      return 'os-status os-status-interviewing';
    case 'offer':
      return 'os-status os-status-offer';
    case 'rejected':
      return 'os-status os-status-rejected';
    default:
      return 'os-status';
  }
}

export default function ApplicationsPage() {
  const [status, setStatus] = useState('loading');
  const [apps, setApps] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = async () => {
    const payload = await loadApplications();
    setApps(Array.isArray(payload) ? payload : []);
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

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    const id = form.id.trim() || `app-${Date.now()}`;
    try {
      await upsertApplication({
        id,
        company: form.company.trim(),
        roleTitle: form.roleTitle.trim(),
        link: form.link.trim(),
        notes: form.notes.trim(),
        status: form.status,
      });
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await refresh();
      setMessage(`Saved ${form.company.trim()}`);
    } catch (err) {
      setMessage(err.message || 'Could not save Application');
    }
  };

  const onEdit = (app) => {
    setForm({
      id: app.id,
      company: app.company,
      roleTitle: app.roleTitle,
      link: app.link || '',
      notes: app.notes || '',
      status: app.status,
    });
    setFormOpen(true);
  };

  const onDelete = async (id) => {
    setMessage(null);
    try {
      await deleteApplication(id);
      await refresh();
    } catch (err) {
      setMessage(err.message || 'Could not delete Application');
    }
  };

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Applications
          </h1>
          <p className="os-meta">
            {apps.length} in pipeline · status colour-coded
          </p>
        </div>
        <div className="os-toolbar-actions">
          <button
            type="button"
            className="os-btn os-btn-primary"
            disabled={!isAgentHttpConfigured()}
            onClick={() => {
              setForm(EMPTY_FORM);
              setFormOpen(true);
            }}
          >
            Add
          </button>
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

      <ul className="os-status-legend" aria-label="Status colours">
        {STATUSES.map((s) => (
          <li key={s.value}>
            <span className={statusClass(s.value)}>{s.label}</span>
          </li>
        ))}
      </ul>

      {status === 'loading' ? <p className="os-state">Loading…</p> : null}
      {status === 'error' ? (
        <p className="os-state" role="alert">
          Could not load Applications.
        </p>
      ) : null}
      {status === 'empty' ? <p className="os-state">No Applications yet.</p> : null}

      {apps.length > 0 ? (
        <section className="os-panel" aria-labelledby="app-list-heading">
          <h2 id="app-list-heading" className="os-panel-title">
            Pipeline
          </h2>
          <div className="os-table-wrap">
            <table className="os-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Notes</th>
                  <th scope="col">Link</th>
                  <th scope="col">
                    <span className="os-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app.id}>
                    <td className="os-table-strong">{app.company}</td>
                    <td>{app.roleTitle}</td>
                    <td>
                      <span className={statusClass(app.status)}>{statusLabel(app.status)}</span>
                    </td>
                    <td className="os-table-notes">{app.notes || '—'}</td>
                    <td>
                      {app.link ? (
                        <a
                          className="os-inline-link"
                          href={app.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="os-table-actions">
                      <button
                        type="button"
                        className="os-btn os-btn-secondary os-btn-compact"
                        onClick={() => onEdit(app)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="os-btn os-btn-secondary os-btn-compact"
                        disabled={!isAgentHttpConfigured()}
                        onClick={() => onDelete(app.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {formOpen ? (
        <section className="os-panel" aria-labelledby="app-form-heading">
          <h2 id="app-form-heading" className="os-panel-title">
            {form.id ? 'Edit Application' : 'Add Application'}
          </h2>
          <form className="os-form-grid" onSubmit={onSubmit}>
            <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
              <span className="os-meta">Company</span>
              <input
                className="os-input"
                required
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </label>
            <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
              <span className="os-meta">Role title</span>
              <input
                className="os-input"
                required
                value={form.roleTitle}
                onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
              />
            </label>
            <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
              <span className="os-meta">Status</span>
              <select
                className="os-input"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
              <span className="os-meta">Link</span>
              <input
                className="os-input"
                type="url"
                placeholder="https://"
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              />
            </label>
            <label
              className="os-stack"
              style={{ gap: 'var(--space-2xs)', gridColumn: '1 / -1' }}
            >
              <span className="os-meta">Notes</span>
              <textarea
                className="os-input"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className="os-toolbar-actions" style={{ gridColumn: '1 / -1' }}>
              <button
                type="submit"
                className="os-btn os-btn-primary"
                disabled={!isAgentHttpConfigured()}
              >
                Save
              </button>
              <button
                type="button"
                className="os-btn os-btn-secondary"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setFormOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
