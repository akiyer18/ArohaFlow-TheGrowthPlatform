import React, { useState } from 'react';
import { getDiscoveryCvSuggestions, refreshDiscovery, runDiscoverySearch } from './loadOsData';
import { isAgentHttpConfigured } from './agentHttp';

function livenessClass(value) {
  switch (value) {
    case 'open':
      return 'os-status os-status-liveness-open';
    case 'expired':
      return 'os-status os-status-liveness-expired';
    case 'uncertain':
      return 'os-status os-status-liveness-uncertain';
    default:
      return 'os-status';
  }
}

function scanSummaryText(s) {
  const parts = [
    `Read ${s.companiesRead} of ${s.companies} company boards`,
    `${s.found} jobs found`,
    `${s.added} new`,
    `${s.expired} closed`,
  ];
  const notes = [...(s.skipped ?? [])];
  if (s.failed?.length) notes.push(`${s.failed.length} source(s) failed: ${s.failed.join(', ')}`);
  return `${parts.join(' · ')}.${notes.length ? ` ${notes.join('. ')}.` : ''}`;
}

function normalizeLink(link) {
  return typeof link === 'string' ? link.trim() : '';
}

/**
 * Discovery: listings from career-data, saved onto the Applications board as Saved.
 * `boardUrls` marks hits already on the board; `onSave` writes through the board's store.
 */
export default function DiscoveryPanel({ boardUrls, onSave }) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState(null);
  const [discovery, setDiscovery] = useState({ searchedAt: null, results: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [cvTips, setCvTips] = useState(null);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTips = async (listingId) => {
    setSelectedId(listingId);
    setCvTips(null);
    if (!listingId) return;
    try {
      setCvTips(await getDiscoveryCvSuggestions(listingId));
    } catch (err) {
      setMessage(err.message || 'Could not load CV suggestions');
    }
  };

  const onRefresh = async () => {
    setMessage(null);
    setRefreshing(true);
    try {
      const summary = await refreshDiscovery();
      await onRun({ keepMessage: true });
      setMessage(scanSummaryText(summary));
    } catch (err) {
      setMessage(err.message || 'Refreshing listings failed');
    } finally {
      setRefreshing(false);
    }
  };

  const onRun = async ({ keepMessage = false } = {}) => {
    if (!keepMessage) setMessage(null);
    setStatus('loading');
    try {
      const payload = await runDiscoverySearch({ includeExpired });
      const results = Array.isArray(payload?.results) ? payload.results : [];
      setDiscovery({ searchedAt: payload?.searchedAt ?? null, results });
      setStatus(results.length ? 'full' : 'empty');
      await loadTips(results[0]?.id ?? null);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Discovery search failed');
    }
  };

  const onSaveHit = async (hit) => {
    setMessage(null);
    try {
      await onSave({
        company: hit.company,
        role: hit.roleTitle,
        url: normalizeLink(hit.link) || null,
        source: 'Discovery',
        stage: 'saved',
      });
    } catch (err) {
      setMessage(err.message || 'Could not save to the board');
    }
  };

  const onBoard = (hit) => {
    const link = normalizeLink(hit.link);
    return link !== '' && boardUrls.has(link);
  };

  const selected = discovery.results.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <label className="os-meta" style={{ display: 'inline-flex', gap: '0.4rem' }}>
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
          />
          Include expired
        </label>
        <div className="os-toolbar-actions">
          <button
            type="button"
            className="os-btn os-btn-secondary"
            onClick={onRefresh}
            disabled={refreshing || !isAgentHttpConfigured()}
            title="Fetch fresh jobs from company boards and job sites, and check which are still open"
          >
            {refreshing ? 'Refreshing…' : 'Refresh listings'}
          </button>
          <button type="button" className="os-btn os-btn-primary" onClick={() => onRun()} disabled={refreshing}>
            Run search
          </button>
        </div>
      </div>

      {message ? (
        <p className="ap-notice" role="status">
          {message}
        </p>
      ) : null}
      {refreshing ? (
        <p className="os-state">Checking company boards and job sites… this takes about half a minute.</p>
      ) : null}
      {status === 'loading' ? <p className="os-state">Searching…</p> : null}
      {status === 'error' ? (
        <p className="os-state" role="alert">
          Discovery search failed.
        </p>
      ) : null}
      {status === 'empty' ? <p className="os-state">No open listings matched.</p> : null}
      {status === 'idle' ? <p className="os-state">Run a search to load Discovery results.</p> : null}

      {discovery.results.length > 0 ? (
        <section className="os-panel" aria-labelledby="discovery-heading">
          <h2 id="discovery-heading" className="os-panel-title">
            Discovery
          </h2>
          {discovery.searchedAt ? <p className="os-meta">Searched {discovery.searchedAt}</p> : null}
          <div className="os-table-wrap">
            <table className="os-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Role</th>
                  <th scope="col">Score</th>
                  <th scope="col">Recency</th>
                  <th scope="col">Liveness</th>
                  <th scope="col">
                    <span className="os-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {discovery.results.map((hit) => (
                  <tr key={hit.id} className={hit.id === selectedId ? 'os-table-row-selected' : undefined}>
                    <td className="os-table-strong">{hit.company}</td>
                    <td>{hit.roleTitle}</td>
                    <td>{typeof hit.score === 'number' ? hit.score.toFixed(1) : '—'}</td>
                    <td>{hit.recencyDate || '—'}</td>
                    <td>
                      <span className={livenessClass(hit.liveness)}>{hit.liveness}</span>
                    </td>
                    <td className="os-table-actions">
                      <button
                        type="button"
                        className="os-btn os-btn-secondary os-btn-compact"
                        onClick={() => loadTips(hit.id)}
                      >
                        Details
                      </button>
                      {onBoard(hit) ? (
                        <span className="os-meta">On the board</span>
                      ) : (
                        <button
                          type="button"
                          className="os-btn os-btn-primary os-btn-compact"
                          onClick={() => onSaveHit(hit)}
                        >
                          Save
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selected ? (
        <section className="os-panel" aria-labelledby="discovery-detail-heading">
          <h2 id="discovery-detail-heading" className="os-panel-title">
            {selected.company} — {selected.roleTitle}
          </h2>
          <p className="os-meta">
            {selected.link ? (
              <a className="os-inline-link" href={selected.link} target="_blank" rel="noreferrer">
                Open posting
              </a>
            ) : (
              'No link'
            )}
            {' · '}
            score {typeof selected.score === 'number' ? selected.score.toFixed(1) : '—'}
            {' · '}
            recency {selected.recencyDate || '—'}
          </p>
          <p className="os-body">{selected.description || 'No description.'}</p>

          {cvTips ? (
            <div className="os-stack" style={{ marginTop: 'var(--space-sm)' }}>
              <h3 className="os-panel-title" style={{ fontSize: 'var(--text-md)' }}>
                CV suggestions
              </h3>
              <p className="os-meta">Guidance only — edit your CV yourself.</p>
              {cvTips.sections?.length ? (
                <ul className="os-plain-list">
                  {cvTips.sections.map((s) => (
                    <li key={`${s.section}-${s.suggestion}`}>
                      <strong>{s.section}:</strong> {s.suggestion}
                    </li>
                  ))}
                </ul>
              ) : null}
              {cvTips.keywords?.length ? (
                <ul className="os-plain-list">
                  {cvTips.keywords.map((k) => (
                    <li key={`${k.keyword}-${k.experienceHint}`}>
                      <strong>{k.keyword}:</strong> {k.experienceHint}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="os-meta" style={{ marginTop: 'var(--space-sm)' }}>
              Select Details to load CV suggestions.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
