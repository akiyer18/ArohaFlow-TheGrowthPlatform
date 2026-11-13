import React from 'react';
import { Link } from 'react-router-dom';

const CORE = [
  { to: '/journal', label: 'Journal' },
  { to: '/knowledge-expansion', label: 'Knowledge' },
];

const SECONDARY = [
  { to: '/email-digest', label: 'Email Digest' },
  { to: '/allowlist', label: 'Sender Allowlist' },
  { to: '/analytics', label: 'Analytics (weekly review)' },
];

export default function MoreToolsPage() {
  return (
    <section className="os-panel" aria-labelledby="more-tools-title">
      <h1 id="more-tools-title" className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
        More tools
      </h1>
      <p className="os-meta" style={{ marginBottom: 'var(--space-md)' }}>
        Journal and Knowledge live here. Digest, Allowlist, and Analytics stay off primary nav. Task
        Manager and Flow Mode stay Legacy and are not linked.
      </p>

      <h2 className="os-panel-title">Core</h2>
      <ul className="os-list" style={{ marginBottom: 'var(--space-lg)' }}>
        {CORE.map((item) => (
          <li key={item.to}>
            <Link className="os-list-title" to={item.to} style={{ color: 'var(--color-ink)' }}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="os-panel-title">Also here</h2>
      <ul className="os-list">
        {SECONDARY.map((item) => (
          <li key={item.to}>
            <Link className="os-list-title" to={item.to} style={{ color: 'var(--color-ink)' }}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
