# Agent Service

Background tool facade for ArohaFlow (scheduler + MCP share this interface).

## Tools

- `listToday` (Intention, Active/next Microaction, `pointsExplanation`, Plan-ready grant)
- `buildEmailDigest`
- `syncCalendar`
- `proposeDayPlan`
- `proposeWeeklyPlan` (LLM candidates; not auto-committed)
- `editWeeklyPlan` / `acceptWeeklyPlan` / `scheduleMicroaction` / `getWeeklyPlanProposal` (candidates → Goals → Day Plan; no auto-lock; max 5 Microactions/day)
- `upsertGoal` / `upsertAction` / `upsertMicroaction` (Goals authoring; max 3 Active Actions)
- `upsertHabit` / `listHabits` / `listCalendarView` (schedule + time anchor; habit consistency skips unscheduled days)
- `assessDayPlanOvercommit` (Flexible Blocks vs work-window)
- `lockDayPlan` (optional Intention; records `lockedAt`; requires `acknowledgeOvercommit` when overcommitted)
- `unlockDayPlan` (retracts Calendar Publish on Unlock)
- `editDayPlan`
- `startMicroaction` / `parkMicroaction` (one Active Microaction)
- `logHabitCheckIn`
- `completeMicroaction`
- `completeAction`
- `evaluateStreak`
- `runMorningCadence` / `runEveningCadence`

## Cadence

Morning prepares Today (`sync` → digest → propose today). Evening (~17:30) refreshes digest/calendar and proposes **tomorrow** without locking.

```bash
npm run agent:cadence -- morning
npm run agent:cadence -- evening
npm run agent:start
```

Facade methods `runMorningCadence` / `runEveningCadence` own the cadence; `createScheduler` + `createSchedulerLoop` are the process timer. Agent Activity includes a `scheduled_run` rollup.

## HTTP bridge (OS UI)

Daily driver (Agent HTTP + Vite together):

```bash
npm run dev:os
```

`npm run agent:start` alone also serves a **loopback-only** JSON API for the Vite OS shell (`127.0.0.1:8787` by default). Set in `.env.agent`:

```bash
AROHAFLOW_AGENT_HTTP_HOST=127.0.0.1
AROHAFLOW_AGENT_HTTP_PORT=8787
AROHAFLOW_AGENT_HTTP_CORS=http://localhost:5173
```

In the Vite `.env` (documented in `.env.example`; never put service-role keys in `VITE_*`):

```bash
VITE_AGENT_HTTP_URL=http://127.0.0.1:8787
```

Routes map onto facade methods (`/today`, `/calendar-view`, `/goals`, `/actions`, `/microactions`, `/weekly-plan`, `/habits`, `/applications`, `/allowlist`, lock/complete/schedule helpers). Non-loopback bind is rejected. Without `VITE_AGENT_HTTP_URL`, the OS UI keeps portfolio fixtures.

## Discovery job scanner (ADR-0013)

Discovery reads a git-ignored `career-data/` folder (or `CAREER_OPS_ROOT`):

```text
career-data/
  scan.json          companies (greenhouse | ashby | lever + slug), title/location keywords, maxPostingAgeDays, aggregators
  cv.md              CV suggestions
  config/profile.yml target roles for scoring
  data/pipeline.md   Pending job rows (the scanner appends here)
  data/liveness.json open / expired / uncertain per Pending row (written by each refresh)
```

**Refresh listings** in Discovery (`POST /discovery/refresh`) fetches every source, filters, appends new rows and re-checks liveness. Arbeitnow needs no key; Adzuna is skipped unless `.env.agent` has `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` (free at developer.adzuna.com). Without `career-data/`, Discovery shows demo listings.

## Startups list (ADR-0014)

**Find startups** in Applications → Startups (`POST /startups/refresh`) proposes small Dutch AI companies from the YC directory and Tavily search, verifies each on its own website, and keeps those that pass the gate. Results: `career-data/data/startups.json`; settings: `scan.json` → `startups` (searches, targetRoles, minFit, maxNewPerRun, recheckAfterDays).

Env (`.env` or `.env.agent`): `TAVILY_KEY`, and `GROK_API_KEY` (optional `GROK_MODEL`, default `grok-4.7`). To use OpenAI instead: `STARTUPS_LLM_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`.

## MCP

Stdio MCP server wraps the same facade (snake_case tool names for Cursor):

```bash
npm run agent:mcp
```

Tools: `sync_calendar`, `build_email_digest`, `propose_day_plan`, `lock_day_plan`, `log_habit_checkin`, `complete_microaction`, `list_today`.

## Ports

Clock, Store, Gmail (read-only), LLM (email rank + Weekly Plan propose), Calendar read, Calendar write (ArohaFlow calendar only).

### Store

- Memory: default for unit tests
- Supabase: set `AROHAFLOW_SUPABASE_URL` + `AROHAFLOW_SUPABASE_SERVICE_ROLE_KEY`, apply `database/agent-service-schema.sql`

### Google OAuth (Agent Service only)

Tokens never go in the Vite client. Put credentials in `.env.agent`:

```bash
AROHAFLOW_GOOGLE_CLIENT_ID=...
AROHAFLOW_GOOGLE_CLIENT_SECRET=...
AROHAFLOW_GOOGLE_REFRESH_TOKEN=...
# optional if the calendar id is not discoverable by name:
# AROHAFLOW_GOOGLE_CALENDAR_ID=...
```

One-time consent (creates refresh token):

```bash
npm run agent:oauth
```

Create a Google Calendar named **ArohaFlow** for Calendar Publish (or set `AROHAFLOW_GOOGLE_CALENDAR_ID`). Scopes: Gmail read-only + Calendar events + calendar list read.

Cadence/MCP use `createStoreFromEnv()` + `createGooglePortsFromEnv()` so both share durable Store and live Google when configured.

## Test

```bash
npm run agent:test
```

Primary seam: `createAgentService({ ...ports })`.

## Email Digest eval (not default unit suite)

```bash
npm run agent:eval:digest
```

Labelled fixtures live in `agent-service/eval/digest/fixtures/`. Extend with real inbox examples as you label them.
