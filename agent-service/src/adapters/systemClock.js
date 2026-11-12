/** Wall-clock port for production scheduler / MCP processes. */
export function createSystemClock() {
  return {
    now() {
      return new Date();
    },
    todayDateKey() {
      return new Date().toISOString().slice(0, 10);
    },
  };
}
