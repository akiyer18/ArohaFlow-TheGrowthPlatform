/**
 * Email Digest eval — labelled set → include/exclude metrics.
 * Not part of the default unit suite (spec Testing Decisions).
 */

/**
 * @typedef {{ id: string, from: string, subject: string, snippet: string, listUnsubscribe?: boolean, expected: 'include' | 'exclude' }} LabelledEmail
 * @typedef {{ allowlist?: object[], emails: LabelledEmail[], llmRank?: Array<{ messageId: string, score: number, reason: string }> }} LabelledSet
 */

/**
 * Compare digest output to ground-truth labels.
 * @param {Array<{ messageId: string }>} digestItems
 * @param {LabelledEmail[]} labelledEmails
 */
export function scoreDigestEval(digestItems, labelledEmails) {
  const predictedInclude = new Set(digestItems.map((i) => i.messageId));
  const expectedInclude = labelledEmails.filter((e) => e.expected === 'include').map((e) => e.id);
  const expectedExclude = labelledEmails.filter((e) => e.expected === 'exclude').map((e) => e.id);

  let truePositive = 0;
  let falseNegative = 0;
  for (const id of expectedInclude) {
    if (predictedInclude.has(id)) truePositive += 1;
    else falseNegative += 1;
  }

  let falsePositive = 0;
  let trueNegative = 0;
  for (const id of expectedExclude) {
    if (predictedInclude.has(id)) falsePositive += 1;
    else trueNegative += 1;
  }

  const precision = truePositive + falsePositive === 0 ? 1 : truePositive / (truePositive + falsePositive);
  const recall = truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const withRank = labelledEmails
    .filter((e) => e.expected === 'include' && e.expectedRank != null)
    .sort((a, b) => a.expectedRank - b.expectedRank);
  const digestOrder = digestItems.map((i) => i.messageId);
  const predictedRankOrder = withRank.map((e) => e.id).filter((id) => predictedInclude.has(id));
  const expectedRankOrder = withRank.map((e) => e.id);
  const rankOrderCorrect =
    withRank.length === 0
      ? null
      : predictedRankOrder.length === expectedRankOrder.length &&
        predictedRankOrder.every((id, idx) => id === expectedRankOrder[idx]);

  return {
    counts: {
      labelled: labelledEmails.length,
      expectedInclude: expectedInclude.length,
      expectedExclude: expectedExclude.length,
      predictedInclude: predictedInclude.size,
      truePositive,
      falsePositive,
      trueNegative,
      falseNegative,
      rankedLabels: withRank.length,
    },
    metrics: {
      precision: round4(precision),
      recall: round4(recall),
      f1: round4(f1),
      rankOrderCorrect,
    },
    misses: {
      falsePositives: expectedExclude.filter((id) => predictedInclude.has(id)),
      falseNegatives: expectedInclude.filter((id) => !predictedInclude.has(id)),
      rankOrder: rankOrderCorrect === false ? { expected: expectedRankOrder, predicted: digestOrder } : [],
    },
  };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Run Email Digest against a labelled set using injected ports (deterministic in CI).
 * @param {LabelledSet} labelledSet
 * @param {{ buildDigest: (deps: object) => Promise<object[]> }} options
 */
export async function runDigestEval(labelledSet, options) {
  const { createMemoryStore } = await import('../../src/adapters/memoryStore.js');
  const { createFakeGmail } = await import('../../src/adapters/fakeGmail.js');
  const { createFakeLlm } = await import('../../src/adapters/fakeLlm.js');
  const { createFixedClock } = await import('../../src/adapters/fixedClock.js');
  const { buildEmailDigest } = await import('../../src/tools/buildEmailDigest.js');

  const store = createMemoryStore();
  await store.setSenderAllowlist(labelledSet.allowlist ?? []);
  const gmail = createFakeGmail(
    labelledSet.emails.map(({ id, from, subject, snippet, listUnsubscribe }) => ({
      id,
      from,
      subject,
      snippet,
      listUnsubscribe: Boolean(listUnsubscribe),
    })),
  );
  const llmRank = labelledSet.llmRank ?? [];
  const llm = createFakeLlm({
    rank(candidates) {
      const allowed = new Set(candidates.map((c) => c.id));
      return llmRank.filter((r) => allowed.has(r.messageId));
    },
  });
  const clock = createFixedClock(new Date('2026-11-13T09:00:00.000Z'));
  const buildDigest = options?.buildDigest ?? buildEmailDigest;

  const digest = await buildDigest({ store, gmail, llm, clock });
  const scored = scoreDigestEval(digest, labelledSet.emails);

  return {
    fixture: labelledSet.name ?? 'unnamed',
    digest,
    ...scored,
  };
}
