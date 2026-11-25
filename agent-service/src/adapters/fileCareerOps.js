import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PENDING_LINE =
  /^- \[ \]\s+(https?:\/\/\S+)(?:\s*\|\s*([^|]+))?(?:\s*\|\s*([^|]+))?(?:\s*\|\s*([^|]+))?(?:\s*\|\s*(.*))?$/;

const TARGET_ROLE_HINTS = [
  'junior ai',
  'forward deployed',
  'graduate',
  'applied ai',
  'ml engineer',
  'llm',
  'ai engineer',
  'ai / ml',
];

const SENIORITY_PENALTY = /\b(lead|senior|staff|principal|director|head)\b/i;
const PREFERRED_LOC = /\b(netherlands|amsterdam|holland|nl)\b/i;
const NEAR_LOC = /\b(germany|belgium|munich|berlin|brussels|antwerp)\b/i;
const OTHER_COUNTRY_ONLY =
  /\b(united kingdom|london|ireland|spain|france|italy|poland|remote)\b/i;

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {string} cwd
 * @returns {string | null}
 */
export function resolveCareerOpsRoot(env, cwd = process.cwd()) {
  const fromEnv = env.CAREER_OPS_ROOT || env.CAREER_OPS_DATA_DIR;
  if (fromEnv && String(fromEnv).trim()) {
    return path.resolve(String(fromEnv).trim());
  }

  const candidates = [path.join(cwd, 'career-data')];
  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'data', 'pipeline.md')) ||
      fs.existsSync(path.join(candidate, 'cv.md'))
    ) {
      return candidate;
    }
  }
  return null;
}

function listingIdFor(link) {
  const hash = crypto.createHash('sha1').update(link).digest('hex').slice(0, 12);
  return `job-co-${hash}`;
}

function parsePostedAt(rest) {
  const match = String(rest || '').match(/posted:\s*(\d{4}-\d{2}-\d{2})/i);
  return match ? match[1] : null;
}

function parsePendingLine(line) {
  const match = line.match(PENDING_LINE);
  if (!match) return null;
  const link = match[1].trim();
  const company = (match[2] || '').trim() || 'Unknown';
  const roleTitle = (match[3] || '').trim() || 'Role';
  const location = (match[4] || '').trim();
  const rest = (match[5] || '').trim();
  const postedAt = parsePostedAt(`${location} | ${rest}`);
  const description = [location, rest].filter(Boolean).join(' · ');
  return { link, company, roleTitle, description, postedAt, location, rest };
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function readPrimaryRoles(profileText) {
  const roles = [];
  const block = profileText.match(/primary:\s*\n((?:\s*-\s*.+\n?)+)/i);
  if (block) {
    for (const line of block[1].split('\n')) {
      const m = line.match(/-\s*["']?(.+?)["']?\s*$/);
      if (m) roles.push(m[1].trim().toLowerCase());
    }
  }
  return roles;
}

function preferenceScore({ roleTitle, location, rest, primaryRoles }) {
  const title = roleTitle.toLowerCase();
  const loc = `${location} ${rest}`.toLowerCase();
  let score = 3.2;

  const roleHints = [...TARGET_ROLE_HINTS, ...primaryRoles];
  if (roleHints.some((hint) => hint && title.includes(hint))) score += 0.9;
  if (/\b(junior|graduate|associate|intern|entry)\b/i.test(roleTitle)) score += 0.4;
  if (SENIORITY_PENALTY.test(roleTitle) && !/\bjunior\b/i.test(roleTitle)) score -= 1.1;

  if (PREFERRED_LOC.test(loc)) score += 0.7;
  else if (NEAR_LOC.test(loc)) score += 0.25;
  else if (OTHER_COUNTRY_ONLY.test(loc) && !PREFERRED_LOC.test(loc) && !NEAR_LOC.test(loc)) {
    score -= 0.8;
  }

  if (/yrs:\s*6\+|yrs:\s*\d+\/6\+/i.test(rest)) score -= 0.5;

  return Math.max(1, Math.min(5, Math.round(score * 10) / 10));
}

function extractSkillKeywords(cvText) {
  const skillsHeading = cvText.match(/##\s*[^\n]*Skills[^\n]*\n([\s\S]*?)(?:\n##\s|$)/i);
  const blob = skillsHeading ? skillsHeading[1] : cvText.slice(0, 2000);
  const tokens = blob
    .split(/[\n,;/|]+/)
    .map((t) => t.replace(/[*_`#-]/g, '').trim())
    .filter((t) => t.length >= 3 && t.length <= 40)
    .slice(0, 40);
  return [...new Set(tokens.map((t) => t.toLowerCase()))];
}

function buildCvSuggestions(listing, cvText) {
  const skills = extractSkillKeywords(cvText);
  const titleWords = listing.roleTitle
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((w) => w.length > 2);
  const matched = skills.filter((skill) =>
    titleWords.some((w) => skill.includes(w) || w.includes(skill.split(/\s+/)[0])),
  );

  const keywords = (matched.length ? matched : skills.slice(0, 4)).slice(0, 5).map((keyword) => ({
    keyword,
    experienceHint: `Use wording already in your CV around “${keyword}” when tailoring bullets.`,
  }));

  const sections = [
    {
      section: 'experience',
      suggestion:
        matched.length > 0
          ? `Lead with evidence for ${matched.slice(0, 2).join(' / ')} against “${listing.roleTitle}”.`
          : `Mirror the posting’s language for “${listing.roleTitle}” using only facts already in cv.md.`,
    },
  ];

  if (/forward deployed|consultant|client/i.test(listing.roleTitle)) {
    sections.push({
      section: 'summary',
      suggestion:
        'Emphasize client-facing delivery and translating requirements into shipped AI/backend work.',
    });
  }

  return {
    listingId: listing.id,
    sections,
    keywords,
  };
}

/**
 * Local career-ops file adapter: Discovery reads `data/pipeline.md` Pending rows.
 * Does not call live ATS networks or LLMs — scan/evaluate stay in career-ops.
 *
 * @param {{ root: string, clock: { todayDateKey(): string, now(): Date } }} options
 */
export function createFileCareerOps({ root, clock }) {
  const pipelinePath = path.join(root, 'data', 'pipeline.md');
  const profilePath = path.join(root, 'config', 'profile.yml');
  const cvPath = path.join(root, 'cv.md');

  function loadListings() {
    const pipeline = readText(pipelinePath);
    const profile = readText(profilePath);
    const primaryRoles = readPrimaryRoles(profile);
    const discoveredAt = clock.todayDateKey();

    /** @type {Map<string, import('../ports/careerOps.js').CareerOpsListing>} */
    const byLink = new Map();

    for (const line of pipeline.split(/\r?\n/)) {
      if (!line.startsWith('- [')) continue;
      // Only Pending section items before ## Processed
      const pending = parsePendingLine(line);
      if (!pending) continue;
      if (byLink.has(pending.link)) continue;

      const id = listingIdFor(pending.link);
      const score = preferenceScore({
        roleTitle: pending.roleTitle,
        location: pending.location,
        rest: pending.rest,
        primaryRoles,
      });

      byLink.set(pending.link, {
        id,
        company: pending.company,
        roleTitle: pending.roleTitle,
        link: pending.link,
        description: pending.description || pending.roleTitle,
        score,
        postedAt: pending.postedAt,
        discoveredAt,
        liveness: 'open',
      });
    }

    return [...byLink.values()];
  }

  return {
    async searchListings(_input = {}) {
      return loadListings().map((l) => ({ ...l }));
    },

    async getListing(listingId) {
      return loadListings().find((l) => l.id === listingId) ?? null;
    },

    async suggestCv(listingId) {
      const listing = await this.getListing(listingId);
      if (!listing) {
        return { listingId, sections: [], keywords: [] };
      }
      return buildCvSuggestions(listing, readText(cvPath));
    },
  };
}
