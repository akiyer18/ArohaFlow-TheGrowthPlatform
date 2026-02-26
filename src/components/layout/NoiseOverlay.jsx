import React from 'react';

/**
 * Subtle grain overlay to remove flat color and gradient banding. 3–5% opacity.
 */
export default function NoiseOverlay() {
  return (
    <div
      className="flow-noise"
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        opacity: 0.04,
      }}
    />
  );
}
