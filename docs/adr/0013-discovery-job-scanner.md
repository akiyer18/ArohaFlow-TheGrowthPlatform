# Discovery scans company boards itself instead of running career-ops

Discovery first read `data/pipeline.md` written by the career-ops CLI (#46). Keeping a 4,000-file clone beside the repo to refresh one list was the wrong trade: its one scan that fed Discovery added 6 jobs, all from Ashby and Greenhouse boards, and every listing showed "open" because nothing checked. **Decision:** the Agent Service scans job sources itself (`agent-service/src/discovery/`), writing to the same `career-data/` files, so career-ops is no longer needed.

## How it works

- Config: `career-data/scan.json` (git-ignored): company boards (`greenhouse` / `ashby` / `lever` + slug), title include/exclude keywords (career-ops syntax: plain substring, `word:`, `stem:`), location keywords, `maxPostingAgeDays`, and aggregators (Arbeitnow, free and keyless; Adzuna, free app key in `.env.agent`).
- Refresh (Discovery → **Refresh listings**, `POST /discovery/refresh`): fetch every source, filter, skip anything already in `pipeline.md` by link or by company + title (one row per job), append new Pending rows, write `data/liveness.json`.
- Liveness is conservative: a company board's API returns its complete list of open jobs, so a Pending row from a board that was read is `open` if listed and `expired` if not. Everything else (aggregator rows, hand-added rows, boards that failed) is `uncertain`. A false "expired" hides a real job; a false "uncertain" only asks the user to check.

## Consequences

- Button only; no scheduled scan.
- Not covered: careers pages that need a browser, other ATSes, LLM scoring. Startup discovery (lists of small Dutch AI companies) is a separate, later pipeline.
- Endpoint shapes follow career-ops (MIT); no code is copied.
