import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJsonLlm, LlmError } from '../src/adapters/openAiCompatibleLlm.js';
import { gateVerdict } from '../src/startups/judge.js';
import { detectAtsBoard, extractRoleEmails, htmlToText, readCompanySite, robotsAllows } from '../src/startups/site.js';
import {
  createFileStartupsRepo, createStartups, domainMatchesName, listStartups, runStartupSearch, setStartupStatus,
} from '../src/startups/findStartups.js';
import { createSupabaseStartupsRepo } from '../src/startups/supabaseStartups.js';
import { createJsonLlmFromEnv } from '../src/adapters/openAiCompatibleLlm.js';
import { createFakeSupabaseClient } from '../src/adapters/fakeSupabaseClient.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';

const html = (body) => `<!doctype html><html><head><title>x</title><script>var a="no@acme.ai"</script></head><body>${body}</body></html>`;

/* ---------- Fakes ---------- */

const SITES = {
  'https://acme.ai/robots.txt': { text: 'User-agent: *\nDisallow: /admin\n', html: false },
  'https://acme.ai/': {
    html: true,
    text: html(`<h1>Acme AI builds LLM agents for Dutch insurers</h1><p>Amsterdam</p>
      <a href="/about">About us</a><a href="https://jobs.ashbyhq.com/acme">Careers</a>
      <a href="mailto:jobs@acme.ai">Apply</a> <p>Jane: jane.doe@acme.ai · press: hello@gmail.com</p>`),
  },
  'https://acme.ai/about': { html: true, text: html('<p>We are 14 people in Amsterdam. Write to hello@acme.ai.</p>') },
  'https://betalabs.nl/robots.txt': { text: 'User-agent: *\nDisallow: /\n', html: false },
  'https://gamma.nl/robots.txt': { ok: false, status: 404, text: '', html: false },
  'https://gamma.nl/': { html: true, text: html('<h1>Gamma Corp: office furniture, now with AI-powered quotes</h1>') },
};

function fakeHttp(calls) {
  return {
    async getJson(url) {
      calls.push(`GET ${url}`);
      return [
        { name: 'Acme AI', website: 'https://acme.ai', status: 'Active', all_locations: 'Amsterdam, NH, Netherlands', one_liner: 'LLM agents', slug: 'acme', batch: 'W26', isHiring: true },
        { name: 'Old NL Co', website: 'https://old.nl', status: 'Inactive', all_locations: 'Utrecht, Netherlands' },
        { name: 'SF Co', website: 'https://sf.example', status: 'Active', all_locations: 'San Francisco, CA, USA' },
      ];
    },
    async postJson(url, body) {
      calls.push(`POST ${body.query}`);
      if (body.query.includes('official website')) {
        if (body.query.startsWith('Beta Labs')) {
          return {
            results: [
              { url: 'https://www.linkedin.com/company/beta-labs', title: 'Beta Labs | LinkedIn' },
              { url: 'https://betalabs.nl/en', title: 'Beta Labs' },
            ],
          };
        }
        return { results: [{ url: 'https://www.crunchbase.com/organization/investor-x', title: 'Investor X' }] };
      }
      return { results: [{ url: 'https://news.example/nl-ai', title: 'Dutch AI startups', raw_content: 'Beta Labs, Gamma Corp, Investor X…' }] };
    },
    async getText(url) {
      calls.push(`FETCH ${url}`);
      const page = SITES[url];
      if (!page) return { ok: false, status: 404, url, text: '', html: false };
      return { ok: page.ok ?? true, status: page.status ?? 200, url, text: page.text, html: page.html };
    },
  };
}

const VERDICTS = {
  'Acme AI': {
    isOperatingCompany: true, netherlands: 'headquarters', aiIsCore: true, kind: 'ai-product', size: '11-50',
    city: 'Amsterdam', whatTheyDo: 'LLM agents for insurers', fit: 5, reason: 'Small Amsterdam AI team with a careers page.',
    hiringSignals: ['Careers page on Ashby'],
  },
  'Gamma Corp': {
    isOperatingCompany: true, netherlands: 'headquarters', aiIsCore: false, kind: 'other', size: '51-200',
    city: 'Rotterdam', whatTheyDo: 'Office furniture', fit: 1, reason: 'AI is a feature of quoting.', hiringSignals: [],
  },
};

function fakeLlm(calls) {
  return {
    async json({ name, user }) {
      calls.push(name);
      if (name === 'candidates') {
        return {
          companies: [
            { name: 'Beta Labs', website: '', city: 'Delft', oneLiner: 'Vision AI' },
            { name: 'Gamma Corp', website: 'gamma.nl', city: '', oneLiner: '' },
            { name: 'Investor X', website: '', city: '', oneLiner: 'Fund' },
          ],
        };
      }
      const company = user.match(/^Company: (.+)$/m)[1];
      return VERDICTS[company];
    },
  };
}

/* ---------- Units ---------- */

describe('Startups: site reading', () => {
  it('robots.txt: longest match wins, empty Disallow allows', () => {
    expect(robotsAllows('User-agent: *\nDisallow: /', '/')).toBe(false);
    expect(robotsAllows('User-agent: *\nDisallow: /admin', '/')).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow: /\nAllow: /careers', '/careers')).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow:', '/')).toBe(true);
    expect(robotsAllows('User-agent: arohaflow\nDisallow: /\n\nUser-agent: *\nDisallow:', '/')).toBe(false);
    expect(robotsAllows('', '/')).toBe(true);
  });

  it('keeps only role-based emails on the company domain, most useful first', () => {
    const pages = ['<a href="mailto:jane.doe@acme.ai">x</a> hello@acme.ai info@acme.ai jobs@acme.ai hello@gmail.com logo@2x.png'];
    expect(extractRoleEmails(pages, 'acme.ai')).toEqual(['jobs@acme.ai', 'hello@acme.ai', 'info@acme.ai']);
  });

  it('detects Greenhouse, Ashby and Lever boards', () => {
    expect(detectAtsBoard([{ href: 'https://jobs.ashbyhq.com/acme' }])).toMatchObject({ ats: 'ashby', slug: 'acme' });
    expect(detectAtsBoard([{ href: 'https://job-boards.eu.greenhouse.io/polyai/jobs/1' }])).toMatchObject({ ats: 'greenhouse', slug: 'polyai' });
    expect(detectAtsBoard([{ href: 'https://boards.greenhouse.io/embed/job_board?for=weaviate' }])).toMatchObject({ slug: 'weaviate' });
    expect(detectAtsBoard([{ href: 'https://jobs.eu.lever.co/x' }])).toMatchObject({ ats: 'lever', region: 'eu' });
    expect(detectAtsBoard([{ href: 'https://acme.ai/careers' }])).toBeNull();
  });

  it('reads homepage + about, ignores script text, finds careers and emails', async () => {
    const site = await readCompanySite('acme.ai', fakeHttp([]));
    expect(site).toMatchObject({
      ok: true,
      domain: 'acme.ai',
      website: 'https://acme.ai/',
      careersUrl: 'https://jobs.ashbyhq.com/acme',
      emails: ['jobs@acme.ai', 'hello@acme.ai'],
      atsBoard: { ats: 'ashby', slug: 'acme' },
    });
    expect(site.text).toContain('14 people in Amsterdam');
    expect(site.text).not.toContain('var a');
  });

  it('strips tags whose attributes contain >', () => {
    expect(htmlToText('<div class="[&>*]:z-30">Hello</div><p>World</p>')).toBe('Hello\nWorld');
  });

  it('matches a website domain to the company name', () => {
    expect(domainMatchesName('betalabs.nl', 'Beta Labs B.V.')).toBe(true);
    expect(domainMatchesName('getbeta.com', 'Beta Labs')).toBe(true);
    expect(domainMatchesName('alphatech.com', 'Beta Labs')).toBe(false);
    expect(domainMatchesName('weaviate.io', 'Weaviate')).toBe(true);
  });
});

describe('Startups: gate', () => {
  const good = VERDICTS['Acme AI'];
  it('keeps small Dutch AI companies at or above the fit threshold', () => {
    expect(gateVerdict(good)).toEqual({ keep: true, reason: null });
  });
  it('rejects by rule, whatever the fit score says', () => {
    expect(gateVerdict({ ...good, netherlands: 'unknown' })).toEqual({ keep: false, reason: 'no Netherlands location shown on its website' });
    expect(gateVerdict({ ...good, netherlands: 'no' }).keep).toBe(false);
    expect(gateVerdict({ ...good, aiIsCore: false }).keep).toBe(false);
    expect(gateVerdict({ ...good, kind: 'recruiter' }).keep).toBe(false);
    expect(gateVerdict({ ...good, size: '500+' }).keep).toBe(false);
    expect(gateVerdict({ ...good, fit: 2 }).keep).toBe(false);
    expect(gateVerdict({ ...good, fit: 3 }, { minFit: 4 }).keep).toBe(false);
  });
});

describe('Startups: LLM adapter', () => {
  it('sends a strict json_schema request and parses the content', async () => {
    let sent;
    const llm = createJsonLlm({
      baseUrl: 'https://api.x.ai/v1',
      apiKey: 'k',
      model: 'grok-test',
      fetchImpl: async (url, init) => {
        sent = { url, init, body: JSON.parse(init.body) };
        return new Response(JSON.stringify({ choices: [{ message: { content: '{"companies":[]}' } }] }), { status: 200 });
      },
    });
    expect(await llm.json({ system: 's', user: 'u', name: 'candidates', schema: { type: 'object' } })).toEqual({ companies: [] });
    expect(sent.url).toBe('https://api.x.ai/v1/chat/completions');
    expect(sent.init.headers.authorization).toBe('Bearer k');
    expect(sent.body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'candidates', strict: true, schema: { type: 'object' } } });
  });

  it('surfaces auth failures with their status', async () => {
    const llm = createJsonLlm({
      baseUrl: 'https://api.x.ai/v1', apiKey: 'bad', model: 'm',
      fetchImpl: async () => new Response(JSON.stringify({ error: 'Incorrect API key provided' }), { status: 400 }),
    });
    await expect(llm.json({ system: '', user: '', name: 'n', schema: {} })).rejects.toMatchObject({ status: 400 });
  });
});

/* ---------- Run ---------- */

describe('Startups: run', () => {
  /** @type {string} */
  let root;
  const clock = createFixedClock(new Date('2026-11-27T12:00:00.000Z'));

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'aroha-startups-'));
    fs.writeFileSync(
      path.join(root, 'scan.json'),
      JSON.stringify({ companies: [], startups: { searches: [{ query: 'dutch ai startups' }] } }),
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('verifies candidates on their own sites, keeps only what passes the gate, and feeds boards to the job scanner', async () => {
    const httpCalls = [];
    const llmCalls = [];
    const summary = await runStartupSearch({ root, http: fakeHttp(httpCalls), llm: fakeLlm(llmCalls), tavilyKey: 't', clock });

    expect(summary).toMatchObject({ candidates: 4, checked: 4, added: 1, rejected: 2, unreachable: 1, boardsAdded: 1, failed: [] });

    const { companies } = listStartups(root);
    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({
      id: 'acme.ai',
      name: 'Acme AI',
      city: 'Amsterdam',
      fit: 5,
      emails: ['jobs@acme.ai', 'hello@acme.ai'],
      careersUrl: 'https://jobs.ashbyhq.com/acme',
      status: 'new',
    });
    expect(companies[0].sources[0].type).toBe('yc');

    const store = JSON.parse(fs.readFileSync(path.join(root, 'data', 'startups.json'), 'utf8'));
    const byName = Object.fromEntries(store.companies.map((c) => [c.name, c]));
    expect(byName['Gamma Corp'].rejectReason).toBe('AI is not core');
    expect(byName['Beta Labs']).toMatchObject({ verdict: 'unreachable', rejectReason: 'robots.txt disallows', website: 'https://betalabs.nl/' });
    expect(byName['Investor X'].rejectReason).toBe('website not found');
    expect(httpCalls).not.toContain('FETCH https://betalabs.nl/');

    const scan = JSON.parse(fs.readFileSync(path.join(root, 'scan.json'), 'utf8'));
    expect(scan.companies).toEqual([{ name: 'Acme AI', ats: 'ashby', slug: 'acme' }]);

    // Second run: nothing is re-checked or re-judged.
    const again = [];
    const second = await runStartupSearch({ root, http: fakeHttp([]), llm: fakeLlm(again), tavilyKey: 't', clock });
    expect(second).toMatchObject({ candidates: 0, checked: 0 });
    expect(again).toEqual(['candidates']);
    expect(listStartups(root).companies).toHaveLength(1);
  });

  it('guesses an obvious domain before searching, skipping parked and non-Dutch look-alikes', async () => {
    const filler = '<p>' + 'We build computer vision for greenhouses. '.repeat(10) + '</p>';
    const extra = {
      'https://investorx.com/': { html: true, text: html(`<h1>Investor X domain is for sale</h1>${filler}`) },
      'https://investorx.ai/': { html: true, text: html(`<h1>Investor X</h1><p>San Francisco</p>${filler}`) },
      'https://investorx.io/': { html: true, text: html(`<h1>Investor X</h1><p>Based in Utrecht</p>${filler}`) },
    };
    const calls = [];
    const http = fakeHttp(calls);
    const getText = http.getText;
    http.getText = async (url) => (extra[url] ? { ok: true, status: 200, url, ...extra[url] } : getText(url));
    const llm = fakeLlm([]);
    const judge = llm.json;
    llm.json = async (args) => {
      if (args.name !== 'candidates' && /Company: Investor X/.test(args.user)) {
        return { ...VERDICTS['Acme AI'], city: 'Utrecht', whatTheyDo: 'Greenhouse vision' };
      }
      return judge(args);
    };
    await runStartupSearch({ root, http, llm, tavilyKey: 't', clock });

    const byName = Object.fromEntries(listStartups(root).companies.map((c) => [c.name, c]));
    expect(byName['Investor X'].website).toBe('https://investorx.io/');
    expect(calls).not.toContain('POST Investor X Netherlands official website');
  });

  it('retries a company whose website was not found after a week, not after the full recheck period', async () => {
    await runStartupSearch({ root, http: fakeHttp([]), llm: fakeLlm([]), tavilyKey: 't', clock });
    const later = (days) => createFixedClock(new Date(Date.parse('2026-11-27T12:00:00.000Z') + days * 86400000));
    const soon = await runStartupSearch({ root, http: fakeHttp([]), llm: fakeLlm([]), tavilyKey: 't', clock: later(3) });
    expect(soon.candidates).toBe(0);
    const week = await runStartupSearch({ root, http: fakeHttp([]), llm: fakeLlm([]), tavilyKey: 't', clock: later(8) });
    expect(week.candidates).toBe(1); // Investor X only; rejected and unreachable ones wait the full period
  });

  it('trusts the YC directory for location when the company site does not say', async () => {
    const llm = fakeLlm([]);
    const judge = llm.json;
    llm.json = async (args) => {
      const out = await judge(args);
      return args.name === 'candidates' ? out : { ...out, netherlands: 'unknown', city: '' };
    };
    await runStartupSearch({ root, http: fakeHttp([]), llm, tavilyKey: 't', clock });
    const store = JSON.parse(fs.readFileSync(path.join(root, 'data', 'startups.json'), 'utf8'));
    const byName = Object.fromEntries(store.companies.map((c) => [c.name, c]));
    expect(byName['Acme AI']).toMatchObject({ verdict: 'keep', city: 'Amsterdam' }); // from YC
    expect(byName['Gamma Corp'].rejectReason).toBe('no Netherlands location shown on its website'); // search only
  });

  it('dismisses a startup', async () => {
    await runStartupSearch({ root, http: fakeHttp([]), llm: fakeLlm([]), tavilyKey: 't', clock });
    setStartupStatus(root, { id: 'acme.ai', status: 'dismissed' });
    expect(listStartups(root).companies[0].status).toBe('dismissed');
    expect(() => setStartupStatus(root, { id: 'acme.ai', status: 'bogus' })).toThrow();
  });

  it('stops with a clear error when the AI model rejects the key, and stores nothing', async () => {
    const llm = { json: async () => { throw new LlmError('LLM 401: bad key', 401); } };
    await expect(runStartupSearch({ root, http: fakeHttp([]), llm, tavilyKey: 't', clock })).rejects.toThrow(/AI model rejected/);
    expect(fs.existsSync(path.join(root, 'data', 'startups.json'))).toBe(false);
  });

  it('explains when no AI model is configured', async () => {
    await expect(runStartupSearch({ root, http: fakeHttp([]), llm: null, tavilyKey: 't', clock })).rejects.toThrow(/OPENAI_API_KEY/);
  });
});

describe('Startups: Supabase store', () => {
  /** @type {string} */
  let root;
  const clock = createFixedClock(new Date('2026-11-27T12:00:00.000Z'));

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'aroha-startups-db-'));
    fs.writeFileSync(path.join(root, 'scan.json'), JSON.stringify({ companies: [], startups: { searches: [{ query: 'dutch ai startups' }] } }));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('imports the existing file list once, then never looks those companies up again', async () => {
    await runStartupSearch({ root, http: fakeHttp([]), llm: fakeLlm([]), tavilyKey: 't', clock }); // fills startups.json
    const client = createFakeSupabaseClient();
    const startups = createStartups({
      root,
      repo: createSupabaseStartupsRepo(client, { seed: createFileStartupsRepo(root) }),
      http: fakeHttp([]),
      llm: fakeLlm([]),
      tavilyKey: 't',
      clock,
    });

    const listed = await startups.list();
    expect(listed.companies.map((c) => c.name)).toEqual(['Acme AI']);
    expect(listed.lastRun.ranAt).toBe('2026-11-27T12:00:00.000Z');
    expect(client._tables.agent_startups).toHaveLength(4); // kept, rejected and unreachable all remembered

    fs.rmSync(path.join(root, 'data'), { recursive: true }); // the database alone now holds the list
    const summary = await startups.refresh();
    expect(summary).toMatchObject({ candidates: 0, checked: 0 });

    await startups.setStatus({ id: 'acme.ai', status: 'dismissed' });
    expect((await startups.list()).companies[0].status).toBe('dismissed');
    expect(client._tables.agent_startups.find((r) => r.domain === 'acme.ai').status).toBe('dismissed');
    await expect(startups.setStatus({ id: 'acme.ai', status: 'bogus' })).rejects.toThrow(/Unknown startup status/);
  });

  it('points to the SQL file when the table is missing', async () => {
    const client = { from: () => { const b = { select: () => b, order: () => b, range: async () => ({ data: null, error: { message: "Could not find the table 'public.agent_startups' in the schema cache" } }) }; return b; } };
    await expect(createSupabaseStartupsRepo(client).load()).rejects.toThrow(/startups-store\.sql/);
  });
});

describe('Startups: AI model choice', () => {
  it('uses OpenAI with a default model when only OPENAI_API_KEY is set', () => {
    expect(createJsonLlmFromEnv({ OPENAI_API_KEY: 'k' }).model).toBe('gpt-4.1-mini');
    expect(createJsonLlmFromEnv({ OPENAI_API_KEY: 'k', GROK_API_KEY: 'g' }).model).toBe('gpt-4.1-mini');
    expect(createJsonLlmFromEnv({ GROK_API_KEY: 'g' }).model).toBe('grok-4.7');
    expect(createJsonLlmFromEnv({})).toBeNull();
  });
});
