# Database setup

## Local dev (VITE_DATA_SOURCE=local)

- No SQL or database required.
- Data is stored in browser **localStorage** under one fixed dev user.
- **DEV_USER_ID** is used for all inserts/selects, so data persists regardless of which email you log in with.
- Tables are created automatically in localStorage; missing tables (e.g. habits, habit_logs) are added on first load without wiping existing data.

## Supabase (VITE_DATA_SOURCE=production)

1. Run the full schema once in the **Supabase SQL Editor**:
   - Open your project → SQL Editor → New query.
   - Paste and run the contents of **`database/init-all.sql`**.

2. What it does (idempotent, safe to re-run):
   - Creates `update_updated_at_column()`.
   - Creates table **`public.dev_users`** and inserts dev user `00000000-0000-0000-0000-000000000001`.
   - Creates all app tables (accounts, transactions, tasks, habits, habit_logs, recipes, recipe_ingredients, meal_plans, grocery_items, calendar_events, etc.) with **CREATE TABLE IF NOT EXISTS**.
   - Creates indexes and **RLS policies** that allow:
     - `auth.uid() = user_id`, or
     - `user_id = DEV_USER_ID` (so dev user can be used when testing with same UUID).
   - Optionally **seeds** 3 tasks, 2 habits, 1 recipe, 1 grocery item for the dev user if those tables are empty.

3. Optional: run the init script from the repo root:
   ```bash
   node src/lib/db/initDatabase.js
   ```
   This only prints instructions and the path to `init-all.sql`; it does not execute SQL (run the SQL file manually in Supabase).

## Effective user in dev

- **Local:** `config/appConfig.js` exports **DEV_USER_ID**. When `VITE_DATA_SOURCE=local`, `LocalService` uses this id for the session and all scoped queries, so one dataset is shared for every “login”.
- **Supabase:** Use your normal auth; for a shared dev dataset you can sign in with an account whose user id is `00000000-0000-0000-0000-000000000001` or rely on the RLS policy that allows that id.

## Errors

- DB errors are logged via **`src/lib/db/logger.js`** (`logDbError`). Tasks and habits services use it; never fail silently.
