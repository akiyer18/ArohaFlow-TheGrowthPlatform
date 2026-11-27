import fs from 'node:fs';
import path from 'node:path';
import { mapLimit } from '../discovery/scanJobs.js';
import { extractCandidates, gateVerdict, judgeCompany } from './judge.js';
import { htmlToText, readCompanySite, robotsAllows, siteDomain } from './site.js';
import { NOT_A_COMPANY_SITE, fetchYcNetherlands, isCompanySiteCandidate, tavilySearch } from './sources.js';

const CONCURRENCY = 4;

export const DEFAULT_STARTUPS_CONFIG = {
  targetRoles: ['AI Engineer', 'Machine Learning Engineer', 'LLM / Applied AI Engineer', 'Forward Deployed Engineer'],
  minFit: 3,
  maxNewPerRun: 30,
  recheckAfterDays: 60,
  yc: true,
  searches: [
    { query: 'list of AI startups in the Netherlands', timeRange: 'year' },
    { query: 'Dutch AI startup raises seed funding', topic: 'news', timeRange: 'year' },
    { query: 'Amsterdam AI startup raises Series A', topic: 'news', timeRange: 'year' },
    { query: 'Netherlands generative AI LLM startup', timeRange: 'year' },
    { query: 'AI startup Rotterdam' },
    { query: 'AI startup Utrecht' },
    { query: 'AI startup Eindhoven' },
    { query: 'Delft AI startup spin-off' },
    { query: 'AI startup Groningen OR Leiden OR The Hague' },
    { query: 'Amsterdam AI agents startup hiring engineers', timeRange: 'year' },
    { query: 'Dutch machine learning scale-up hiring', timeRange: 'year' },
    { query: 'Netherlands AI startups to watch 2026' },
  ],
};

const LEGAL_SUFFIX = /\b(b\.?v\.?|n\.?v\.?|inc\.?|ltd\.?|gmbh|llc|holding)\b/gi;

export function nameKey(name) {
  return String(name).toLowerCase().replace(LEGAL_SUFFIX, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Does a website's domain plausibly belong to a company of this name? */
export function domainMatchesName(domain, name) {
  const label = String(domain).split('.')[0].replace(/[^a-z0-9]/g, '');
  const compact = nameKey(name);
  if (label.length < 3 || compact.length < 2) return false;
  if (label.includes(compact) || compact.includes(label)) return true;
  const firstWord = nameKey(String(name).split(/\s+/)[0]);
  return firstWord.length >= 4 && label.includes(firstWord);
}

const GUESS_TLDS = ['com', 'ai', 'io', 'nl', 'co'];
const NL_TEXT_RE = /netherlands|nederland|dutch|amsterdam|rotterdam|utrecht|eindhoven|delft|den haag|the hague|groningen|leiden|nijmegen|enschede|tilburg|haarlem/i;
const PARKED_RE = /domain (is |may be )?for sale|buy this domain|this domain is parked|parked free|hugedomains|sedo\.com|dan\.com/i;

/**
 * Try the obvious domains (name.com, name.ai, …) before spending a web search. A guess counts only when
 * robots.txt allows it, the homepage names the company, it is not a parked domain, and it shows a Dutch link
 * (a .nl domain or a Dutch place on the page), so a same-named company elsewhere is not picked up.
 */
async function guessWebsite(http, name) {
  const labels = [...new Set([nameKey(name), nameKey(String(name).split(/\s+/)[0])])].filter((l) => /^[a-z0-9]{4,}$/.test(l));
  const hosts = labels.flatMap((label) => GUESS_TLDS.map((tld) => `${label}.${tld}`));
  const hits = await Promise.all(
    hosts.map(async (host) => {
      try {
        const robots = await http.getText(`https://${host}/robots.txt`);
        if (robots.ok && !robots.html && !robotsAllows(robots.text, '/')) return null;
        const res = await http.getText(`https://${host}/`);
        if (!res.ok || !res.html) return null;
        const finalUrl = res.url || `https://${host}/`;
        const domain = siteDomain(finalUrl);
        const text = htmlToText(res.text);
        if (!domain || !domainMatchesName(domain, name) || text.length < 300 || PARKED_RE.test(text)) return null;
        if (!nameKey(text.slice(0, 6000)).includes(nameKey(name))) return null;
        if (!domain.endsWith('.nl') && !NL_TEXT_RE.test(text)) return null;
        return `${new URL(finalUrl).origin}/`;
      } catch {
        return null;
      }
    }),
  );
  return hits.find(Boolean) ?? '';
}

function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / 86400000);
}

function isAuthError(err) {
  return err?.status === 401 || err?.status === 403;
}

/* ---------- Store (career-data/data/startups.json) ---------- */

export function readStartupsStore(root) {
  try {
    const store = JSON.parse(fs.readFileSync(path.join(root, 'data', 'startups.json'), 'utf8'));
    return { updatedAt: null, lastRun: null, companies: [], ...store };
  } catch {
    return { updatedAt: null, lastRun: null, companies: [] };
  }
}

function writeStartupsStore(root, store) {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'startups.json'), `${JSON.stringify(store, null, 2)}\n`);
}

export function readStartupsConfig(root) {
  try {
    const scan = JSON.parse(fs.readFileSync(path.join(root, 'scan.json'), 'utf8'));
    return { ...DEFAULT_STARTUPS_CONFIG, ...(scan.startups ?? {}) };
  } catch {
    return { ...DEFAULT_STARTUPS_CONFIG };
  }
}

/** Add Greenhouse/Ashby/Lever boards to the job scanner so their vacancies reach Discovery. */
function addBoardsToScan(root, boards) {
  const scanPath = path.join(root, 'scan.json');
  if (!boards.length || !fs.existsSync(scanPath)) return 0;
  const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
  scan.companies = scan.companies ?? [];
  const have = new Set(scan.companies.map((c) => `${c.ats}:${String(c.slug).toLowerCase()}`));
  let added = 0;
  for (const b of boards) {
    const key = `${b.ats}:${String(b.slug).toLowerCase()}`;
    if (have.has(key)) continue;
    have.add(key);
    scan.companies.push({ name: b.name, ats: b.ats, slug: b.slug, ...(b.region ? { region: b.region } : {}) });
    added += 1;
  }
  if (added) fs.writeFileSync(scanPath, `${JSON.stringify(scan, null, 2)}\n`);
  return added;
}

/* ---------- Run ---------- */

/**
 * Gather candidates, verify each on its own website, judge, and store.
 * @param {{
 *   root: string,
 *   http: { getJson: Function, postJson: Function, getText: Function },
 *   llm: { json: Function } | null,
 *   tavilyKey?: string,
 *   clock: { todayDateKey(): string, now(): Date },
 * }} deps
 */
/**
 * File repository over career-data/data/startups.json, used when Supabase is not configured and as
 * the one-time seed for the Supabase repository.
 */
export function createFileStartupsRepo(root) {
  return {
    async load() {
      return root ? readStartupsStore(root) : { updatedAt: null, lastRun: null, companies: [] };
    },
    async save({ companies, lastRun }) {
      const store = readStartupsStore(root);
      const keys = new Set(companies.map((c) => nameKey(c.name)));
      const rest = store.companies.filter((c) => !keys.has(nameKey(c.name)));
      writeStartupsStore(root, { updatedAt: lastRun?.ranAt ?? store.updatedAt, lastRun: lastRun ?? store.lastRun, companies: [...rest, ...companies] });
    },
    async setStatus(id, status) {
      return setStartupStatus(root, { id, status });
    },
  };
}

/** Kept companies, best fit first. */
function keptCompanies(companies) {
  return companies
    .filter((c) => c.verdict === 'keep')
    .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0) || String(b.foundAt).localeCompare(String(a.foundAt)));
}

export async function runStartupSearch({ root, repo = createFileStartupsRepo(root), http, llm, tavilyKey, clock }) {
  if (!llm) {
    throw new Error('No AI model configured: set OPENAI_API_KEY in .env (or GROK_API_KEY).');
  }
  const config = readStartupsConfig(root);
  const today = clock.todayDateKey();
  const store = await repo.load();
  const notes = [];
  const failed = [];
  let searchesRun = 0;
  let resolveSearches = 0;

  // Known companies: kept ones forever, rejected ones until recheckAfterDays.
  const known = new Map();
  for (const c of store.companies) {
    // A missing website is often our lookup failing, not the company, so it is retried after a week.
    const recheckDays = c.rejectReason === 'website not found' ? 7 : config.recheckAfterDays;
    const stale = c.verdict !== 'keep' && daysBetween(c.checkedAt ?? today, today) >= recheckDays;
    if (stale) continue;
    known.set(`name:${nameKey(c.name)}`, c);
    if (c.domain) known.set(`domain:${c.domain}`, c);
  }

  /* 1. Candidates */
  const candidates = new Map();
  const addCandidate = (c, source) => {
    const key = nameKey(c.name);
    if (!key || known.has(`name:${key}`)) return;
    const website = c.website && isCompanySiteCandidate(/^https?:/i.test(c.website) ? c.website : `https://${c.website}`) ? c.website : '';
    if (website && known.has(`domain:${siteDomain(/^https?:/i.test(website) ? website : `https://${website}`)}`)) return;
    const entry = candidates.get(key) ?? { name: c.name, website: '', city: '', oneLiner: '', sources: [] };
    entry.website ||= website;
    entry.city ||= c.city ?? '';
    entry.oneLiner ||= c.oneLiner ?? '';
    if (!entry.sources.some((s) => s.url === source.url)) entry.sources.push(source);
    candidates.set(key, entry);
  };

  if (config.yc) {
    try {
      for (const c of await fetchYcNetherlands(http)) addCandidate(c, c.source);
    } catch (err) {
      failed.push(`YC directory (${err.message})`);
    }
  }

  if (!tavilyKey) {
    notes.push('Web search skipped: set TAVILY_KEY');
  } else {
    await mapLimit(config.searches, CONCURRENCY, async (search) => {
      let results;
      try {
        results = await tavilySearch(http, tavilyKey, search);
        searchesRun += 1;
      } catch (err) {
        failed.push(`Search "${search.query}" (${err.message})`);
        return;
      }
      try {
        const found = await extractCandidates(llm, { query: search.query, results });
        for (const c of found) addCandidate(c, { type: 'search', url: results[0]?.url ?? '', title: search.query });
      } catch (err) {
        if (isAuthError(err)) throw err;
        failed.push(`Reading results of "${search.query}" (${err.message})`);
      }
    }).catch((err) => {
      throw new Error(`AI model rejected the request: ${err.message}`);
    });
  }

  /* 2. Verify the most-mentioned candidates first, within the per-run budget */
  const queue = [...candidates.values()]
    .sort((a, b) => b.sources.length - a.sources.length || Number(Boolean(b.website)) - Number(Boolean(a.website)))
    .slice(0, config.maxNewPerRun);
  const deferred = candidates.size - queue.length;
  const checked = [];
  const boards = [];
  const seenDomains = new Set();

  await mapLimit(queue, CONCURRENCY, async (cand) => {
    const base = {
      name: cand.name,
      sources: cand.sources,
      foundAt: today,
      checkedAt: today,
    };

    let website = cand.website || (await guessWebsite(http, cand.name));
    if (!website && tavilyKey) {
      try {
        resolveSearches += 1;
        const hits = await tavilySearch(http, tavilyKey, {
          query: `${cand.name} ${cand.city || 'Netherlands'} official website`,
          depth: 'basic',
          maxResults: 10,
          excludeDomains: NOT_A_COMPANY_SITE,
          rawContent: false,
        });
        website = hits.find((h) => isCompanySiteCandidate(h.url) && domainMatchesName(siteDomain(h.url), cand.name))?.url ?? '';
        if (website) website = `${new URL(website).origin}/`;
      } catch (err) {
        failed.push(`Finding ${cand.name}'s website (${err.message})`);
        return; // retry next run
      }
    }
    if (!website) {
      checked.push({ ...base, verdict: 'reject', rejectReason: 'website not found' });
      return;
    }

    const site = await readCompanySite(website, http);
    if (!site.ok) {
      checked.push({ ...base, website, domain: siteDomain(/^https?:/i.test(website) ? website : `https://${website}`), verdict: 'unreachable', rejectReason: site.reason });
      return;
    }
    if (known.has(`domain:${site.domain}`) || seenDomains.has(site.domain)) return; // same company under another name
    seenDomains.add(site.domain);

    let v;
    try {
      v = await judgeCompany(llm, {
        name: cand.name,
        site,
        sourceNotes: [cand.oneLiner, ...cand.sources.map((s) => s.title)].filter(Boolean),
        targetRoles: config.targetRoles,
      });
    } catch (err) {
      if (isAuthError(err)) throw err;
      failed.push(`Judging ${cand.name} (${err.message})`);
      return; // retry next run
    }
    // The YC directory's location field is structured data; it settles location when the site is silent.
    if (v.netherlands === 'unknown' && cand.sources.some((s) => s.type === 'yc')) {
      v = { ...v, netherlands: 'office', city: v.city || cand.city };
    }
    const gate = gateVerdict(v, { minFit: config.minFit });
    if (gate.keep && site.atsBoard) boards.push({ name: cand.name, ...site.atsBoard });
    checked.push({
      ...base,
      id: site.domain,
      domain: site.domain,
      website: site.website,
      city: v.city || cand.city,
      whatTheyDo: v.whatTheyDo,
      kind: v.kind,
      size: v.size,
      fit: v.fit,
      reason: v.reason,
      hiringSignals: v.hiringSignals,
      careersUrl: site.careersUrl,
      emails: site.emails,
      atsBoard: site.atsBoard,
      verdict: gate.keep ? 'keep' : 'reject',
      rejectReason: gate.reason,
      status: 'new',
    });
  }).catch((err) => {
    if (isAuthError(err)) throw new Error(`AI model rejected the request: ${err.message}`);
    throw err;
  });

  /* 3. Store: checked companies replace any stale entry of the same name; everything else stays */
  const boardsAdded = addBoardsToScan(root, boards);
  const summary = {
    ranAt: clock.now().toISOString(),
    candidates: candidates.size,
    checked: checked.length,
    added: checked.filter((c) => c.verdict === 'keep').length,
    rejected: checked.filter((c) => c.verdict === 'reject').length,
    unreachable: checked.filter((c) => c.verdict === 'unreachable').length,
    deferred,
    boardsAdded,
    searches: searchesRun,
    websiteLookups: resolveSearches,
    failed,
    notes,
  };
  await repo.save({ companies: checked, lastRun: summary });
  return summary;
}

export function listStartups(root) {
  const store = readStartupsStore(root);
  return { updatedAt: store.updatedAt, lastRun: store.lastRun, companies: keptCompanies(store.companies) };
}

export function setStartupStatus(root, { id, status }) {
  if (!['new', 'dismissed', 'saved'].includes(status)) throw new Error(`Unknown startup status: ${status}`);
  const store = readStartupsStore(root);
  const company = store.companies.find((c) => c.id === id);
  if (!company) throw new Error(`Startup not found: ${id}`);
  company.status = status;
  writeStartupsStore(root, store);
  return company;
}

/**
 * Startups port. `repo` holds the list (Supabase or the career-data file); `root` (career-data) is
 * needed only to search, for the settings in scan.json and to hand job boards to the scanner.
 * @param {{ root: string | null, repo?: object, http: object, llm: object | null, tavilyKey?: string, clock: object }} deps
 */
export function createStartups({ root, repo = createFileStartupsRepo(root), http, llm, tavilyKey, clock }) {
  return {
    async refresh() {
      if (!root) throw new Error('Add a career-data/ folder (or set CAREER_OPS_ROOT) to search for startups.');
      return runStartupSearch({ root, repo, http, llm, tavilyKey, clock });
    },
    async list() {
      const store = await repo.load();
      return { updatedAt: store.lastRun?.ranAt ?? null, lastRun: store.lastRun ?? null, companies: keptCompanies(store.companies) };
    },
    async setStatus({ id, status } = {}) {
      if (!['new', 'dismissed', 'saved'].includes(status)) throw new Error(`Unknown startup status: ${status}`);
      return repo.setStatus(id, status);
    },
  };
}
