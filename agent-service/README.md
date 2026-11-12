# Agent Service

Background tool facade for ArohaFlow (scheduler + MCP share this interface).

## Tools

- `listToday`
- `buildEmailDigest`
- `syncCalendar`
- `proposeDayPlan`
- `lockDayPlan`
- `logHabitCheckIn`
- `completeMicroaction`

## Ports

Clock, Store, Gmail (read-only), LLM (email rank), Calendar read, Calendar write (ArohaFlow calendar only).

## Test

```bash
npm run agent:test
```

Primary seam: `createAgentService({ ...ports })`.
