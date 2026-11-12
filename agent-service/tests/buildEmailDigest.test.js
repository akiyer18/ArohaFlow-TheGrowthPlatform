import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeGmail } from '../src/adapters/fakeGmail.js';
import { createFakeLlm } from '../src/adapters/fakeLlm.js';

describe('build_email_digest', () => {
  it('keeps allowlisted senders, drops newsletter noise, ranks via LLM, and is idempotent', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.setSenderAllowlist([{ type: 'email', value: 'tutor@uni.ac.uk' }]);

    const gmail = createFakeGmail([
      {
        id: 'm1',
        from: 'tutor@uni.ac.uk',
        subject: 'Seminar tomorrow',
        snippet: 'Please bring your notes',
        listUnsubscribe: false,
      },
      {
        id: 'm2',
        from: 'deals@newsletter.com',
        subject: '50% off',
        snippet: 'Unsubscribe anytime',
        listUnsubscribe: true,
      },
      {
        id: 'm3',
        from: 'unknown@example.com',
        subject: 'Quick question',
        snippet: 'Can we talk?',
        listUnsubscribe: false,
      },
    ]);

    const llm = createFakeLlm({
      rank(candidates) {
        return candidates
          .filter((c) => c.id === 'm3')
          .map((c) => ({ messageId: c.id, score: 0.9, reason: 'personal ask' }));
      },
    });

    const agent = createAgentService({ clock, store, gmail, llm });

    const first = await agent.buildEmailDigest();
    const second = await agent.buildEmailDigest();

    expect(first.map((i) => i.messageId).sort()).toEqual(['m1', 'm3']);
    expect(first.find((i) => i.messageId === 'm1').reason).toMatch(/allowlist/i);
    expect(first.find((i) => i.messageId === 'm3').reason).toBe('personal ask');
    expect(second).toHaveLength(2);

    const today = await agent.listToday();
    expect(today.emailDigest).toHaveLength(2);
  });
});
