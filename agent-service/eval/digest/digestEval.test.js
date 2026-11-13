import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runDigestEval, scoreDigestEval } from './runDigestEval.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures/labelled-emails.v1.json'), 'utf8'));

describe('Email Digest eval harness', () => {
  it('scores perfect predictions as precision/recall 1', () => {
    const digest = [
      { messageId: 'a' },
      { messageId: 'b' },
    ];
    const labelled = [
      { id: 'a', expected: 'include' },
      { id: 'b', expected: 'include' },
      { id: 'c', expected: 'exclude' },
    ];
    const scored = scoreDigestEval(digest, labelled);
    expect(scored.metrics).toEqual({ precision: 1, recall: 1, f1: 1, rankOrderCorrect: null });
    expect(scored.misses.falsePositives).toEqual([]);
    expect(scored.misses.falseNegatives).toEqual([]);
  });

  it('runs labelled-emails.v1 through the digest pipeline with fixed LLM ranks', async () => {
    const result = await runDigestEval(fixture);
    expect(result.metrics.precision).toBe(1);
    expect(result.metrics.recall).toBe(1);
    expect(result.metrics.f1).toBe(1);
    expect(result.metrics.rankOrderCorrect).toBe(true);
    expect(result.misses.falsePositives).toEqual([]);
    expect(result.misses.falseNegatives).toEqual([]);
    expect(result.digest.map((d) => d.messageId)).toEqual(['allow-1', 'allow-2', 'llm-keep-1']);
  });
});
