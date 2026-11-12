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
The module the Agent Service (and later the OS UI) uses to read and write life data — Day Plans, Email Digest, Goals, Actions, Microactions, Applications, Habit Check-ins, Daily Points, Calendar Events, Sender Allowlist, Agent Activity. Callers never speak PostgREST; Local/Supabase/in-memory fakes are adapters behind this interface.
_Avoid_: database, repository (OK internally), dataClient, supabase client

**Day Plan**:
An ordered set of Blocks for one calendar day, proposed by deterministic rules from Fixed Blocks, Calendar Events, and open Microactions, then confirmed or edited by the user. Edits are logged as future learning fuel; the agent does not silently rewrite a confirmed plan. Prefer locking tomorrow’s plan the evening before.
_Avoid_: schedule (ambiguous), timetable, agenda

**Locked Day Plan**:
A Day Plan whose Block layout is committed for that date. Rules will not reshuffle it; the user may Unlock to edit and re-publish. Habit Check-ins and Completions still work while Locked.
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
The only event that awards Daily Points: a Habit Check-in confirmed, a Microaction marked done, or an Action closed as done. Time spent without Completion awards nothing.
_Avoid_: progress credit, partial points, time-box expiry reward

**Habit Check-in**:
An explicit user signal that a standing habit was done today (e.g. pressing "went to gym"). Distinct from the Fixed Block that reserved time for it. Awards Daily Points only on check-in.
_Avoid_: completion (too generic alone), log (ambiguous with Habit Log in legacy code)

**Daily Points**:
The single explainable score earned today from Completions, counted toward the Daily Point Target.
_Avoid_: Effort, Momentum, Flow Score (legacy scoring names)

**Daily Point Target**:
The number of Daily Points the user aims to earn today — the "ring" to close.
_Avoid_: quota, XP goal

**Email Digest**:
The short list of emails matching Important Email rules, written into ArohaFlow for the user to review.
_Avoid_: inbox mirror, all mail

**Important Email**:
A message that matches deterministic rules or comes from an address/domain on the Sender Allowlist (job-search, money/admin, university, and people the user has added). Not newsletters or bulk noise.
_Avoid_: starred (Gmail star may be a future signal, not the definition)

**Sender Allowlist**:
The user-maintained list of email addresses and domains whose mail is always treated as Important Email.
_Avoid_: contacts sync (not implied), VIP (marketing term)

**Application**:
A tracked job application the user is managing (company, role, status, next step). May link to Microactions under a job-search Action; the Application itself is the CRM record.
_Avoid_: job (too vague), opportunity (ambiguous)

**Today**:
The home surface: Day Plan, Email Digest, Habit Check-ins, Daily Points progress, Streak, and Agent Activity.
_Avoid_: dashboard (legacy hub of module cards)

**Calendar View**:
The large, readable month/week surface for Calendar Events and Day Plan Blocks — visual planning, not the triage home.
_Avoid_: Smart Calendar (legacy module name)

**Calendar Event**:
A timed commitment synced from Google Calendar (read-only into ArohaFlow). Day Plan rules schedule around it; it is not a Microaction.
_Avoid_: Block (Blocks are plan segments, not synced meetings)

**Streak**:
Count of consecutive days the Daily Point Target was met. One freeze per week may preserve the Streak without a Completion day.
_Avoid_: chain, combo

**Agent Activity**:
A human-readable log of what the Agent Service last did (syncs, digest size, Day Plan proposed) so the user always knows what happened.
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
