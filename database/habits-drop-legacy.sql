-- Drop the legacy Habit Tracker tables (habits, habit_logs). IRREVERSIBLE.
-- Run only after habits-store-migration.sql, and after its step 5 check shows every row copied.
-- Guarded: aborts without dropping anything if a legacy habit or check-in is missing from the Store.

BEGIN;

DO $$
DECLARE
  missing_habits INTEGER := 0;
  missing_logs INTEGER := 0;
BEGIN
  IF to_regclass('public.habits') IS NOT NULL THEN
    SELECT COUNT(*) INTO missing_habits
    FROM habits h
    WHERE NOT EXISTS (SELECT 1 FROM agent_habits a WHERE a.id = h.id::text);
  END IF;

  IF to_regclass('public.habit_logs') IS NOT NULL THEN
    SELECT COUNT(*) INTO missing_logs
    FROM habit_logs l
    WHERE COALESCE(l.count, 1) > 0
      AND NOT EXISTS (
        SELECT 1 FROM agent_habit_checkins c
        WHERE c.habit_id = l.habit_id::text AND c.date_key = l.date::text
      );
  END IF;

  IF missing_habits > 0 OR missing_logs > 0 THEN
    RAISE EXCEPTION 'Not dropping: % habit(s) and % check-in(s) are not in the Store yet. Run habits-store-migration.sql first.',
      missing_habits, missing_logs;
  END IF;
END $$;

DROP TABLE IF EXISTS habit_logs;
DROP TABLE IF EXISTS habits;

COMMIT;
