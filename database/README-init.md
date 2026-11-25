# Database setup

## Local dev (VITE_DATA_SOURCE=local)

- No SQL or database required.
- Data is stored in browser **localStorage** under one fixed dev user.
- **DEV_USER_ID** is used for all inserts/selects, so data persists regardless of which email you log in with.
- Tables are created automatically in localStorage; missing tables are added on first load without wiping existing data.

## Supabase (VITE_DATA_SOURCE=production)

1. Run the full schema once in the **Supabase SQL Editor**:
   - Open your project → SQL Editor → New query.
   - Paste and run the contents of **`database/init-all.sql`**.

2. What it does (idempotent, safe to re-run):
   - Creates `update_updated_at_column()`.
   - Creates table **`public.dev_users`** and inserts dev user `00000000-0000-0000-0000-000000000001`.
   - Creates all app tables (accounts, transactions, tasks, recipes, recipe_ingredients, meal_plans, grocery_items, calendar_events, etc.) with **CREATE TABLE IF NOT EXISTS**.
   - Creates indexes and **RLS policies** that allow:
     - `auth.uid() = user_id`, or
     - `user_id = DEV_USER_ID` (so dev user can be used when testing with same UUID).
   - Optionally **seeds** 3 tasks, 1 recipe, 1 grocery item for the dev user if those tables are empty.

3. Optional: run the init script from the repo root:
   ```bash
   node src/lib/db/initDatabase.js
   ```
   This only prints instructions and the path to `init-all.sql`; it does not execute SQL (run the SQL file manually in Supabase).

## Habits (Agent Store)

Habits and Habit Check-ins live in `agent_habits` and `agent_habit_checkins` (ADR-0011), shared by the web app and the Agent Service.

1. Run **`database/agent-service-schema.sql`** (creates the Agent Store tables).
2. Run **`database/habits-store-migration.sql`** (owner, Minimum Version, Season, check-in level, RLS; copies any legacy `habits` / `habit_logs` rows).
3. Check the copy with the query at the end of the migration, then run **`database/habits-drop-legacy.sql`** to drop the legacy tables. It refuses to drop if anything is missing.
4. Agent Service: set `AROHAFLOW_OWNER_USER_ID` in `.env.agent` to your auth user id so rows it writes are visible to you.
5. Verify the live connection: `HABITS_LIVE=1 npx vitest run src/modules/habits/supabase.live.test.js` (add `HABITS_LIVE_EMAIL` / `HABITS_LIVE_PASSWORD` for the signed-in round trip).

## Applications (Agent Store)

Run **`database/applications-store.sql`** once (ADR-0012). It replaces the empty draft `agent_applications` table if present, creates `agent_applications` and `agent_application_events` with RLS, and is safe to re-run. Verify with `npm run applications:live`.

## Effective user in dev

- **Local:** `config/appConfig.js` exports **DEV_USER_ID**. When `VITE_DATA_SOURCE=local`, `LocalService` uses this id for the session and all scoped queries, so one dataset is shared for every “login”.
- **Supabase:** Use your normal auth; for a shared dev dataset you can sign in with an account whose user id is `00000000-0000-0000-0000-000000000001` or rely on the RLS policy that allows that id.

## Errors

- DB errors are logged via **`src/lib/db/logger.js`** (`logDbError`). Tasks and other services use it; never fail silently.
