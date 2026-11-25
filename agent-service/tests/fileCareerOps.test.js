import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import {
  createFileCareerOps,
  resolveCareerOpsRoot,
} from '../src/adapters/fileCareerOps.js';

const PIPELINE = `# Pipeline — Pending URLs

## Pending

- [ ] https://jobs.ashbyhq.com/n8n/abc | n8n | Forward Deployed Engineer - EMEA | Netherlands · Germany | posted: 2026-11-16 | yrs: none stated
- [ ] https://job-boards.greenhouse.io/celonis/jobs/1 | Celonis | Lead Forward Deployed Engineer | Munich, Germany | posted: 2026-11-11 | yrs: 6+
- [ ] https://jobs.example.com/expired | OldCo | Closed Role | Remote | posted: 2026-01-01 | yrs: none stated

## Processed
`;

const PROFILE = `
candidate:
  location: "Amsterdam, Netherlands"
  years_of_experience: 2
target_roles:
  primary:
    - "Junior AI Engineer"
    - "Forward Deployed AI Engineer"
`;

const CV = `# CV

## Skills
Python, LangGraph, LLM agents, evaluation, RAG
`;

describe('file career-ops Discovery adapter (#46)', () => {
  /** @type {string} */
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'aroha-career-ops-'));
    fs.mkdirSync(path.join(root, 'data'));
    fs.mkdirSync(path.join(root, 'config'));
    fs.writeFileSync(path.join(root, 'data', 'pipeline.md'), PIPELINE);
    fs.writeFileSync(path.join(root, 'config', 'profile.yml'), PROFILE);
    fs.writeFileSync(path.join(root, 'cv.md'), CV);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('resolveCareerOpsRoot prefers CAREER_OPS_ROOT', () => {
    expect(resolveCareerOpsRoot({ CAREER_OPS_ROOT: root }, process.cwd())).toBe(
      path.resolve(root),
    );
  });

  it('reads pipeline Pending rows into Discovery listings with live links', async () => {
    const clock = createFixedClock(new Date('2026-11-20T12:00:00.000Z'));
    const careerOps = createFileCareerOps({ root, clock });
    const agent = createAgentService({
      clock,
      store: createMemoryStore(),
      careerOps,
    });

    const result = await agent.runDiscoverySearch({});
    expect(result.results.length).toBeGreaterThanOrEqual(2);

    const n8n = result.results.find((r) => r.company === 'n8n');
    expect(n8n).toMatchObject({
      roleTitle: 'Forward Deployed Engineer - EMEA',
      link: 'https://jobs.ashbyhq.com/n8n/abc',
      postedAt: '2026-11-16',
      liveness: 'uncertain',
    });
    expect(n8n.link).not.toContain('.example');
    expect(n8n.score).toBeGreaterThan(
      result.results.find((r) => r.company === 'Celonis').score,
    );
  });

  it('refreshDiscovery scans boards, appends new rows, and records liveness', async () => {
    fs.writeFileSync(
      path.join(root, 'scan.json'),
      JSON.stringify({
        titles: { include: ['Forward Deployed', 'AI Engineer'], exclude: [] },
        locations: { include: ['Germany', 'Netherlands'] },
        companies: [{ name: 'n8n', ats: 'ashby', slug: 'n8n' }],
      }),
    );
    const fetchJson = async (url) => {
      expect(url).toBe('https://api.ashbyhq.com/posting-api/job-board/n8n');
      return {
        jobs: [
          {
            id: 'abc',
            title: 'Forward Deployed Engineer - EMEA',
            jobUrl: 'https://jobs.ashbyhq.com/n8n/abc',
            location: 'Netherlands',
            publishedAt: '2026-11-16T00:00:00Z',
          },
          {
            id: 'new-1',
            title: 'AI Engineer',
            jobUrl: 'https://jobs.ashbyhq.com/n8n/new-1',
            location: 'Berlin, Germany',
            publishedAt: '2026-11-19T00:00:00Z',
          },
        ],
      };
    };
    const clock = createFixedClock(new Date('2026-11-20T12:00:00.000Z'));
    const careerOps = createFileCareerOps({ root, clock, fetchJson });
    const agent = createAgentService({ clock, store: createMemoryStore(), careerOps });

    const summary = await agent.refreshDiscovery();
    expect(summary).toMatchObject({ companiesRead: 1, added: 1, failed: [] });

    const { results } = await agent.runDiscoverySearch({ includeExpired: true });
    const byLink = Object.fromEntries(results.map((r) => [r.link, r.liveness]));
    expect(byLink['https://jobs.ashbyhq.com/n8n/abc']).toBe('open');
    expect(byLink['https://jobs.ashbyhq.com/n8n/new-1']).toBe('open');
    expect(byLink['https://job-boards.greenhouse.io/celonis/jobs/1']).toBe('uncertain');
  });

  it('suggestCv returns guidance grounded in cv.md skills for a listing', async () => {
    const clock = createFixedClock(new Date('2026-11-20T12:00:00.000Z'));
    const careerOps = createFileCareerOps({ root, clock });
    const agent = createAgentService({
      clock,
      store: createMemoryStore(),
      careerOps,
    });

    const search = await agent.runDiscoverySearch({});
    const listingId = search.results[0].id;
    const tips = await agent.getDiscoveryCvSuggestions({ listingId });

    expect(tips.listingId).toBe(listingId);
    expect(tips.sections.length + tips.keywords.length).toBeGreaterThan(0);
  });
});
