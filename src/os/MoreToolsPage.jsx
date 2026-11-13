import React from 'react';
import { Link } from 'react-router-dom';

const LINKS = [
  { to: '/analytics', label: 'Analytics (weekly review)' },
  { to: '/email-digest', label: 'Email Digest' },
  { to: '/journal', label: 'Journal' },
  { to: '/knowledge-expansion', label: 'Knowledge' },
  { to: '/dashboard', label: 'Legacy module hub' },
];

export default function MoreToolsPage() {
  return (
    <section className="os-panel" aria-labelledby="more-tools-title">
      <h1 id="more-tools-title" className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
        More tools
      </h1>
      <p className="os-meta" style={{ marginBottom: 'var(--space-md)' }}>
        Secondary tools. Task Manager and Flow Mode stay Legacy and are not linked here.
      </p>
      <ul className="os-list">
        {LINKS.map((item) => (
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
