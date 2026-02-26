import React, { useState, useEffect } from 'react';
import { getTimeTheme, getTimeThemeVars } from '../utils/timeTheme';

/**
 * Sets time-aware CSS custom properties on the app root for smooth, non-reload theme updates.
 */
export function TimeThemeProvider({ children }) {
  const [vars, setVars] = useState(() => getTimeThemeVars());

  useEffect(() => {
    const update = () => setVars(getTimeThemeVars());
    update();
    const interval = setInterval(update, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flow-app-root" style={vars}>
      {children}
    </div>
  );
}
