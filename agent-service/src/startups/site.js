/**
 * Read a company's own website: homepage plus one careers and one about/contact page,
 * respecting robots.txt. Extracts text for the judge, published role-based emails, the
 * careers page, and a Greenhouse/Ashby/Lever board when the site links to one.
 */

const USER_AGENT = 'ArohaFlow-Startups/1.0';
const ROBOTS_AGENT = 'arohaflow';

/** Role-based mailbox names, most useful for an open application first. Named people are never kept. */
const ROLE_MAILBOXES = [
  'jobs', 'careers', 'career', 'werkenbij', 'vacatures', 'recruitment', 'recruiting', 'talent',
  'hr', 'people', 'join', 'apply', 'hello', 'hi', 'hey', 'team', 'founders', 'info', 'contact', 'office',
];

const CAREERS_RE = /career|jobs?\b|vacatures?|vacanc|werken-?bij|work-?with-?us|join(-?us|-?the-?team)?\b|hiring|open-?positions/i;
const ABOUT_RE = /about|over-?ons|contact|team\b|company\b/i;

/* ---------- Text ---------- */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/tr)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, '\n')
      // Quote-aware, so `>` inside attributes (e.g. Tailwind `[&>*]:z-30`) does not end the tag.
      .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' '),
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function extractLinks(html, baseUrl) {
  const links = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const href = new URL(decodeEntities(m[1].trim()), baseUrl).toString();
      links.push({ href, text: htmlToText(m[2]).slice(0, 80) });
    } catch {
      /* skip malformed */
    }
  }
  return links;
}

/* ---------- Domains ---------- */

export function siteDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function sameSite(url, domain) {
  const host = siteDomain(url);
  return Boolean(host && (host === domain || host.endsWith(`.${domain}`)));
}

/* ---------- robots.txt ---------- */

/** Longest-match Allow/Disallow for our agent group, falling back to `*`. */
export function robotsAllows(robotsText, pathname) {
  if (!robotsText) return true;
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of robotsText.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      current.rules.push({ allow: key === 'allow', path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const pick = groups.filter((g) => g.agents.some((a) => a === ROBOTS_AGENT || a === USER_AGENT.toLowerCase().split('/')[0]));
  const chosen = pick.length ? pick : groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const rule of chosen.flatMap((g) => g.rules)) {
    if (!rule.path) continue; // empty Disallow allows everything
    const pattern = rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (!new RegExp(`^${pattern}`).test(pathname)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

/* ---------- Extraction ---------- */

export function extractRoleEmails(htmlPages, domain) {
  const found = new Set();
  for (const html of htmlPages) {
    const text = decodeEntities(String(html)).replace(/%40/g, '@');
    for (const m of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) found.add(m[0].toLowerCase());
  }
  const rank = (email) => {
    const local = email.split('@')[0];
    return ROLE_MAILBOXES.findIndex((box) => local === box || local.startsWith(`${box}.`) || local.startsWith(`${box}-`));
  };
  return [...found]
    .filter((email) => {
      const host = email.split('@')[1];
      if (/\.(png|jpe?g|gif|svg|webp)$/.test(host)) return false;
      return (host === domain || host.endsWith(`.${domain}`)) && rank(email) !== -1;
    })
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 3);
}

/** Greenhouse / Ashby / Lever boards the job scanner can read. */
export function detectAtsBoard(links) {
  for (const { href } of links) {
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const host = url.hostname;
    const embedFor = url.searchParams.get('for');
    if (/(^|\.)greenhouse\.io$/.test(host)) {
      const slug = embedFor || (parts[0] === 'embed' ? null : parts[0]);
      if (slug && slug !== 'v1') return { ats: 'greenhouse', slug, url: href };
    }
    if (host === 'jobs.ashbyhq.com' && parts[0]) return { ats: 'ashby', slug: decodeURIComponent(parts[0]), url: href };
    if (/^jobs(\.eu)?\.lever\.co$/.test(host) && parts[0]) {
      return { ats: 'lever', slug: parts[0], url: href, ...(host.includes('.eu.') ? { region: 'eu' } : {}) };
    }
  }
  return null;
}

const HOSTED_CAREERS_RE =
  /(\.recruitee\.com|\.homerun\.co|\.teamtailor\.com|apply\.workable\.com|join\.com\/companies|\.jobs\.personio\.(de|com)|greenhouse\.io|jobs\.ashbyhq\.com|jobs(\.eu)?\.lever\.co|werkenbij\.)/i;

function findCareersUrl(links, domain) {
  const hosted = links.find((l) => HOSTED_CAREERS_RE.test(l.href));
  if (hosted) return hosted.href;
  const own = links.find((l) => sameSite(l.href, domain) && (CAREERS_RE.test(l.href) || CAREERS_RE.test(l.text)));
  return own?.href ?? null;
}

/* ---------- Read ---------- */

/**
 * @param {string} website
 * @param {{ getText: (url: string) => Promise<{ ok: boolean, status: number, url: string, text: string, html: boolean }> }} http
 * @returns {Promise<{ ok: true, website: string, domain: string, text: string, emails: string[], careersUrl: string | null, atsBoard: object | null } | { ok: false, reason: string }>}
 */
export async function readCompanySite(website, http) {
  let home;
  try {
    home = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  } catch {
    return { ok: false, reason: 'invalid website' };
  }
  let robots = '';
  try {
    const res = await http.getText(new URL('/robots.txt', home).toString());
    if (res.ok && !res.html) robots = res.text;
  } catch {
    /* no robots.txt: allowed */
  }
  if (!robotsAllows(robots, home.pathname || '/')) return { ok: false, reason: 'robots.txt disallows' };

  let first;
  try {
    first = await http.getText(home.toString());
  } catch (err) {
    return { ok: false, reason: `unreachable (${err.message})` };
  }
  if (!first.ok || !first.html) return { ok: false, reason: `unreachable (HTTP ${first.status})` };

  const finalUrl = first.url || home.toString();
  const domain = siteDomain(finalUrl);
  const links = extractLinks(first.text, finalUrl);
  const careersUrl = findCareersUrl(links, domain);
  const aboutUrl = links.find((l) => sameSite(l.href, domain) && (ABOUT_RE.test(l.href) || ABOUT_RE.test(l.text)))?.href;

  const extraPages = [];
  for (const url of [careersUrl, aboutUrl]) {
    if (!url || !sameSite(url, domain) || url === finalUrl) continue;
    if (!robotsAllows(robots, new URL(url).pathname)) continue;
    try {
      const res = await http.getText(url);
      if (res.ok && res.html) extraPages.push({ url, html: res.text });
    } catch {
      /* optional page */
    }
  }

  const allLinks = [...links, ...extraPages.flatMap((p) => extractLinks(p.html, p.url))];
  const sections = [
    `HOMEPAGE (${finalUrl}):\n${htmlToText(first.text).slice(0, 5000)}`,
    ...extraPages.map((p) => `PAGE (${p.url}):\n${htmlToText(p.html).slice(0, 2500)}`),
  ];
  return {
    ok: true,
    website: `${new URL(finalUrl).origin}/`,
    domain,
    text: sections.join('\n\n'),
    emails: extractRoleEmails([first.text, ...extraPages.map((p) => p.html)], domain),
    careersUrl: careersUrl ?? findCareersUrl(allLinks, domain),
    atsBoard: detectAtsBoard(allLinks),
  };
}

/** Real-network text fetcher used by the Agent Service. */
export function createHttpText(fetchImpl = globalThis.fetch) {
  return {
    async getText(url) {
      const res = await fetchImpl(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      });
      const type = res.headers.get('content-type') ?? '';
      const text = (await res.text()).slice(0, 1_500_000);
      return { ok: res.ok, status: res.status, url: res.url || url, text, html: /html/i.test(type) };
    },
  };
}
