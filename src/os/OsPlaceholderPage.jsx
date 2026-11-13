import React from 'react';

export default function OsPlaceholderPage({ title, note }) {
  return (
    <section className="os-panel" aria-labelledby="os-placeholder-title">
      <h1 id="os-placeholder-title" className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
        {title}
      </h1>
      <p className="os-state">{note}</p>
    </section>
  );
}
