# Startups: verify every company on its own website before listing it

The goal is a list of small AI companies in the Netherlands to send an open application to, including ones with no posted vacancy. Search results and directories are noisy: list articles mix in investors, corporates and agencies, and an LLM asked "is this a Dutch AI startup?" from a snippet will guess. **Decision:** a two-step pipeline where search only proposes names and the company's own website decides.

## Pipeline (`agent-service/src/startups/`)

1. **Candidates (recall):** active YC companies with a Netherlands location (yc-oss, free), plus Tavily searches (funding news, cities, "AI startups in the Netherlands" lists). An LLM extracts company names from the search text and is told not to invent any.
2. **Website:** taken from the source; else the obvious domains are tried (`name.com/.ai/.io/.nl/.co`, accepted only if `robots.txt` allows it, the homepage names the company, it is not parked, and it shows a Dutch link); else one Tavily lookup that excludes directory/news/social sites. A domain is accepted only if it plausibly matches the company name.
3. **Verify (precision):** read the homepage plus one careers and one about/contact page, respecting `robots.txt`. The LLM judges from that text only and answers "unknown" when the site does not show something.
4. **Gate in code:** keep only when the site is the company's own, it is in the Netherlands (HQ or office; for a YC company whose site does not say, the YC directory's location counts), AI is core (the product is built on ML/AI models, not deep-tech, VR or software that merely mentions AI), it is an AI product or AI services company (not a recruiter, investor, media, education or corporate), it has 200 people or fewer, and fit ≥ `minFit` (default 3).

## Consequences

- Kept companies show fit (1–5) with a one-sentence reason grounded in the site, careers page, and up to three **role-based** emails published on the company's own domain (jobs@, careers@, hello@, info@…). Named people's addresses are never collected.
- Greenhouse/Ashby/Lever boards found on kept sites are added to `scan.json`, so their vacancies reach Discovery.
- Every checked company is remembered in Supabase (`agent_startups`, agent-only like the other `agent_*` tables; see `database/startups-store.sql`), so the list survives across laptops and is never searched again. Without Supabase env it stays in `career-data/data/startups.json`, which is also imported into an empty table on first load. Kept ones are never re-checked, rejected/unreachable ones only after `recheckAfterDays` (60), and "website not found" after 7 days, since that is usually the lookup failing rather than the company. Each run checks at most `maxNewPerRun` (30) new companies, most-mentioned first, to bound Tavily credits (about 25–55 per run) and LLM calls.
- LLM: any OpenAI-compatible endpoint with strict JSON schema output; OpenAI by default (`OPENAI_API_KEY`, `OPENAI_MODEL` default `gpt-4.1-mini`), Grok when only `GROK_API_KEY` is set or `STARTUPS_LLM_PROVIDER=grok`. Keys live in `.env` only, never in the database. A rejected key stops the run before anything is stored.
- Not in scope: drafting or sending email, recruiters, named contacts, LinkedIn.
