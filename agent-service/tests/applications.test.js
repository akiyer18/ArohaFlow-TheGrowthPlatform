import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';

describe('Applications CRM (#13)', () => {
  it('lists and upserts Applications with company, role, link, notes, status', async () => {
    const clock = createFixedClock(new Date('2026-11-13T12:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    expect(await agent.listApplications()).toEqual([]);

    const saved = await agent.upsertApplication({
      id: 'app-1',
      company: 'Acme',
      roleTitle: 'Frontend Engineer',
      link: 'https://jobs.acme.example/fe',
      notes: 'Referral from Sam',
      status: 'applied',
    });

    expect(saved).toEqual({
      id: 'app-1',
      company: 'Acme',
      roleTitle: 'Frontend Engineer',
      link: 'https://jobs.acme.example/fe',
      notes: 'Referral from Sam',
      status: 'applied',
    });

    expect(await agent.listApplications()).toEqual([saved]);

    await agent.upsertApplication({
      id: 'app-1',
      company: 'Acme',
      roleTitle: 'Frontend Engineer',
      link: 'https://jobs.acme.example/fe',
      notes: 'Phone screen booked',
      status: 'interviewing',
    });

    const listed = await agent.listApplications();
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe('interviewing');
    expect(listed[0].notes).toBe('Phone screen booked');
  });

  it('rejects invalid Application status', async () => {
    const clock = createFixedClock(new Date('2026-11-13T12:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    await expect(
      agent.upsertApplication({
        id: 'app-bad',
        company: 'X',
        roleTitle: 'Y',
        link: '',
        notes: '',
        status: 'next_step',
      }),
    ).rejects.toThrow(/status/i);
  });

  it('deletes an Application by id', async () => {
    const clock = createFixedClock(new Date('2026-11-13T12:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    await agent.upsertApplication({
      id: 'app-2',
      company: 'Beta',
      roleTitle: 'SWE',
      link: '',
      notes: '',
      status: 'to_apply',
    });
    await agent.deleteApplication({ id: 'app-2' });
    expect(await agent.listApplications()).toEqual([]);
  });

  it('exposes Goals and Sender Allowlist on the facade', async () => {
    const clock = createFixedClock(new Date('2026-11-13T12:00:00.000Z'));
    const store = createMemoryStore();
    const agent = createAgentService({ clock, store });

    await store.seedGoals([
      {
        id: 'g1',
        title: 'Land a job',
        actions: [],
      },
    ]);
    await store.setSenderAllowlist([{ type: 'email', value: 'tutor@uni.ac.uk' }]);

    expect(await agent.listGoals()).toEqual([
      { id: 'g1', title: 'Land a job', actions: [] },
    ]);
    expect(await agent.listSenderAllowlist()).toEqual([
      { type: 'email', value: 'tutor@uni.ac.uk' },
    ]);

    await agent.setSenderAllowlist([
      { type: 'email', value: 'tutor@uni.ac.uk' },
      { type: 'domain', value: 'recruiters.example' },
    ]);
    expect(await agent.listSenderAllowlist()).toHaveLength(2);
  });
});
