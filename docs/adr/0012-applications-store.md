# Applications: a stage board with next steps, stored per user

The job search is a primary destination (ADR-0004), and the useful question each day is "what do I owe whom, and by when", not a list of statuses. An unmerged draft (feature/os-ui-shell-13) stored `company, role_title, link, notes, status` in an `agent_applications` table with no owner or RLS; it never held rows. **Decision:** replace it with the Habits Store pattern (ADR-0011): `agent_applications` plus `agent_application_events`, owned by `user_id` (default `auth.uid()`), RLS per user, read and written by the web app directly and by the Agent Service with the service role.

## Rules (src/modules/applications/rules.js, shared by the web app and the Agent Service)

- Stages: saved, applied, interviewing, offer, closed. Closing needs a reason (Rejected, Withdrawn, No reply, Accepted) and clears the next step; reopening clears the reason. Moving to applied stamps `applied_on` once.
- Every move writes a stage event; "moved this week" counts Applications with an event since Monday.
- Next step state: overdue, today, soon (within 3 days), later.
- Follow-up: Applied or Interviewing, no dated next step, no move for 10 days. Shown as a nudge.

## Consequences

- `database/applications-store.sql` drops the draft table only while it is empty, then creates the new tables. The draft branch's UI is superseded; its Goals page, Allowlist page and Agent HTTP bridge stay candidates for later screens.
- Agent Service tools: `list_applications`, `add_application`, `move_application`, `set_application_next_step` (MCP).
- Not yet: linking an Application to the job-search Action and its Microactions (lands with Goals), drag between columns, and Analytics reading real pipeline movement instead of its fixture.
