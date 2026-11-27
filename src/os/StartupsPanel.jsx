import React, { useEffect, useMemo, useState } from 'react';
import { findStartups, loadStartups, setStartupStatus } from './loadOsData';
import { isAgentHttpConfigured } from './agentHttp';

function runSummaryText(s) {
  if (!s) return null;
  const parts = [
    `${s.candidates} candidates`,
    `${s.checked} checked on their own website`,
    `${s.added} added`,
    `${s.rejected} rejected`,
  ];
  if (s.unreachable) parts.push(`${s.unreachable} unreachable`);
  if (s.deferred) parts.push(`${s.deferred} left for the next run`);
  if (s.boardsAdded) parts.push(`${s.boardsAdded} job board(s) added to Discovery`);
  const extra = [...(s.notes ?? []), ...(s.failed?.length ? [`${s.failed.length} step(s) failed: ${s.failed.join('; ')}`] : [])];
  return `${parts.join(' · ')}.${extra.length ? ` ${extra.join('. ')}.` : ''}`;
}

function siteLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Startups: small Dutch AI companies, verified on their own websites, for open applications.
 * `boardUrls` marks companies already on the Applications board; `onSave` writes through its store.
 */
export default function StartupsPanel({ boardUrls, onSave }) {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState({ companies: [], lastRun: null });
  const [message, setMessage] = useState(null);
  const [running, setRunning] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  const load = async () => {
    try {
      const payload = await loadStartups();
      setData({ companies: payload?.companies ?? [], lastRun: payload?.lastRun ?? null });
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Could not load startups');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onFind = async () => {
    setMessage(null);
    setRunning(true);
    try {
      const summary = await findStartups();
      await load();
      setMessage(runSummaryText(summary));
    } catch (err) {
      setMessage(err.message || 'Finding startups failed');
    } finally {
      setRunning(false);
    }
  };

  const updateStatus = async (company, next) => {
    setMessage(null);
    try {
      await setStartupStatus({ id: company.id, status: next });
      setData((prev) => ({
        ...prev,
        companies: prev.companies.map((c) => (c.id === company.id ? { ...c, status: next } : c)),
      }));
    } catch (err) {
      setMessage(err.message || 'Could not update the startup');
    }
  };

  const onSaveCompany = async (company) => {
    setMessage(null);
    try {
      await onSave({
        company: company.name,
        role: 'Open application',
        url: company.website,
        location: company.city || null,
        source: 'Startups',
        stage: 'saved',
        notes: [company.emails?.[0] ? `Email: ${company.emails[0]}` : null, company.reason].filter(Boolean).join('\n'),
      });
      await updateStatus(company, 'saved');
    } catch (err) {
      setMessage(err.message || 'Could not save to the board');
    }
  };

  const visible = useMemo(
    () => data.companies.filter((c) => showDismissed || c.status !== 'dismissed'),
    [data, showDismissed],
  );
  const onBoard = (c) => c.status === 'saved' || boardUrls.has(c.website?.trim());

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <label className="os-meta" style={{ display: 'inline-flex', gap: '0.4rem' }}>
          <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} />
          Show dismissed
        </label>
        <div className="os-toolbar-actions">
          <button
            type="button"
            className="os-btn os-btn-primary"
            onClick={onFind}
            disabled={running || !isAgentHttpConfigured()}
            title="Search the web and the YC directory, then check each company on its own website"
          >
            {running ? 'Finding…' : 'Find startups'}
          </button>
        </div>
      </div>

      {message ? (
        <p className="ap-notice" role="status">
          {message}
        </p>
      ) : null}
      {running ? (
        <p className="os-state">Searching and reading company websites… this can take a few minutes.</p>
      ) : null}
      {status === 'loading' ? <p className="os-state">Loading…</p> : null}
      {status === 'ready' && !visible.length && !running ? (
        <p className="os-state">
          No startups yet. Find startups searches the web and the YC directory for small AI companies in the
          Netherlands and keeps only those its checks confirm on their own websites.
        </p>
      ) : null}

      {visible.length ? (
        <section className="os-panel" aria-labelledby="startups-heading">
          <h2 id="startups-heading" className="os-panel-title">
            Startups <span className="os-fig">{visible.length}</span>
          </h2>
          {data.lastRun?.ranAt ? <p className="os-meta">Last run {new Date(data.lastRun.ranAt).toLocaleString()}</p> : null}
          <div className="os-table-wrap">
            <table className="os-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">What they do</th>
                  <th scope="col">Fit</th>
                  <th scope="col">Size</th>
                  <th scope="col">Contact</th>
                  <th scope="col">
                    <span className="os-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} style={c.status === 'dismissed' ? { opacity: 0.55 } : undefined}>
                    <td className="os-table-strong">
                      <a className="os-inline-link" href={c.website} target="_blank" rel="noreferrer">
                        {c.name}
                      </a>
                      <div className="os-meta">{[c.city, siteLabel(c.website)].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>
                      {c.whatTheyDo}
                      <div className="os-meta">{c.reason}</div>
                    </td>
                    <td className="os-fig" title={c.hiringSignals?.join(' · ') || undefined}>
                      {c.fit}/5
                    </td>
                    <td>{c.size === 'unknown' ? '—' : c.size}</td>
                    <td>
                      {c.emails?.length ? (
                        c.emails.map((e) => (
                          <div key={e}>
                            <a className="os-inline-link" href={`mailto:${e}`}>
                              {e}
                            </a>
                          </div>
                        ))
                      ) : (
                        <span className="os-meta">No email published</span>
                      )}
                      {c.careersUrl ? (
                        <div>
                          <a className="os-inline-link" href={c.careersUrl} target="_blank" rel="noreferrer">
                            Careers page
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td className="os-table-actions">
                      {onBoard(c) ? (
                        <span className="os-meta">On the board</span>
                      ) : (
                        <button type="button" className="os-btn os-btn-primary os-btn-compact" onClick={() => onSaveCompany(c)}>
                          Save
                        </button>
                      )}
                      {c.status === 'dismissed' ? (
                        <button type="button" className="os-btn os-btn-secondary os-btn-compact" onClick={() => updateStatus(c, 'new')}>
                          Restore
                        </button>
                      ) : !onBoard(c) ? (
                        <button type="button" className="os-btn os-btn-secondary os-btn-compact" onClick={() => updateStatus(c, 'dismissed')}>
                          Dismiss
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
