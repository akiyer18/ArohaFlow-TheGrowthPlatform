import React, { useEffect, useState } from 'react';
import { loadAllowlist, saveAllowlist } from './loadOsData';
import { isAgentHttpConfigured } from './agentHttp';

export default function AllowlistPage() {
  const [status, setStatus] = useState('loading');
  const [entries, setEntries] = useState([]);
  const [type, setType] = useState('email');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState(null);

  const refresh = async () => {
    const payload = await loadAllowlist();
    setEntries(Array.isArray(payload) ? payload : []);
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

  const persist = async (next) => {
    setMessage(null);
    try {
      const saved = await saveAllowlist(next);
      setEntries(Array.isArray(saved) ? saved : next);
      setStatus(next.length ? 'full' : 'empty');
    } catch (err) {
      setMessage(err.message || 'Could not save Sender Allowlist');
    }
  };

  const onAdd = async (event) => {
    event.preventDefault();
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    const next = [
      ...entries.filter((e) => !(e.type === type && e.value === trimmed)),
      { type, value: trimmed },
    ];
    setValue('');
    await persist(next);
  };

  const onRemove = async (entry) => {
    const next = entries.filter((e) => !(e.type === entry.type && e.value === entry.value));
    await persist(next);
  };

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Sender Allowlist
          </h1>
          <p className="os-meta">Addresses and domains always count as Important Email</p>
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

      <section className="os-panel" aria-labelledby="allowlist-form-heading">
        <h2 id="allowlist-form-heading" className="os-panel-title">
          Add entry
        </h2>
        <form className="os-stack" onSubmit={onAdd}>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Type</span>
            <select className="os-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="email">Email</option>
              <option value="domain">Domain</option>
            </select>
          </label>
          <label className="os-stack" style={{ gap: 'var(--space-2xs)' }}>
            <span className="os-meta">Value</span>
            <input
              className="os-input"
              required
              value={value}
              placeholder={type === 'email' ? 'name@example.com' : 'example.com'}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button type="submit" className="os-btn os-btn-primary" disabled={!isAgentHttpConfigured()}>
            Add
          </button>
        </form>
      </section>

      {status === 'loading' ? <p className="os-state">Loading…</p> : null}
      {status === 'error' ? (
        <p className="os-state" role="alert">
          Could not load Sender Allowlist.
        </p>
      ) : null}
      {status === 'empty' ? <p className="os-state">No allowlist entries yet.</p> : null}

      {entries.length > 0 ? (
        <section className="os-panel" aria-labelledby="allowlist-list-heading">
          <h2 id="allowlist-list-heading" className="os-panel-title">
            Entries
          </h2>
          <ul className="os-list">
            {entries.map((entry) => (
              <li key={`${entry.type}:${entry.value}`}>
                <p className="os-list-title">
                  {entry.type} · {entry.value}
                </p>
                <button
                  type="button"
                  className="os-btn os-btn-secondary"
                  disabled={!isAgentHttpConfigured()}
                  onClick={() => onRemove(entry)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
