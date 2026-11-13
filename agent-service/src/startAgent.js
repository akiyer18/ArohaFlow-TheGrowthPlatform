#!/usr/bin/env node
/**
 * Long-running Agent Service process: wall-clock morning + ~17:30 cadence.
 * Separate from the Vite client. MCP is a second process wrapping the same facade.
 * Also serves a localhost-only HTTP bridge for the OS UI (#13).
 *
 * Usage: npm run agent:start
 */
import { loadAgentEnv } from './loadEnv.js';
import { createLocalAgent } from './createLocalAgent.js';
import { createScheduler } from './scheduler.js';
import { createSchedulerLoop } from './schedulerLoop.js';
import { createAgentHttpServer } from './http/createAgentHttpServer.js';

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

const httpPort = Number(process.env.AROHAFLOW_AGENT_HTTP_PORT || 8787);
const httpHost = process.env.AROHAFLOW_AGENT_HTTP_HOST || '127.0.0.1';
const { port: boundPort } = await createAgentHttpServer({
  agent,
  host: httpHost,
  port: httpPort,
  corsOrigin: process.env.AROHAFLOW_AGENT_HTTP_CORS || 'http://localhost:5173',
});

console.error(`ArohaFlow Agent Service started (google=${googleKind}; morning + ~17:30 UTC windows)`);
console.error(`Store ready; today=${clock.todayDateKey()}; activity=${(await store.listAgentActivity()).length}`);
console.error(`HTTP bridge listening on http://${httpHost}:${boundPort} (loopback only)`);

await loop.start({ intervalMs: 60_000 });
