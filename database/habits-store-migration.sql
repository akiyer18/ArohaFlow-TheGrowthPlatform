-- Habits Store migration (ADR-0010, ADR-0011). Run once in the Supabase SQL editor.
-- Idempotent: safe to re-run. Does NOT drop anything; see habits-drop-legacy.sql for that.
--
-- 1. Extends agent_habits / agent_habit_checkins with owner, Minimum Version, Season and level.
-- 2. Gives agent-created rows an owner when the project has exactly one auth user.
-- 3. Copies the legacy Habit Tracker tables (habits, habit_logs) into them.
-- 4. Enables row level security: the web app (anon key + signed-in user) sees only its own rows.
--    The Agent Service uses the service role key, which bypasses RLS.

BEGIN;

-- 1. Columns ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_habits (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  scheduled_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_anchor TEXT
);

CREATE TABLE IF NOT EXISTS agent_habit_checkins (
  date_key TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  label TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (date_key, habit_id)
);

ALTER TABLE agent_habits ALTER COLUMN time_anchor DROP NOT NULL;
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS minimum_label TEXT;
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS season_reason TEXT;
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS season_from DATE;
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS season_until DATE;
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS restarted_on DATE;
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE agent_habits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE agent_habit_checkins ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE agent_habit_checkins ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_habit_checkins_level_check') THEN
    ALTER TABLE agent_habit_checkins
      ADD CONSTRAINT agent_habit_checkins_level_check CHECK (level IN ('full', 'minimum'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_habits_season_range_check') THEN
    ALTER TABLE agent_habits
      ADD CONSTRAINT agent_habits_season_range_check
      CHECK (season_from IS NULL OR season_until IS NULL OR season_until >= season_from);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_habits_user_id ON agent_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_habit_checkins_user_date ON agent_habit_checkins(user_id, date_key);

-- 2. Owner for rows the Agent Service created before owners existed ----------

UPDATE agent_habits
SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
WHERE user_id IS NULL AND (SELECT COUNT(*) FROM auth.users) = 1;

UPDATE agent_habit_checkins
SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
WHERE user_id IS NULL AND (SELECT COUNT(*) FROM auth.users) = 1;

-- 3. Copy the legacy Habit Tracker tables, if they still exist ---------------
-- frequency 'specific_days' keeps its days; 'daily' and 'weekly_count' become every day.
-- habit ids keep their UUID as text so the copy is traceable and re-runs skip duplicates.
-- Owner: the legacy user_id when it is a real auth user; otherwise (e.g. the dev user
-- 00000000-0000-0000-0000-000000000001 seeded by init-all.sql) the project's only auth user;
-- otherwise NULL, which step 5 reports as habits_without_owner.

DO $$
BEGIN
  IF to_regclass('public.habits') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO agent_habits (id, label, scheduled_days, time_anchor, archived, created_at, updated_at, user_id)
      SELECT
        h.id::text,
        h.title,
        CASE
          WHEN h.frequency_type = 'specific_days'
               AND jsonb_typeof(h.frequency_value -> 'days') = 'array'
               AND jsonb_array_length(h.frequency_value -> 'days') > 0
            THEN h.frequency_value -> 'days'
          ELSE '[0,1,2,3,4,5,6]'::jsonb
        END,
        NULL,
        h.archived,
        COALESCE(h.created_at, NOW()),
        COALESCE(h.updated_at, NOW()),
        COALESCE(
          (SELECT u.id FROM auth.users u WHERE u.id = h.user_id),
          CASE WHEN (SELECT COUNT(*) FROM auth.users) = 1 THEN (SELECT u.id FROM auth.users u LIMIT 1) END
        )
      FROM habits h
      ON CONFLICT (id) DO NOTHING
    $copy$;
  END IF;

  IF to_regclass('public.habit_logs') IS NOT NULL AND to_regclass('public.habits') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO agent_habit_checkins (date_key, habit_id, label, at, level, user_id)
      SELECT
        l.date::text,
        l.habit_id::text,
        h.title,
        COALESCE(l.created_at, (l.date::timestamp AT TIME ZONE 'UTC')),
        'full',
        COALESCE(
          (SELECT u.id FROM auth.users u WHERE u.id = l.user_id),
          CASE WHEN (SELECT COUNT(*) FROM auth.users) = 1 THEN (SELECT u.id FROM auth.users u LIMIT 1) END
        )
      FROM habit_logs l
      JOIN habits h ON h.id = l.habit_id
      WHERE COALESCE(l.count, 1) > 0
      ON CONFLICT (date_key, habit_id) DO NOTHING
    $copy$;
  END IF;
END $$;

-- 4. Row level security ---------------------------------------------------------

ALTER TABLE agent_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_habit_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_habits_owner_select" ON agent_habits;
DROP POLICY IF EXISTS "agent_habits_owner_insert" ON agent_habits;
DROP POLICY IF EXISTS "agent_habits_owner_update" ON agent_habits;
DROP POLICY IF EXISTS "agent_habits_owner_delete" ON agent_habits;
CREATE POLICY "agent_habits_owner_select" ON agent_habits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "agent_habits_owner_insert" ON agent_habits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "agent_habits_owner_update" ON agent_habits FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "agent_habits_owner_delete" ON agent_habits FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "agent_habit_checkins_owner_select" ON agent_habit_checkins;
DROP POLICY IF EXISTS "agent_habit_checkins_owner_insert" ON agent_habit_checkins;
DROP POLICY IF EXISTS "agent_habit_checkins_owner_update" ON agent_habit_checkins;
DROP POLICY IF EXISTS "agent_habit_checkins_owner_delete" ON agent_habit_checkins;
CREATE POLICY "agent_habit_checkins_owner_select" ON agent_habit_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "agent_habit_checkins_owner_insert" ON agent_habit_checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "agent_habit_checkins_owner_update" ON agent_habit_checkins FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "agent_habit_checkins_owner_delete" ON agent_habit_checkins FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;

-- 5. Check the copy before running habits-drop-legacy.sql --------------------
-- SELECT
--   (SELECT COUNT(*) FROM habits)                                   AS legacy_habits,
--   (SELECT COUNT(*) FROM agent_habits a JOIN habits h ON a.id = h.id::text) AS copied_habits,
--   (SELECT COUNT(*) FROM habit_logs WHERE COALESCE(count, 1) > 0)  AS legacy_logs,
--   (SELECT COUNT(*) FROM agent_habit_checkins c JOIN habit_logs l
--      ON c.habit_id = l.habit_id::text AND c.date_key = l.date::text) AS copied_logs,
--   (SELECT COUNT(*) FROM agent_habits WHERE user_id IS NULL)       AS habits_without_owner;
