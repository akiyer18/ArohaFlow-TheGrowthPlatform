import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeCareerOps } from '../src/adapters/fakeCareerOps.js';

const LISTINGS = [
  {
    id: 'job-open-fresh',
    company: 'Acme',
    roleTitle: 'AI Engineer',
    link: 'https://jobs.acme.example/ai',
    description: 'Build evaluation pipelines for LLM products.',
    score: 4.4,
    postedAt: '2026-11-12',
    discoveredAt: '2026-11-14',
    liveness: 'open',
  },
  {
    id: 'job-expired',
    company: 'OldCo',
    roleTitle: 'ML Intern',
    link: 'https://jobs.oldco.example/ml',
    description: 'Closed posting.',
    score: 3.9,
    postedAt: '2026-09-01',
    discoveredAt: '2026-11-14',
    liveness: 'expired',
  },
  {
    id: 'job-uncertain',
    company: 'MaybeCo',
    roleTitle: 'Data Scientist',
    link: 'https://jobs.maybeco.example/ds',
    description: 'Liveness uncertain.',
    score: 4.0,
    postedAt: null,
    discoveredAt: '2026-11-13',
    liveness: 'uncertain',
  },
];

function createAgent(careerOpsOverrides = {}) {
  const clock = createFixedClock(new Date('2026-11-14T12:00:00.000Z'));
  const store = createMemoryStore();
  const careerOps = createFakeCareerOps({
    listings: LISTINGS,
    suggestions: {
      'job-open-fresh': {
        listingId: 'job-open-fresh',
        sections: [
          {
            section: 'experience',
            suggestion: 'Lead with evaluation-harness ownership in the ArohaFlow bullet.',
          },
        ],
        keywords: [
          {
            keyword: 'evaluation',
            experienceHint: 'Highlight offline eval / scoring language in recent roles.',
          },
        ],
      },
    },
    ...careerOpsOverrides,
  });
  const agent = createAgentService({ clock, store, careerOps });
  return { agent, store, careerOps, clock };
}

describe('Application Discovery (#46)', () => {
  it('runDiscoverySearch returns open listings with score and recency, filtering expired by default', async () => {
    const { agent } = createAgent();

    const result = await agent.runDiscoverySearch({});

    expect(result.searchedAt).toBe('2026-11-14T12:00:00.000Z');
    expect(result.results.map((r) => r.id)).toEqual(['job-open-fresh', 'job-uncertain']);
    expect(result.results[0]).toMatchObject({
      company: 'Acme',
      roleTitle: 'AI Engineer',
      score: 4.4,
      postedAt: '2026-11-12',
      discoveredAt: '2026-11-14',
      liveness: 'open',
      alreadyInTracker: false,
      recencyDate: '2026-11-12',
    });
    expect(result.results.find((r) => r.id === 'job-uncertain').recencyDate).toBe('2026-11-13');
  });

  it('runDiscoverySearch can include expired when asked', async () => {
    const { agent } = createAgent();
    const result = await agent.runDiscoverySearch({ includeExpired: true });
    expect(result.results.map((r) => r.id)).toContain('job-expired');
  });

  it('marks Discovery hits already present in the Applications tracker', async () => {
    const { agent } = createAgent();
    await agent.addApplication({
      company: 'Acme',
      role: 'AI Engineer',
      url: 'https://jobs.acme.example/ai',
      stage: 'applied',
    });

    const result = await agent.runDiscoverySearch({});
    const hit = result.results.find((r) => r.id === 'job-open-fresh');
    expect(hit.alreadyInTracker).toBe(true);
  });

  it('getDiscoveryCvSuggestions returns section and keyword guidance for a listing', async () => {
    const { agent } = createAgent();
    const tips = await agent.getDiscoveryCvSuggestions({ listingId: 'job-open-fresh' });

    expect(tips.listingId).toBe('job-open-fresh');
    expect(tips.sections[0].section).toBe('experience');
    expect(tips.keywords[0].keyword).toBe('evaluation');
  });

  it('promoteDiscoveryToApplication saves a hit on the Applications board and is idempotent by link', async () => {
    const { agent } = createAgent();

    const first = await agent.promoteDiscoveryToApplication({ listingId: 'job-open-fresh' });
    expect(first).toMatchObject({
      company: 'Acme',
      role: 'AI Engineer',
      url: 'https://jobs.acme.example/ai',
      stage: 'saved',
      source: 'Discovery',
    });

    const second = await agent.promoteDiscoveryToApplication({ listingId: 'job-open-fresh' });
    expect(second.id).toBe(first.id);

    const listed = await agent.listApplications();
    expect(listed.applications).toHaveLength(1);
    expect(listed.applications[0].url).toBe('https://jobs.acme.example/ai');
  });
});
