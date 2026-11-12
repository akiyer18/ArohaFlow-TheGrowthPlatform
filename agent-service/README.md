# Agent Service

Background tool facade for ArohaFlow (scheduler + MCP share this interface).

## Tools

- `listToday`
- `buildEmailDigest`
- `syncCalendar`
- `proposeDayPlan`
- `lockDayPlan`
- `unlockDayPlan`
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

Local entry uses memory Store + fake Google/LLM ports until live OAuth adapters land.

## Ports

Clock, Store, Gmail (read-only), LLM (email rank), Calendar read, Calendar write (ArohaFlow calendar only).

## Test

```bash
npm run agent:test
```

Primary seam: `createAgentService({ ...ports })`.
