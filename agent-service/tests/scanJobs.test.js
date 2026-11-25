import { describe, it, expect } from 'vitest';
import {
  createJobFilter,
  insertPendingRows,
  keywordMatcher,
  pipelineLine,
  scanJobs,
} from '../src/discovery/scanJobs.js';
import { arbeitnowCountry, parseBoardLink } from '../src/discovery/jobSources.js';

const TODAY = '2026-11-25';

const CONFIG = {
  maxPostingAgeDays: 45,
  titles: {
    include: ['AI Engineer', 'Forward Deployed', 'ML'],
    exclude: ['Senior', 'word:Intern'],
  },
  locations: { include: ['Netherlands', 'Amsterdam', 'Germany'] },
  aggregators: { arbeitnow: { enabled: true }, adzuna: { enabled: true, countries: ['nl'], queries: ['AI engineer'] } },
  companies: [
    { name: 'Celonis', ats: 'greenhouse', slug: 'celonis' },
    { name: 'n8n', ats: 'ashby', slug: 'n8n' },
    { name: 'Spotify', ats: 'lever', slug: 'spotify' },
    { name: 'DownCo', ats: 'greenhouse', slug: 'downco' },
  ],
};

/** Recorded-shape responses, keyed by URL prefix. */
const RESPONSES = {
  'https://boards-api.greenhouse.io/v1/boards/celonis/jobs': {
    jobs: [
      {
        id: 111,
        title: 'Forward Deployed Engineer - CPG/Retail',
        absolute_url: 'https://job-boards.greenhouse.io/celonis/jobs/111?gh_jid=111',
        location: { name: 'Munich, Germany' },
        first_published: '2026-11-09T06:00:00-05:00',
      },
      {
        id: 112,
        title: 'Account Executive',
        absolute_url: 'https://job-boards.greenhouse.io/celonis/jobs/112?gh_jid=112',
        location: { name: 'Amsterdam, Netherlands' },
        first_published: '2026-11-20T06:00:00-05:00',
      },
    ],
  },
  'https://api.ashbyhq.com/posting-api/job-board/n8n': {
    jobs: [
      {
        id: 'a-1',
        title: 'AI Engineer | Remote',
        jobUrl: 'https://jobs.ashbyhq.com/n8n/a-1',
        location: 'Berlin, Germany',
        secondaryLocations: [{ location: 'Netherlands' }],
        publishedAt: '2026-11-16T10:00:00.000+00:00',
        isListed: true,
      },
      {
        id: 'a-2',
        title: 'Senior AI Engineer',
        jobUrl: 'https://jobs.ashbyhq.com/n8n/a-2',
        location: 'Berlin, Germany',
        publishedAt: '2026-11-16T10:00:00.000+00:00',
        isListed: true,
      },
      {
        id: 'a-3',
        title: 'AI Engineer, Platform',
        jobUrl: 'https://jobs.ashbyhq.com/n8n/a-3',
        location: 'Berlin, Germany',
        publishedAt: '2026-08-01T10:00:00.000+00:00',
        isListed: true,
      },
    ],
  },
  'https://api.lever.co/v0/postings/spotify?mode=json': [
    {
      id: 'l-1',
      text: 'ML Engineer',
      hostedUrl: 'https://jobs.lever.co/spotify/l-1',
      categories: { location: 'Stockholm', allLocations: ['Stockholm'] },
      createdAt: Date.parse('2026-11-20T00:00:00Z'),
    },
  ],
  'https://www.arbeitnow.com/api/job-board-api?page=1': {
    data: [
      {
        company_name: 'Berlin Labs',
        title: 'AI Engineer (m/w/d)',
        url: 'https://www.arbeitnow.com/jobs/berlin-labs/ai-engineer-1',
        location: 'Hamburg',
        remote: false,
        created_at: Math.floor(Date.parse('2026-11-22T00:00:00Z') / 1000),
      },
      {
        company_name: 'Celonis',
        title: 'Forward Deployed Engineer - CPG/Retail',
        url: 'https://www.arbeitnow.com/jobs/celonis/fde-dup',
        location: 'Munich',
        remote: false,
        created_at: Math.floor(Date.parse('2026-11-22T00:00:00Z') / 1000),
      },
    ],
    links: { next: null },
  },
};

function fakeFetchJson(calls = []) {
  return async (url) => {
    calls.push(url);
    if (url.includes('/downco/')) throw new Error('HTTP 404');
    if (url.startsWith('https://api.adzuna.com/')) {
      return {
        results: [
          {
            title: '<strong>AI Engineer</strong>',
            company: { display_name: 'Dutch Startup BV' },
            location: { display_name: 'Utrecht' },
            redirect_url: 'https://www.adzuna.nl/details/42',
            created: '2026-11-21T09:00:00Z',
          },
        ],
      };
    }
    if (!(url in RESPONSES)) throw new Error(`unexpected ${url}`);
    return structuredClone(RESPONSES[url]);
  };
}

const PIPELINE = `# Pipeline

## Pending

- [ ] https://job-boards.greenhouse.io/celonis/jobs/111?gh_jid=111 | Celonis | Forward Deployed Engineer - CPG/Retail | Munich, Germany | posted: 2026-11-09
- [ ] https://job-boards.greenhouse.io/celonis/jobs/999?gh_jid=999 | Celonis | Closed Role | Munich, Germany | posted: 2026-10-01
- [ ] https://jobs.ml6.eu/jobs/1-junior-ai-engineer | ML6 | Junior AI Engineer

## Processed
`;

describe('Discovery job scanner', () => {
  it('keyword syntax: plain substring, short words whole, word: anchored both sides', () => {
    expect(keywordMatcher('Forward Deployed')('Lead forward deployed engineer')).toBe(true);
    expect(keywordMatcher('ML')('ML Engineer')).toBe(true);
    expect(keywordMatcher('ML')('HTML Developer')).toBe(false);
    expect(keywordMatcher('word:Intern')('Operations Intern')).toBe(true);
    expect(keywordMatcher('word:Intern')('Internal Tools Engineer')).toBe(false);
    expect(keywordMatcher('stem:Crypto')('Cryptocurrency Analyst')).toBe(true);
  });

  it('filters by title, location and posting age', () => {
    const accept = createJobFilter(CONFIG, TODAY);
    const job = { title: 'AI Engineer', link: 'https://x', locations: ['Amsterdam'], postedAt: '2026-11-20' };
    expect(accept(job)).toBeNull();
    expect(accept({ ...job, title: 'Senior AI Engineer' })).toBe('title');
    expect(accept({ ...job, title: 'Account Executive' })).toBe('title');
    expect(accept({ ...job, locations: ['Stockholm'] })).toBe('location');
    expect(accept({ ...job, postedAt: '2026-09-01' })).toBe('age');
    expect(accept({ ...job, locations: [], postedAt: null })).toBeNull();
  });

  it('adds new matching jobs once, across boards and aggregators', async () => {
    const result = await scanJobs({
      config: CONFIG,
      fetchJson: fakeFetchJson(),
      today: TODAY,
      pipelineText: PIPELINE,
      adzunaKeys: { appId: 'id', appKey: 'key' },
    });

    expect(result.added.map((j) => `${j.source}:${j.company}:${j.title}`)).toEqual([
      'ashby:n8n:AI Engineer | Remote',
      'arbeitnow:Berlin Labs:AI Engineer (m/w/d)',
      'adzuna:Dutch Startup BV:AI Engineer',
    ]);
    expect(result.summary.filtered).toMatchObject({ title: 2, location: 1, age: 1, duplicate: 2 });
    expect(result.summary.companiesRead).toBe(3);
    expect(result.summary.failed).toEqual(['DownCo (HTTP 404)']);
  });

  it('judges liveness conservatively: expired only when the board was read and the job is gone', async () => {
    const result = await scanJobs({
      config: CONFIG,
      fetchJson: fakeFetchJson(),
      today: TODAY,
      pipelineText: PIPELINE,
      adzunaKeys: {},
    });

    expect(result.liveness['https://job-boards.greenhouse.io/celonis/jobs/111?gh_jid=111']).toBe('open');
    expect(result.liveness['https://job-boards.greenhouse.io/celonis/jobs/999?gh_jid=999']).toBe('expired');
    expect(result.liveness['https://jobs.ml6.eu/jobs/1-junior-ai-engineer']).toBe('uncertain');
    expect(result.liveness['https://jobs.ashbyhq.com/n8n/a-1']).toBe('open');
    expect(result.liveness['https://www.arbeitnow.com/jobs/berlin-labs/ai-engineer-1']).toBe('uncertain');
    expect(result.summary.skipped[0]).toMatch(/^Adzuna/);
  });

  it('writes pipeline rows the Discovery reader can parse, before ## Processed', () => {
    const line = pipelineLine({
      link: 'https://jobs.ashbyhq.com/n8n/a-1',
      company: 'n8n',
      title: 'AI Engineer | Remote',
      locations: ['Berlin, Germany', 'Netherlands'],
      postedAt: '2026-11-16',
      source: 'ashby',
    });
    expect(line).toBe(
      '- [ ] https://jobs.ashbyhq.com/n8n/a-1 | n8n | AI Engineer / Remote | Berlin, Germany · Netherlands | posted: 2026-11-16 | via: ashby',
    );
    const out = insertPendingRows(PIPELINE, [line]);
    expect(out.indexOf(line)).toBeLessThan(out.indexOf('## Processed'));
    expect(out.indexOf(line)).toBeGreaterThan(out.indexOf('ML6'));
  });

  it('reads the Arbeitnow country from the site domain', () => {
    expect(arbeitnowCountry('https://www.arbeitnow.com/jobs/companies/x/y')).toBe('Germany');
    expect(arbeitnowCountry('https://www.arbeitnow.nl/jobs/companies/x/y')).toBe('Netherlands');
    expect(arbeitnowCountry('https://www.arbeitnow.co.uk/jobs/companies/x/y')).toBe('United Kingdom');
    expect(arbeitnowCountry('https://example.com/x')).toBeNull();
  });

  it('maps posting URLs back to their company board', () => {
    expect(parseBoardLink('https://job-boards.greenhouse.io/celonis/jobs/111?gh_jid=111')).toEqual({
      boardKey: 'greenhouse:celonis',
      jobId: '111',
    });
    expect(parseBoardLink('https://jobs.ashbyhq.com/ElevenLabs/b8a1')).toEqual({
      boardKey: 'ashby:elevenlabs',
      jobId: 'b8a1',
    });
    expect(parseBoardLink('https://jobs.eu.lever.co/diabolocom/x-1')).toEqual({
      boardKey: 'lever:diabolocom',
      jobId: 'x-1',
    });
    expect(parseBoardLink('https://jobs.ml6.eu/jobs/1')).toBeNull();
  });
});
