#!/usr/bin/env node
/**
 * Long-running Agent Service process: wall-clock morning + ~17:30 cadence.
 * Separate from the Vite client. MCP is a second process wrapping the same facade.
 *
 * Usage: npm run agent:start
 */
import { loadAgentEnv } from './loadEnv.js';
import { createLocalAgent } from './createLocalAgent.js';
import { createScheduler } from './scheduler.js';
import { createSchedulerLoop } from './schedulerLoop.js';

loadAgentEnv();

const { agent, clock, store, googleKind } = createLocalAgent();
const scheduler = createScheduler({ agent });
const loop = createSchedulerLoop({
  scheduler,
  clock,
  onRun(kind, result) {
    console.error(`[agent] ${kind} cadence`, JSON.stringify(result));
  },
});

console.error(`ArohaFlow Agent Service started (google=${googleKind}; morning + ~17:30 UTC windows)`);
console.error(`Store ready; today=${clock.todayDateKey()}; activity=${(await store.listAgentActivity()).length}`);

await loop.start({ intervalMs: 60_000 });
