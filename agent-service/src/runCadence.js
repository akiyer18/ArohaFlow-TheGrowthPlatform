#!/usr/bin/env node
/**
 * One-shot cadence runner: morning | evening.
 * Process layout: separate from Vite client; share Agent Service facade with MCP.
 *
 * Usage: node agent-service/src/runCadence.js morning|evening
 */
import { loadAgentEnv } from './loadEnv.js';
import { createScheduler } from './scheduler.js';
import { createLocalAgent } from './createLocalAgent.js';

loadAgentEnv();

const mode = process.argv[2];
if (mode !== 'morning' && mode !== 'evening') {
  console.error('Usage: node agent-service/src/runCadence.js morning|evening');
  process.exit(1);
}

const { agent, googleKind } = createLocalAgent();
const scheduler = createScheduler({ agent });
const result = mode === 'morning' ? await scheduler.runMorning() : await scheduler.runEvening();
console.error(`[agent] google ports: ${googleKind}`);
console.log(JSON.stringify(result, null, 2));
