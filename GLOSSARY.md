# ArohaFlow

Personal operating system for one user's life data: the place data lives and where they look at it. A background Agent Service reads external sources, applies deterministic rules, writes results here, and notifies sparingly.

## Language

**ArohaFlow**:
The personal app where the user's life data is stored and reviewed.
_Avoid_: Flow OS, Dashboard OS (marketing only, not domain nouns)

**Agent Service**:
The server-side background worker that reads external sources on a schedule, applies rules (and later learned policies), writes into ArohaFlow's store, and pings only when it should.
_Avoid_: bot, AI assistant, MCP server (MCP is a client interface onto the Agent Service's tools, not the service itself)

**Store**:
The module the Agent Service and the OS UI use to read and write life data — Day Plans, Email Digest, Goals, Actions, Microactions, Applications, Habits (scheduled days + time anchors), Habit Check-ins, Daily Points, Calendar Events, Sender Allowlist, Agent Activity. Callers never speak PostgREST; Local/Supabase/in-memory fakes are adapters behind this interface.
_Avoid_: database, repository (OK internally), dataClient, supabase client

**Day Plan**:
An ordered set of Blocks for one calendar day, proposed by deterministic rules from Fixed Blocks, Calendar Events, and open Microactions, then confirmed or edited by the user. Carries Intention when locked. Edits are logged as future learning fuel; the agent does not silently rewrite a confirmed plan. Prefer locking tomorrow’s plan the evening before.
_Avoid_: schedule (ambiguous), timetable, agenda

**Locked Day Plan**:
A Day Plan whose Block layout and Intention are committed for that date. Rules will not reshuffle it; the user may Unlock to edit and re-publish. Habit Check-ins and Completions still work while Locked. Locking tomorrow the evening before yields a Plan-ready Completion on that day.
_Avoid_: frozen day, read-only day

**Block**:
A time-bounded segment of a Day Plan (e.g. gym, deep work, applications, wind-down) with a purpose and optional linked Microaction.
_Avoid_: event (reserved for Calendar Event), session (unless Flow Session)

**Fixed Block**:
A Block that recurs from the user's standing rhythm and is always present unless the user explicitly removes it for that day (e.g. morning gym, wind-down after 19:00).
_Avoid_: immovable habit (habit check-in is separate from the time Block)

**Flexible Block**:
A Block rules may place, resize, or reorder within the day's constraints when proposing a Day Plan (e.g. deep work on a Microaction, applications).
_Avoid_: optional block (flexible still appears; placement varies)

**Goal**:
A meaningful outcome the user is working toward over weeks or months (e.g. land a job, ship ArohaFlow as a daily driver). Goals contain Actions.
_Avoid_: dream, objective (OK in prose, not the entity name)

**Action**:
A substantial body of work under a Goal that takes many sessions (e.g. build ArohaFlow, finish a plugin, run the job-search campaign). Actions are broken into Microactions. Completing an Action earns a reward; starting it does not.
_Avoid_: project (synonym we reject to keep one noun), epic

**Microaction**:
A small, completable unit of work under an Action, sized to fit about a two-hour focus gap. It earns Daily Points only when marked complete — not for merely occupying a Block or running out the clock. May be opted into Calendar Publish when placed on a Day Plan.
_Avoid_: task (legacy module name; prefer Microaction in the new model), todo, subtask

**Calendar Publish**:
Opt-in write of a Day Plan Block / Microaction onto the dedicated ArohaFlow Google Calendar, usually the evening before, as part of locking tomorrow’s Day Plan.
_Avoid_: sync (sync is read of external Calendar Events; publish is write of plan Blocks)

**Completion**:
The only event that awards Daily Points: a Habit Check-in confirmed, a Microaction marked done, an Action closed as done, a Plan-ready Completion, or an Overachievement Completion. Time spent without Completion awards nothing.
_Avoid_: progress credit, partial points, time-box expiry reward

**Plan-ready Completion**:
A Completion granted at the start of a day when the user locked that day’s Day Plan the evening before (Intention + Blocks committed). Worth 10 Daily Points (ADR-0003). Absent lock ⇒ no Plan-ready Completion that day.
_Avoid_: show-up bonus, planning XP, time-credit

**Overachievement Completion**:
A Completion for surplus finished Microactions beyond the Locked Day Plan’s planned set. Awards Daily Points only when completed before 18:00 Europe/Amsterdam (work-window end, DST-aware); at or after 18:00 local the Microaction may still complete but grants no Overachievement points. Planned Completions keep normal weights at any hour (ADR-0002 / ADR-0003).
_Avoid_: overtime bonus, time-in-seat points

**Intention**:
One sentence stating the day’s purpose, written when locking the Day Plan. Read-only on Today until Unlock → edit → re-lock.
_Avoid_: motto, affirmation, daily theme (marketing)

**Habit Check-in**:
An explicit user signal that a standing habit was done today (e.g. pressing "went to gym"), at full or Minimum Version level. Distinct from the Fixed Block that reserved time for it. Awards Daily Points only on check-in: 10 full, 5 minimum (ADR-0010).
_Avoid_: completion (too generic alone), log (ambiguous with Habit Log in legacy code)

**Minimum Version**:
The smaller form of a habit that still keeps it on a bad day (Gym → "10-min walk"). Counts as kept for Rolling Consistency and the Weekly Grade; earns half the check-in points.
_Avoid_: fallback, cheat day, partial habit

**Rolling Consistency**:
Check-ins over a habit's scheduled days in the last 14 days ("11 of 12"). Unscheduled days, Season days and today before check-in do not count. A miss lowers it by one day; it never resets.
_Avoid_: streak, chain, success rate

**Season**:
A deliberate pause of a habit with a reason and end date (travel, sick, exam week). Season days cost nothing and earn nothing.
_Avoid_: freeze, skip, break

**Quiet habit**:
A habit with no check-in across its last 14 days and at least 3 scheduled days in that window. Shown apart, left out of the Weekly Grade, never called broken; one action picks it back up.
_Avoid_: broken, failed, lost streak

**Weekly Grade**:
The week's habit standing so far: kept scheduled days over scheduled days across habits that are not quiet. Locked in, Strong, Solid, Patchy or Reset (a fresh start, not a failure).
_Avoid_: score, rank, daily pass/fail

**Daily Points**:
The single explainable score earned today from Completions, counted toward the Daily Point Target.
_Avoid_: Effort, Momentum, Flow Score (legacy scoring names)

**Daily Point Target**:
The number of Daily Points the user aims to earn today — the "ring" to close.
_Avoid_: quota, XP goal

**Email Digest**:
The short list of emails matching Important Email rules, written into ArohaFlow for the user to review. Today shows a compact card (top 3–5 Important Emails with reasons) linking to the full digest.
_Avoid_: inbox mirror, all mail

**Important Email**:
A message that matches deterministic rules or comes from an address/domain on the Sender Allowlist (job-search, money/admin, university, and people the user has added). Not newsletters or bulk noise.
_Avoid_: starred (Gmail star may be a future signal, not the definition)

**Sender Allowlist**:
The user-maintained list of email addresses and domains whose mail is always treated as Important Email.
_Avoid_: contacts sync (not implied), VIP (marketing term)

**Application**:
A tracked job application the user is managing: company, role, stage, next step. Stages are Saved, Applied, Interviewing, Offer and Closed (with a reason: Rejected, Withdrawn, No reply, Accepted). Every stage move is recorded as a stage event. May link to Microactions under a job-search Action; the Application itself is the CRM record (ADR-0012).

**Next step** (Application):
The one dated thing to do next on an Application ("Send portfolio link", by Friday). Overdue and today's next steps lead the Applications screen.
_Avoid_: task, reminder

**Follow-up** (Application):
A nudge, not a failure: an Application waiting on the other side (Applied or Interviewing) with no dated next step and no stage move for 10 days.
_Avoid_: stale, dead, ghosted (as a state)
_Avoid_: job (too vague), opportunity (ambiguous)

**Discovery**:
The Applications OS section (and Agent Service tools) that surfaces job listings scanned from company boards and job sites (ADR-0013) — listings with scores, recency (posted or discovered), and liveness (open, expired, uncertain) — before the user explicitly promotes one onto the Applications board as Saved. Not auto-merged into the board; never submits to an ATS.
_Avoid_: inbox (career-ops file name), scrape results

**Startup** (Applications):
A small AI company in the Netherlands kept on the Startups list for an open application, after its own website confirmed it (ADR-0014): AI is core, Dutch HQ or office, 200 people or fewer, fit 3–5 with a reason. Saving one puts it on the Applications board as Saved, role "Open application".
_Avoid_: lead, prospect, target account

**Job Profile**:
A career-ops search archetype (target titles, locations, exclusions, attached CV) used when running Discovery. Kept as local config in `career-data/` (profile.yml, cv.md); ArohaFlow does not invent a second profile store in v1.
_Avoid_: persona, resume template

**CV Suggestion**:
Section-level and keyword guidance returned for a Discovery listing so the user can tailor their CV before applying. Guidance only — the human edits the CV; the Agent Service does not invent unverified experience or auto-write claims.
_Avoid_: rewrite, auto-tailor, ATS submit

**Today**:
The home execution board after login: Intention, Day Plan, Open next Microaction, explainable Daily Points / Daily Point Target / Streak, and a compact Email Digest card (top 3–5 Important Emails with reasons linking to the full digest). Meals appear only as planned Fixed Blocks. Not a place to invent Goals or review Agent Activity.
_Avoid_: dashboard (legacy hub of module cards), agent console

**Weekly Plan**:
A separate Saturday (or equivalent) flow where Goals are grilled into day-sized Actions and Microactions. The Agent Service proposes candidates via the LLM port; the user accepts, edits, and schedules. Nothing becomes must-do on Today until evening (or batch) lock.
_Avoid_: sprint planning (borrowed agile jargon as the surface name), backlog grooming

**Analytics**:
A weekly-review surface holding Agent Activity plus plan-versus-done, habit consistency, time per Goal, and application pipeline movement. Not the daily home.
_Avoid_: dashboard (legacy), insights hub (vague)

**Calendar View**:
The large, readable month/week surface for Calendar Events, Day Plan Blocks, and habit schedule anchors with a monthly habit heatmap — visual planning and habit consistency, not the triage home.
_Avoid_: Smart Calendar (legacy module name)

**Calendar Event**:
A timed commitment synced from Google Calendar (read-only into ArohaFlow). Day Plan rules schedule around it; it is not a Microaction.
_Avoid_: Block (Blocks are plan segments, not synced meetings)

**Streak**:
Retired from the UI by ADR-0010 in favour of Rolling Consistency and the Weekly Grade. Was: consecutive days the Daily Point Target was met, with one freeze per ISO week. The Agent Service `streak` tool remains until the Store carries check-in levels and Seasons.
_Avoid_: chain, combo, freeze

**Agent Activity**:
A human-readable log of what the Agent Service last did (syncs, digest size, Day Plan proposed). Lives on Analytics for weekly review — not on Today.
_Avoid_: chat history, AI thoughts

**More Tools**:
A secondary area for Journal, Knowledge Expansion, and other experimental tools — kept out of the primary OS loop but available when needed. New tools can be tried here before earning a primary nav slot. Does not include Task Manager or Flow Mode.
_Avoid_: legacy dump, settings, lab (OK informally)

**Legacy**:
Old surfaces retained in the codebase but not offered in primary nav or More Tools (Task Manager, Flow Mode). Not part of the daily OS path.
_Avoid_: deprecated folder name as UX label

**Active Action**:
An Action currently in progress, counting toward the WIP limit (max three). Parking or completing an Action frees a slot.
_Avoid_: open project

**Active Microaction**:
The single Microaction currently in progress on Today. At most one at a time; starting another requires completing or parking the current one (park needs a short reason).
_Avoid_: current task, focus item (vague)

**Income** (Money):
Sum of income transactions in the selected calendar month on the Money module overview.
_Avoid_: cash in, deposits (bank CSV dialect)

**Spent** (Money):
Sum of expense transactions in the selected calendar month on the Money module overview.
_Avoid_: outflow, burn (informal)

**Planned** (Money):
Sum of planned expense costs whose target date falls in the selected calendar month.
_Avoid_: budget total (ambiguous with category budgets)

**Saved** (Money):
Income minus Spent for the selected calendar month on the Money glance.
_Avoid_: net worth, balance (account balance is separate)

**Needs** (Money):
Spend bucket for essentials (bills, groceries, transport, rent). Part of the editable Needs / Wants / Future split; default target 50% of Income.
_Avoid_: fixed costs (too narrow)

**Wants** (Money):
Spend bucket for discretionary lifestyle (entertainment, shopping, dining). Default target 40% of Income when Future is 10%.
_Avoid_: nice-to-haves (informal only)

**Future** (Money):
Savings / buffer / own-account transfer bucket. Default target 10% of Income (Nibud-informed).
_Avoid_: investments portfolio (out of scope)

**Buffer** (Money):
User-set emergency savings goal with progress against the **Savings** account balance (Nibud BufferBerekenaar-informed framing). Separate from months-of-expenses Runway.
_Avoid_: rainy-day fund (OK in prose), net worth

**Runway** (Money):
Months of expenses covered by Savings (`savings balance / Spent` for the selected month). Plan Runway after a suggested transfer uses Savings-after-transfer / month plan total. Shown beside Buffer, not as the Buffer progress itself.
_Avoid_: burn rate (startup jargon)

**Spending account** (Money):
The day-to-day account (type `spending` / checking) funded for the month’s plan.
_Avoid_: current account only (OK as bank label)

**Savings account** (Money):
The buffer / reserve account (type `savings`). Source of month-start transfers into Spending; Buffer progress reads this balance.
_Avoid_: investment account

**Transfer suggestion** (Money):
Month-start amount to move from Savings → Spending: month plan total (rent + planned categories + annual costs / 12 + monthly budget lines) minus Spending balance. Zero or less means no transfer. Reports Savings after transfer, Buffer warning, and plan Runway.
_Avoid_: auto-transfer (suggestion only)
