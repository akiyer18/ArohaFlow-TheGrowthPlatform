import React from 'react';

/**
 * Full-screen ambient flow field background.
 * GPU-friendly: transform and opacity only. Very slow (30–90s), low opacity (0.05–0.12).
 * Colors come from CSS vars set by time theme.
 */
export default function FlowFieldBackground() {
  return (
    <div
      className="flow-field-bg"
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div className="flow-field-blob flow-field-blob-1" />
      <div className="flow-field-blob flow-field-blob-2" />
      <div className="flow-field-blob flow-field-blob-3" />
    </div>
  );
}
