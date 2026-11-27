/**
 * Candidate sources for the Startups list: the YC directory (yc-oss, free) and Tavily search.
 */

const YC_ALL = 'https://yc-oss.github.io/api/companies/all.json';
const TAVILY_SEARCH = 'https://api.tavily.com/search';
const NL_RE = /\bnetherlands\b|\bamsterdam\b|\brotterdam\b|\butrecht\b|\beindhoven\b|\bdelft\b|\bthe hague\b|\bden haag\b|\bgroningen\b|\bleiden\b/i;

/** Sites that write about companies rather than being one; never accepted as a company website. */
export const NOT_A_COMPANY_SITE = [
  'linkedin.com', 'facebook.com', 'x.com', 'twitter.com', 'instagram.com', 'youtube.com', 'medium.com',
  'crunchbase.com', 'dealroom.co', 'tracxn.com', 'pitchbook.com', 'cbinsights.com', 'wellfound.com',
  'angel.co', 'glassdoor.com', 'glassdoor.nl', 'indeed.com', 'indeed.nl', 'techcrunch.com',
  'eu-startups.com', 'sifted.eu', 'tech.eu', 'siliconcanals.com', 'wikipedia.org', 'github.com',
  'ycombinator.com', 'growthlist.co', 'seedtable.com', 'f6s.com', 'zoominfo.com', 'apollo.io',
  'bloomberg.com', 'reuters.com', 'fd.nl', 'emerce.nl', 'startupjuncture.com', 'sesamers.com',
  'clutch.co', 'goodfirms.co', 'wadline.com', 'zefyron.com', 'ensun.io', 'google.com', 'apple.com',
];

export function isCompanySiteCandidate(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  return !NOT_A_COMPANY_SITE.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Active YC companies with a Netherlands location. */
export async function fetchYcNetherlands(http) {
  const all = await http.getJson(YC_ALL);
  return (Array.isArray(all) ? all : [])
    .filter((c) => c.status === 'Active' && NL_RE.test(`${c.all_locations ?? ''} ${(c.regions ?? []).join(' ')}`))
    .map((c) => ({
      name: String(c.name).trim(),
      website: c.website || '',
      city: (String(c.all_locations ?? '').split(';').find((l) => NL_RE.test(l)) ?? '').split(',')[0].trim(),
      oneLiner: c.one_liner ?? '',
      source: {
        type: 'yc',
        url: c.url ?? `https://www.ycombinator.com/companies/${c.slug}`,
        title: `YC ${c.batch ?? ''}${c.isHiring ? ' · hiring' : ''}${c.team_size ? ` · team ${c.team_size}` : ''}`.trim(),
      },
    }));
}

/**
 * @param {{ postJson: (url: string, body: object, headers?: object) => Promise<any> }} http
 * @param {string} apiKey
 * @param {{ query: string, topic?: 'general' | 'news', timeRange?: 'week' | 'month' | 'year', depth?: 'basic' | 'advanced', maxResults?: number, rawContent?: boolean }} search
 */
export async function tavilySearch(http, apiKey, search) {
  const json = await http.postJson(
    TAVILY_SEARCH,
    {
      query: search.query,
      search_depth: search.depth ?? 'advanced',
      topic: search.topic ?? 'general',
      max_results: search.maxResults ?? 8,
      ...(search.timeRange ? { time_range: search.timeRange } : {}),
      ...(search.excludeDomains ? { exclude_domains: search.excludeDomains } : {}),
      ...(search.rawContent === false ? {} : { include_raw_content: 'text' }),
    },
    { authorization: `Bearer ${apiKey}` },
  );
  return (json?.results ?? []).map((r) => ({
    url: r.url,
    title: r.title ?? '',
    content: r.raw_content || r.content || '',
  }));
}

/** Real-network JSON fetcher (GET and POST) used by the Agent Service. */
export function createHttpJson(fetchImpl = globalThis.fetch) {
  async function parse(res) {
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 160);
      try {
        const body = JSON.parse(text);
        detail = body.detail?.error ?? body.detail ?? body.error ?? detail;
      } catch {
        /* raw */
      }
      throw new Error(`HTTP ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
    return JSON.parse(text);
  }
  return {
    async getJson(url) {
      return parse(await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(60_000) }));
    },
    async postJson(url, body, headers = {}) {
      return parse(
        await fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        }),
      );
    },
  };
}
