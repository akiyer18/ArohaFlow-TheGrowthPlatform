function isNoise(message) {
  if (message.listUnsubscribe) return true;
  const from = (message.from || '').toLowerCase();
  if (from.includes('noreply') || from.includes('no-reply')) return true;
  return false;
}

function allowlistMatch(message, allowlist) {
  const from = (message.from || '').toLowerCase();
  for (const entry of allowlist) {
    const value = (entry.value || '').toLowerCase();
    if (entry.type === 'email' && from.includes(value)) return true;
    if (entry.type === 'domain') {
      const domain = from.split('@')[1] || '';
      if (domain === value || domain.endsWith(`.${value}`)) return true;
    }
  }
  return false;
}

/**
 * @param {{ store: object, gmail: object, llm: object, clock: { todayDateKey(): string } }} deps
 */
export async function buildEmailDigest(deps) {
  const { store, gmail, llm, clock } = deps;
  const dateKey = clock.todayDateKey();
  const allowlist = await store.listSenderAllowlist();
  const summaries = await gmail.listMessageSummaries();

  const digest = [];
  const candidatesForLlm = [];

  for (const message of summaries) {
    if (allowlistMatch(message, allowlist)) {
      digest.push({
        messageId: message.id,
        from: message.from,
        subject: message.subject,
        snippet: message.snippet,
        reason: 'Sender Allowlist',
      });
      continue;
    }
    if (isNoise(message)) continue;
    candidatesForLlm.push(message);
  }

  if (candidatesForLlm.length && llm) {
    const ranked = await llm.rankEmailCandidates(candidatesForLlm);
    for (const hit of ranked) {
      const message = candidatesForLlm.find((c) => c.id === hit.messageId);
      if (!message) continue;
      digest.push({
        messageId: message.id,
        from: message.from,
        subject: message.subject,
        snippet: message.snippet,
        reason: hit.reason,
        score: hit.score,
      });
    }
  }

  for (const item of digest) {
    await store.upsertEmailDigestItem(dateKey, item);
  }

  await store.appendAgentActivity({
    type: 'build_email_digest',
    summary: `Email Digest: ${digest.length} Important Email(s)`,
    at: clock.now().toISOString(),
  });

  return store.getEmailDigest(dateKey);
}
