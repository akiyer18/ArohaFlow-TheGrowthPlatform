import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadToday } from './loadToday';

export default function EmailDigestPage() {
  const [status, setStatus] = useState('loading');
  const [items, setItems] = useState([]);
  const [date, setDate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = await loadToday();
        if (cancelled) return;
        setItems(today.emailDigest ?? []);
        setDate(today.date);
        setStatus(today.emailDigest?.length ? 'full' : 'empty');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Email digest
          </h1>
          <p className="os-meta">{date ?? '…'} · Important Emails only</p>
        </div>
        <Link to="/today" className="os-btn os-btn-secondary">
          Back to Today
        </Link>
      </div>

      <section className="os-panel" aria-labelledby="full-digest-heading">
        <div className="os-panel-head">
          <h2 id="full-digest-heading" className="os-panel-title">
            All items
          </h2>
          <p className="os-meta">{items.length} items</p>
        </div>
        {status === 'loading' ? (
          <div className="os-state os-skeleton" aria-busy="true">
            <span style={{ width: '50%' }} />
            <span style={{ width: '70%' }} />
          </div>
        ) : null}
        {status === 'error' ? (
          <div className="os-state" role="alert">
            Could not load Email Digest.
          </div>
        ) : null}
        {status === 'empty' ? (
          <div className="os-state">No Important Emails yet. Run build_email_digest.</div>
        ) : null}
        {status === 'full' ? (
          <ul className="os-list">
            {items.map((item) => (
              <li key={item.messageId}>
                <p className="os-list-title">{item.subject}</p>
                <p className="os-list-meta">{item.from}</p>
                <p className="os-list-meta">{item.reason}</p>
                {item.snippet ? <p className="os-list-meta">{item.snippet}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
