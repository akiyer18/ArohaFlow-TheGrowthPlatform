import React from 'react';

const SectionHeader = ({ title, subtitle, actions }) => (
  <div className="flow-section flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h2>{title}</h2>
      {subtitle ? <p className="app-muted mt-1">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </div>
);

export default SectionHeader;
