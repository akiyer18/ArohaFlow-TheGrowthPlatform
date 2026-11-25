/**
 * Public job sources for the Discovery scanner. No auth except Adzuna's free app key.
 * Every fetcher returns normalized jobs:
 *   { source, company, title, link, locations: string[], postedAt: 'YYYY-MM-DD' | null, boardKey?, jobId? }
 * `boardKey` + `jobId` are set for company boards (Greenhouse, Ashby, Lever), whose list is the
 * company's complete set of open jobs; the liveness check relies on that.
 *
 * Endpoint shapes follow career-ops (MIT, github.com/career-ops-hq/career-ops) providers.
 */

const ARBEITNOW_MAX_PAGES = 3;
const ADZUNA_COUNTRY_NAMES = { nl: 'Netherlands', de: 'Germany', be: 'Belgium' };
/** Arbeitnow runs one site per country; its locations are bare cities. */
const ARBEITNOW_COUNTRY_BY_TLD = {
  com: 'Germany',
  de: 'Germany',
  nl: 'Netherlands',
  be: 'Belgium',
  at: 'Austria',
  ch: 'Switzerland',
  fr: 'France',
  'co.uk': 'United Kingdom',
};

export function arbeitnowCountry(link) {
  try {
    const host = new URL(link).hostname;
    const tld = host.replace(/^(www\.)?arbeitnow\./, '');
    return ARBEITNOW_COUNTRY_BY_TLD[tld] ?? null;
  } catch {
    return null;
  }
}

export function toDateKey(value) {
  if (value == null || value === '') return null;
  const date = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function boardKey(ats, slug) {
  return `${ats}:${String(slug).toLowerCase()}`;
}

async function fetchGreenhouse(fetchJson, company) {
  const json = await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.slug)}/jobs`,
  );
  return (json?.jobs ?? []).map((job) => ({
    source: 'greenhouse',
    company: company.name,
    title: String(job.title ?? '').trim(),
    link: job.absolute_url,
    locations: [job.location?.name].filter(Boolean),
    postedAt: toDateKey(job.first_published ?? job.updated_at),
    boardKey: boardKey('greenhouse', company.slug),
    jobId: String(job.id),
  }));
}

async function fetchAshby(fetchJson, company) {
  const json = await fetchJson(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.slug)}`,
  );
  return (json?.jobs ?? [])
    .filter((job) => job.isListed !== false)
    .map((job) => ({
      source: 'ashby',
      company: company.name,
      title: String(job.title ?? '').trim(),
      link: job.jobUrl,
      locations: [
        job.location,
        ...(job.secondaryLocations ?? []).map((l) => l.location),
        job.isRemote ? 'Remote' : null,
      ].filter(Boolean),
      postedAt: toDateKey(job.publishedAt),
      boardKey: boardKey('ashby', company.slug),
      jobId: String(job.id),
    }));
}

async function fetchLever(fetchJson, company) {
  const host = company.region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
  const json = await fetchJson(
    `https://${host}/v0/postings/${encodeURIComponent(company.slug)}?mode=json`,
  );
  return (Array.isArray(json) ? json : []).map((job) => ({
    source: 'lever',
    company: company.name,
    title: String(job.text ?? '').trim(),
    link: job.hostedUrl,
    locations: job.categories?.allLocations?.length
      ? job.categories.allLocations
      : [job.categories?.location].filter(Boolean),
    postedAt: toDateKey(job.createdAt),
    boardKey: boardKey('lever', company.slug),
    jobId: String(job.id),
  }));
}

const BOARD_FETCHERS = { greenhouse: fetchGreenhouse, ashby: fetchAshby, lever: fetchLever };

export function fetchCompanyBoard(fetchJson, company) {
  const fetcher = BOARD_FETCHERS[company.ats];
  if (!fetcher) throw new Error(`Unsupported ATS "${company.ats}" for ${company.name}`);
  return fetcher(fetchJson, company);
}

/** Arbeitnow: newest first across its country sites. Location is a city, so the country is added. */
export async function fetchArbeitnow(fetchJson) {
  const jobs = [];
  for (let page = 1; page <= ARBEITNOW_MAX_PAGES; page += 1) {
    const json = await fetchJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    for (const job of json?.data ?? []) {
      jobs.push({
        source: 'arbeitnow',
        company: String(job.company_name ?? '').trim() || 'Unknown',
        title: String(job.title ?? '').trim(),
        link: job.url,
        locations: [job.location, arbeitnowCountry(job.url), job.remote ? 'Remote' : null].filter(Boolean),
        postedAt: toDateKey(job.created_at),
      });
    }
    if (!json?.links?.next) break;
  }
  return jobs;
}

/** Adzuna keyword search per country; needs ADZUNA_APP_ID / ADZUNA_APP_KEY. */
export async function fetchAdzuna(fetchJson, { appId, appKey, countries, queries, maxDaysOld }) {
  const jobs = [];
  for (const country of countries) {
    for (const what of queries) {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        what,
        results_per_page: '50',
        max_days_old: String(maxDaysOld),
        'content-type': 'application/json',
      });
      const json = await fetchJson(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
      );
      for (const job of json?.results ?? []) {
        jobs.push({
          source: 'adzuna',
          company: String(job.company?.display_name ?? '').trim() || 'Unknown',
          title: String(job.title ?? '').replace(/<[^>]+>/g, '').trim(),
          link: job.redirect_url,
          locations: [job.location?.display_name, ADZUNA_COUNTRY_NAMES[country]].filter(Boolean),
          postedAt: toDateKey(job.created),
        });
      }
    }
  }
  return jobs;
}

/**
 * Which company board a posting URL belongs to, and its job id there.
 * @returns {{ boardKey: string, jobId: string } | null}
 */
export function parseBoardLink(link) {
  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const host = url.hostname;
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const jobsIdx = parts.indexOf('jobs');
    if (jobsIdx > 0 && parts[jobsIdx + 1]) {
      return { boardKey: boardKey('greenhouse', parts[jobsIdx - 1]), jobId: parts[jobsIdx + 1] };
    }
    const ghJid = url.searchParams.get('gh_jid');
    if (parts[0] && ghJid) return { boardKey: boardKey('greenhouse', parts[0]), jobId: ghJid };
    return null;
  }
  if (host === 'jobs.ashbyhq.com' && parts.length >= 2) {
    return { boardKey: boardKey('ashby', decodeURIComponent(parts[0])), jobId: parts[1] };
  }
  if (/^jobs(\.eu)?\.lever\.co$/.test(host) && parts.length >= 2) {
    return { boardKey: boardKey('lever', parts[0]), jobId: parts[1] };
  }
  return null;
}
