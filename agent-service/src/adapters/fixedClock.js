/**
 * @param {Date} instant
 */
export function createFixedClock(instant) {
  const fixed = new Date(instant);
  return {
    now() {
      return new Date(fixed);
    },
    /** @returns {string} YYYY-MM-DD in UTC */
    todayDateKey() {
      return fixed.toISOString().slice(0, 10);
    },
  };
}
