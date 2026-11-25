# One Habits Store: agent_habits and agent_habit_checkins

Habits lived in two places: the legacy Habit Tracker's per-user `habits` / `habit_logs` (read by the web app) and the Agent Service's `agent_habits` / `agent_habit_checkins` (read by the agent, no owner, no RLS). Two sources meant two truths for the same check-in. **Decision:** the Agent Store tables are the only Habits store. The web app reads and writes them directly through `src/modules/habits` (Supabase adapter, RLS-scoped to the signed-in user); the Agent Service keeps using the service role key and stamps `AROHAFLOW_OWNER_USER_ID` on rows it writes.

## Shape

- `agent_habits`: id (text), label, scheduled_days, time_anchor (optional), minimum_label, season_reason / season_from / season_until, restarted_on, archived, user_id (defaults to `auth.uid()`).
- `agent_habit_checkins`: (date_key, habit_id) primary key, label, at, level (`full` | `minimum`), user_id (defaults to `auth.uid()`).
- RLS on both: authenticated users see and change only `user_id = auth.uid()`.

## Migration

`database/habits-store-migration.sql` adds the columns, gives agent-created rows an owner when the project has one auth user, copies legacy rows (`specific_days` keep their days; `daily` and `weekly_count` become every day), and enables RLS. `database/habits-drop-legacy.sql` drops `habits` and `habit_logs`, and refuses if any legacy row is missing from the Store.

## Consequences

- The legacy Habit Tracker page, `habitService`, and the unrouted Smart Calendar page are removed; `/habit-tracker` redirects to `/habits`. Flow Mode and the legacy Flow / Momentum scores read habits through `getHabitsDueOn`.
- Local data source uses an in-memory store seeded from the fixture (demo history goes there later).
- Other `agent_*` tables still have no RLS; they are only safe while the anon key never reads them. Owner columns and policies for them are follow-up work.
- Verify against the live project with `npm run habits:live`.
