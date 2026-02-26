/**
 * Time-aware theme for Flow State OS.
 * Returns period and color tokens; use with CSS custom properties for smooth transitions.
 * 05:00–11:00 Morning | 11:00–17:00 Afternoon | 17:00–21:00 Evening | 21:00–05:00 Night
 */

export const TIME_PERIODS = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night',
};

export function getTimeTheme() {
  const hour = new Date().getHours();
  let period = TIME_PERIODS.AFTERNOON;
  if (hour >= 5 && hour < 11) period = TIME_PERIODS.MORNING;
  else if (hour >= 11 && hour < 17) period = TIME_PERIODS.AFTERNOON;
  else if (hour >= 17 && hour < 21) period = TIME_PERIODS.EVENING;
  else period = TIME_PERIODS.NIGHT;

  const themes = {
    [TIME_PERIODS.MORNING]: {
      period,
      // Cool blue ambient, slightly brighter
      flowBlob1: 'rgba(96, 165, 250, 0.08)',
      flowBlob2: 'rgba(147, 197, 253, 0.06)',
      flowBlob3: 'rgba(186, 230, 253, 0.05)',
      glowIntensity: 1.15,
    },
    [TIME_PERIODS.AFTERNOON]: {
      period,
      // Neutral balanced
      flowBlob1: 'rgba(148, 163, 184, 0.06)',
      flowBlob2: 'rgba(203, 213, 225, 0.05)',
      flowBlob3: 'rgba(226, 232, 240, 0.04)',
      glowIntensity: 1,
    },
    [TIME_PERIODS.EVENING]: {
      period,
      // Indigo and violet, warmer accents
      flowBlob1: 'rgba(99, 102, 241, 0.07)',
      flowBlob2: 'rgba(139, 92, 246, 0.06)',
      flowBlob3: 'rgba(167, 139, 250, 0.05)',
      glowIntensity: 1.05,
    },
    [TIME_PERIODS.NIGHT]: {
      period,
      // Darker cosmic, deeper contrast
      flowBlob1: 'rgba(30, 41, 59, 0.12)',
      flowBlob2: 'rgba(51, 65, 85, 0.08)',
      flowBlob3: 'rgba(71, 85, 105, 0.05)',
      glowIntensity: 0.92,
    },
  };

  return themes[period];
}

/** CSS custom properties object for inline style on root */
export function getTimeThemeVars(theme = getTimeTheme()) {
  return {
    '--flow-blob-1': theme.flowBlob1,
    '--flow-blob-2': theme.flowBlob2,
    '--flow-blob-3': theme.flowBlob3,
    '--flow-glow-intensity': theme.glowIntensity,
  };
}
