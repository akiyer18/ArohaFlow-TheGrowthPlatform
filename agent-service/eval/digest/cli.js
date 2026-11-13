#!/usr/bin/env node
/**
 * Run Email Digest eval harness (separate from npm run agent:test).
 *
 * Usage: npm run agent:eval:digest
 * Optional: node agent-service/eval/digest/cli.js path/to/labelled.json
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDigestEval } from './runDigestEval.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = process.argv[2] ?? join(here, 'fixtures/labelled-emails.v1.json');
const labelledSet = JSON.parse(readFileSync(fixturePath, 'utf8'));

const result = await runDigestEval(labelledSet);

console.log(`Fixture: ${result.fixture} (${fixturePath})`);
console.log('Counts:', result.counts);
console.log('Metrics:', result.metrics);
const rankFailed = result.metrics.rankOrderCorrect === false;
if (result.misses.falsePositives.length || result.misses.falseNegatives.length || rankFailed) {
  console.log('Misses:', result.misses);
  process.exitCode = 1;
} else {
  console.log('All labels matched (include/exclude + rank order).');
}
