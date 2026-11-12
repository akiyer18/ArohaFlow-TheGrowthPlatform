/**
 * Wall-clock cadence loop: morning window and ~17:30 evening window, once each per date.
 * Inject clock for tests; production uses a real Date clock.
 *
 * @param {{
 *   scheduler: { runMorning(): Promise<object>, runEvening(): Promise<object> },
 *   clock: { now(): Date, todayDateKey(): string },
 *   sleep?: (ms: number) => Promise<void>,
 *   onRun?: (kind: 'morning' | 'evening', result: object) => void,
 * }} deps
 */
export function createSchedulerLoop(deps) {
  const {
    scheduler,
    clock,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onRun,
  } = deps;

  /** @type {{ morning: string | null, evening: string | null }} */
  const lastRunDate = { morning: null, evening: null };
  let stopped = false;

  const MORNING_START_MIN = 5 * 60;
  const MORNING_END_MIN = 12 * 60;
  const EVENING_START_MIN = 17 * 60 + 30;
  const EVENING_END_MIN = 21 * 60;

  return {
    stop() {
      stopped = true;
    },

    /**
     * Poll until stop(). Default interval 60s.
     * @param {{ intervalMs?: number, maxTicks?: number }} [options]
     */
    async start(options = {}) {
      const intervalMs = options.intervalMs ?? 60_000;
      let ticks = 0;
      while (!stopped) {
        await this.tick();
        ticks += 1;
        if (options.maxTicks != null && ticks >= options.maxTicks) break;
        if (stopped) break;
        await sleep(intervalMs);
      }
    },

    async tick() {
      const now = clock.now();
      const dateKey = clock.todayDateKey();
      const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();

      if (
        minutes >= MORNING_START_MIN &&
        minutes < MORNING_END_MIN &&
        lastRunDate.morning !== dateKey
      ) {
        const result = await scheduler.runMorning();
        lastRunDate.morning = dateKey;
        onRun?.('morning', result);
      }

      if (
        minutes >= EVENING_START_MIN &&
        minutes < EVENING_END_MIN &&
        lastRunDate.evening !== dateKey
      ) {
        const result = await scheduler.runEvening();
        lastRunDate.evening = dateKey;
        onRun?.('evening', result);
      }
    },
  };
}
