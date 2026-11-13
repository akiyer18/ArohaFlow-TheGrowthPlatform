# Agent Service

Background tool facade for ArohaFlow (scheduler + MCP share this interface).

## Tools

- `listToday`
- `buildEmailDigest`
- `syncCalendar`
- `proposeDayPlan`
- `lockDayPlan`
- `unlockDayPlan` (retracts Calendar Publish on Unlock)
- `editDayPlan`
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

## MCP

Stdio MCP server wraps the same facade (snake_case tool names for Cursor):

```bash
npm run agent:mcp
```

Tools: `sync_calendar`, `build_email_digest`, `propose_day_plan`, `lock_day_plan`, `log_habit_checkin`, `complete_microaction`, `list_today`.

## Ports

Clock, Store, Gmail (read-only), LLM (email rank), Calendar read, Calendar write (ArohaFlow calendar only).

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
