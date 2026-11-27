import fs from 'node:fs';
import path from 'node:path';
import {
  fetchAdzuna,
  fetchArbeitnow,
  fetchCompanyBoard,
  parseBoardLink,
} from './jobSources.js';

const CONCURRENCY = 6;
const TIMEOUT_MS = 20_000;

/* ---------- Filters (scan.json `titles`, `locations`, `maxPostingAgeDays`) ---------- */

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * career-ops keyword syntax: plain = case-insensitive substring (2–3 letter keywords match whole
 * words), `word:` = whole word, `stem:` = must start a word.
 */
export function keywordMatcher(entry) {
  const raw = String(entry);
  let mode = 'plain';
  let keyword = raw;
  if (raw.startsWith('word:')) [mode, keyword] = ['word', raw.slice(5)];
  else if (raw.startsWith('stem:')) [mode, keyword] = ['stem', raw.slice(5)];
  const trimmed = keyword.trim();
  if (mode === 'plain' && trimmed.length <= 3 && /^[a-z0-9]+$/i.test(trimmed)) mode = 'word';
  if (mode === 'plain') {
    const lower = keyword.toLowerCase();
    return (title) => title.toLowerCase().includes(lower);
  }
  const body = escapeRegExp(trimmed);
  const pattern =
    mode === 'word' ? `(^|[^\\p{L}\\p{N}])${body}($|[^\\p{L}\\p{N}])` : `(^|[^\\p{L}\\p{N}])${body}`;
  const re = new RegExp(pattern, 'iu');
  return (title) => re.test(title);
}

export function createJobFilter(config, today) {
  const include = (config.titles?.include ?? []).map(keywordMatcher);
  const exclude = (config.titles?.exclude ?? []).map(keywordMatcher);
  const places = (config.locations?.include ?? []).map((p) => p.toLowerCase());
  const maxAge = Number(config.maxPostingAgeDays) || null;
  const oldest = maxAge
    ? new Date(Date.parse(`${today}T12:00:00Z`) - maxAge * 86400000).toISOString().slice(0, 10)
    : null;

  return (job) => {
    if (!job.title || !job.link) return 'invalid';
    if (include.length && !include.some((m) => m(job.title))) return 'title';
    if (exclude.some((m) => m(job.title))) return 'title';
    if (places.length && job.locations.length) {
      const where = job.locations.join(' · ').toLowerCase();
      if (!places.some((p) => where.includes(p))) return 'location';
    }
    if (oldest && job.postedAt && job.postedAt < oldest) return 'age';
    return null;
  };
}

/* ---------- pipeline.md ---------- */

function cleanField(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

export function pipelineLine(job) {
  return [
    `- [ ] ${job.link}`,
    cleanField(job.company),
    cleanField(job.title),
    cleanField([...new Set(job.locations)].join(' · ')),
    `posted: ${job.postedAt ?? 'unknown'}`,
    `via: ${job.source}`,
  ].join(' | ');
}

function companyTitleKey(company, title) {
  const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return `${norm(company)}|${norm(title)}`;
}

function linkKey(link) {
  const board = parseBoardLink(link);
  return board ? `${board.boardKey}#${board.jobId}` : String(link).trim();
}

/** Rows already in pipeline.md (Pending and Processed), for de-duplication. */
export function readPipelineRows(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^- \[[ x]\]\s+(https?:\/\/\S+)(?:\s*\|\s*([^|]*))?(?:\s*\|\s*([^|]*))?/i);
    if (!m) continue;
    rows.push({ link: m[1], company: (m[2] ?? '').trim(), title: (m[3] ?? '').trim(), pending: line.startsWith('- [ ]') });
  }
  return rows;
}

/** Insert new rows at the end of the `## Pending` section (before `## Processed`). */
export function insertPendingRows(text, lines) {
  if (!lines.length) return text;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const all = text.split(/\r?\n/);
  const processedIdx = all.findIndex((l) => /^##\s+Processed/i.test(l));
  if (processedIdx === -1) {
    const base = text.trimEnd();
    const header = /^##\s+Pending/im.test(base) ? '' : `${eol}${eol}## Pending${eol}`;
    return `${base}${header}${eol}${lines.join(eol)}${eol}`;
  }
  let insertAt = processedIdx;
  while (insertAt > 0 && all[insertAt - 1].trim() === '') insertAt -= 1;
  all.splice(insertAt, 0, ...lines);
  return all.join(eol);
}

/* ---------- Scan ---------- */

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function createFetchJson(fetchImpl = globalThis.fetch) {
  return async (url) => {
    const res = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': 'ArohaFlow-Discovery/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
}

/**
 * Fetch every source, filter, de-duplicate against the pipeline, and judge liveness.
 * Pure over `fetchJson`; file IO lives in runDiscoveryScan.
 *
 * Liveness is conservative: a Pending row is `expired` only when its company board was read
 * successfully and the job is no longer on it; `open` when it is; otherwise `uncertain`.
 */
export async function scanJobs({ config, fetchJson, today, pipelineText, adzunaKeys }) {
  const accept = createJobFilter(config, today);
  const failed = [];
  const skipped = [];
  const jobs = [];
  const liveBoards = new Map(); // boardKey -> Set(jobId)

  const boards = await mapLimit(config.companies ?? [], CONCURRENCY, async (company) => {
    try {
      return { company, jobs: await fetchCompanyBoard(fetchJson, company) };
    } catch (err) {
      failed.push(`${company.name} (${err.message})`);
      return null;
    }
  });
  for (const board of boards) {
    if (!board) continue;
    const key = `${board.company.ats}:${String(board.company.slug).toLowerCase()}`;
    liveBoards.set(key, new Set(board.jobs.map((j) => j.jobId)));
    jobs.push(...board.jobs);
  }

  if (config.aggregators?.arbeitnow?.enabled) {
    try {
      jobs.push(...(await fetchArbeitnow(fetchJson)));
    } catch (err) {
      failed.push(`Arbeitnow (${err.message})`);
    }
  }

  const adzuna = config.aggregators?.adzuna;
  if (adzuna?.enabled) {
    if (!adzunaKeys?.appId || !adzunaKeys?.appKey) {
      skipped.push('Adzuna (set ADZUNA_APP_ID and ADZUNA_APP_KEY in .env.agent)');
    } else {
      try {
        jobs.push(
          ...(await fetchAdzuna(fetchJson, {
            ...adzunaKeys,
            countries: adzuna.countries ?? ['nl'],
            queries: adzuna.queries ?? ['AI engineer'],
            maxDaysOld: Number(config.maxPostingAgeDays) || 45,
          })),
        );
      } catch (err) {
        failed.push(`Adzuna (${err.message})`);
      }
    }
  }

  const existing = readPipelineRows(pipelineText);
  const seenLinks = new Set(existing.map((r) => linkKey(r.link)));
  const seenRoles = new Set(existing.map((r) => companyTitleKey(r.company, r.title)));

  const filtered = { title: 0, location: 0, age: 0, invalid: 0, duplicate: 0 };
  const added = [];
  for (const job of jobs) {
    const reason = accept(job);
    if (reason) {
      filtered[reason] += 1;
      continue;
    }
    const lk = linkKey(job.link);
    const rk = companyTitleKey(job.company, job.title);
    if (seenLinks.has(lk) || seenRoles.has(rk)) {
      filtered.duplicate += 1;
      continue;
    }
    seenLinks.add(lk);
    seenRoles.add(rk);
    added.push(job);
  }

  const liveness = {};
  const pendingLinks = [...existing.filter((r) => r.pending).map((r) => r.link), ...added.map((j) => j.link)];
  for (const link of pendingLinks) {
    const board = parseBoardLink(link);
    const ids = board ? liveBoards.get(board.boardKey) : null;
    liveness[link] = !ids ? 'uncertain' : ids.has(board.jobId) ? 'open' : 'expired';
  }

  const counts = Object.values(liveness).reduce((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
  return {
    added,
    liveness,
    summary: {
      companies: (config.companies ?? []).length,
      companiesRead: liveBoards.size,
      found: jobs.length,
      added: added.length,
      filtered,
      open: counts.open ?? 0,
      expired: counts.expired ?? 0,
      uncertain: counts.uncertain ?? 0,
      failed,
      skipped,
    },
  };
}

/**
 * File-backed scan over a career-data root: reads scan.json + data/pipeline.md, appends new
 * Pending rows, and writes data/liveness.json.
 */
export async function runDiscoveryScan({ root, fetchJson, clock, env = {} }) {
  const configPath = path.join(root, 'scan.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`No scan config at ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const pipelinePath = path.join(root, 'data', 'pipeline.md');
  const pipelineText = fs.existsSync(pipelinePath)
    ? fs.readFileSync(pipelinePath, 'utf8')
    : '# Pipeline\n\n## Pending\n\n## Processed\n';

  const result = await scanJobs({
    config,
    fetchJson,
    today: clock.todayDateKey(),
    pipelineText,
    adzunaKeys: { appId: env.ADZUNA_APP_ID, appKey: env.ADZUNA_APP_KEY },
  });

  fs.mkdirSync(path.dirname(pipelinePath), { recursive: true });
  fs.writeFileSync(pipelinePath, insertPendingRows(pipelineText, result.added.map(pipelineLine)));

  const summary = { scannedAt: clock.now().toISOString(), ...result.summary };
  fs.writeFileSync(
    path.join(root, 'data', 'liveness.json'),
    `${JSON.stringify({ checkedAt: summary.scannedAt, lastScan: summary, links: result.liveness }, null, 2)}\n`,
  );
  return summary;
}
