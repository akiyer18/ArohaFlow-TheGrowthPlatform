/**
 * LLM steps for the Startups list, with the keep/reject gate applied in code.
 * 1. extractCandidates: company names from search results (recall; verified later).
 * 2. judgeCompany: verdict from the company's OWN website text (precision).
 */

const MAX_RESULT_CHARS = 7000;

const CANDIDATES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['companies'],
  properties: {
    companies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'website', 'city', 'oneLiner'],
        properties: {
          name: { type: 'string' },
          website: { type: 'string', description: 'Company website if it appears in the text, else ""' },
          city: { type: 'string', description: 'Dutch city if stated, else ""' },
          oneLiner: { type: 'string', description: 'What the company does, max 15 words' },
        },
      },
    },
  },
};

const EXTRACT_SYSTEM = `You extract companies from web search results for a job seeker in the Netherlands.
List every company the text presents as a startup or scale-up that (a) is based in, or has an office in, the Netherlands and (b) builds AI or machine learning as a core part of its product or services.
Exclude: investors, VC funds, accelerators, incubators, universities, research institutes, government bodies, news sites, the publishing website itself, recruitment agencies, job boards, directories, and large corporates (over ~500 employees, e.g. ASML, Booking.com, Philips, Adyen).
Use only names that appear in the text; never invent companies. Give a website only when it appears in the text. If none qualify, return an empty list.`;

/**
 * @param {{ json: Function }} llm
 * @param {{ query: string, results: Array<{ url: string, title: string, content: string }> }} batch
 */
export async function extractCandidates(llm, { query, results }) {
  if (!results.length) return [];
  const user = [
    `Search query: ${query}`,
    ...results.map(
      (r, i) => `--- Result ${i + 1}: ${r.title} (${r.url})\n${String(r.content).slice(0, MAX_RESULT_CHARS)}`,
    ),
  ].join('\n\n');
  const out = await llm.json({ system: EXTRACT_SYSTEM, user, name: 'candidates', schema: CANDIDATES_SCHEMA });
  return (out?.companies ?? [])
    .map((c) => ({ ...c, name: String(c.name ?? '').trim() }))
    .filter((c) => c.name.length > 1);
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isOperatingCompany', 'netherlands', 'aiIsCore', 'kind', 'size', 'city',
    'whatTheyDo', 'fit', 'reason', 'hiringSignals',
  ],
  properties: {
    isOperatingCompany: { type: 'boolean', description: 'The site is this company\'s own, active website' },
    netherlands: { type: 'string', enum: ['headquarters', 'office', 'no', 'unknown'] },
    aiIsCore: { type: 'boolean', description: 'AI/ML is central to what they build or deliver, not a marketing add-on' },
    kind: {
      type: 'string',
      enum: ['ai-product', 'ai-services', 'recruiter', 'investor', 'media', 'education', 'corporate', 'other'],
    },
    size: { type: 'string', enum: ['1-10', '11-50', '51-200', '201-500', '500+', 'unknown'] },
    city: { type: 'string', description: 'Dutch city of the HQ or office, else ""' },
    whatTheyDo: { type: 'string', description: 'Plain description, max 20 words' },
    fit: { type: 'integer', minimum: 1, maximum: 5 },
    reason: { type: 'string', description: 'One sentence citing evidence from the site for the fit score' },
    hiringSignals: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short quotes/facts from the site: open roles, "we are hiring", recent funding, team growth',
    },
  },
};

function judgeSystem(targetRoles) {
  return `You assess whether a company is a good target for an unsolicited open application (CV by email) from an early-career engineer in the Netherlands looking for roles like: ${targetRoles.join(', ')}.
Judge ONLY from the website text provided; answer "unknown" or false when the text does not show it. Do not use outside knowledge to fill gaps.
fit (1-5):
5 = small/medium Dutch AI company with visible engineering hiring (open roles, "we're hiring", recent funding);
4 = small/medium Dutch AI company that is clearly building and likely to grow, no visible openings;
3 = AI is core, but hiring seems unlikely or the company is very early/unclear;
2 = AI is peripheral to the business;
1 = not relevant (not AI, not in NL, not a company, or a recruiter/investor/media site).`;
}

/**
 * @param {{ json: Function }} llm
 * @param {{ name: string, site: { website: string, text: string, careersUrl: string | null, emails: string[] }, sourceNotes: string[], targetRoles: string[] }} input
 */
export async function judgeCompany(llm, { name, site, sourceNotes, targetRoles }) {
  const user = [
    `Company: ${name}`,
    `Website: ${site.website}`,
    site.careersUrl ? `Careers page: ${site.careersUrl}` : 'Careers page: none found',
    sourceNotes.length ? `How it was found (unverified): ${sourceNotes.join(' | ')}` : '',
    '',
    site.text,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return llm.json({ system: judgeSystem(targetRoles), user, name: 'verdict', schema: VERDICT_SCHEMA });
}

/**
 * The gate, in code: the model describes, the rules decide.
 * @returns {{ keep: boolean, reason: string | null }}
 */
export function gateVerdict(v, { minFit = 3 } = {}) {
  if (!v?.isOperatingCompany) return { keep: false, reason: 'not an operating company site' };
  if (!['headquarters', 'office'].includes(v.netherlands)) return { keep: false, reason: 'not based in the Netherlands' };
  if (!v.aiIsCore) return { keep: false, reason: 'AI is not core' };
  if (!['ai-product', 'ai-services'].includes(v.kind)) return { keep: false, reason: `kind: ${v.kind}` };
  if (['201-500', '500+'].includes(v.size)) return { keep: false, reason: `too large (${v.size})` };
  if (!(v.fit >= minFit)) return { keep: false, reason: `fit ${v.fit} below ${minFit}` };
  return { keep: true, reason: null };
}
