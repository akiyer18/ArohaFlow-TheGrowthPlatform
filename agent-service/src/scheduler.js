/**
 * Process-side cadence adapter — delegates to Agent Service facade methods.
 * Kept so the wall-clock loop / CLI share one call site without Store access.
 *
 * @param {{ agent: { runMorningCadence(): Promise<object>, runEveningCadence(): Promise<object> } }} deps
 */
export function createScheduler(deps) {
  const { agent } = deps;

  return {
    runMorning() {
      return agent.runMorningCadence();
    },
    runEvening() {
      return agent.runEveningCadence();
    },
  };
}
