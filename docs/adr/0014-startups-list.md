# Startups: verify every company on its own website before listing it

The goal is a list of small AI companies in the Netherlands to send an open application to, including ones with no posted vacancy. Search results and directories are noisy: list articles mix in investors, corporates and agencies, and an LLM asked "is this a Dutch AI startup?" from a snippet will guess. **Decision:** a two-step pipeline where search only proposes names and the company's own website decides.

## Pipeline (`agent-service/src/startups/`)

1. **Candidates (recall):** active YC companies with a Netherlands location (yc-oss, free), plus Tavily searches (funding news, cities, "AI startups in the Netherlands" lists). An LLM extracts company names from the search text and is told not to invent any.
2. **Website:** taken from the source, or found with one Tavily lookup. A domain is accepted only if it is not a directory/news/social site and plausibly matches the company name.
3. **Verify (precision):** read the homepage plus one careers and one about/contact page, respecting `robots.txt`. The LLM judges from that text only and answers "unknown" when the site does not show something.
4. **Gate in code:** keep only when the site is the company's own, it is in the Netherlands (HQ or office), AI is core, it is an AI product or AI services company (not a recruiter, investor, media, education or corporate), it has 200 people or fewer, and fit ≥ `minFit` (default 3).

## Consequences

- Kept companies show fit (1–5) with a one-sentence reason grounded in the site, careers page, and up to three **role-based** emails published on the company's own domain (jobs@, careers@, hello@, info@…). Named people's addresses are never collected.
- Greenhouse/Ashby/Lever boards found on kept sites are added to `scan.json`, so their vacancies reach Discovery.
- Every checked company is remembered in `career-data/data/startups.json`; kept ones are never re-checked, rejected/unreachable ones only after `recheckAfterDays` (60). Each run checks at most `maxNewPerRun` (30) new companies, most-mentioned first, to bound Tavily credits (about 25–55 per run) and LLM calls.
- LLM: any OpenAI-compatible endpoint with strict JSON schema output; Grok by default (`GROK_API_KEY`, `GROK_MODEL`), or `STARTUPS_LLM_PROVIDER=openai` with `OPENAI_API_KEY` + `OPENAI_MODEL`. A rejected key stops the run before anything is stored.
- Not in scope: drafting or sending email, recruiters, named contacts, LinkedIn.
