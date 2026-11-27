-- One-off, STEP 1 of 3: keep the old Tracker rows (role_title, link, status) as a backup
-- so database/applications-store.sql can create the new Applications Store (ADR-0012).
--   STEP 1  this file
--   STEP 2  database/applications-store.sql
--   STEP 3  database/applications-legacy-2-copy.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_applications' AND column_name = 'role_title'
  ) THEN
    ALTER TABLE agent_applications RENAME TO agent_applications_legacy;
  END IF;
END $$;
