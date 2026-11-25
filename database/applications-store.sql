-- Applications Store (ADR-0012). Run once in the Supabase SQL editor; idempotent.
-- Same pattern as the Habits Store (ADR-0011): user_id defaults to auth.uid(), RLS scopes
-- every row to its owner, the Agent Service (service role) bypasses RLS.

BEGIN;

-- Replace the earlier draft table from feature/os-ui-shell-13 (id TEXT, role_title, link, status),
-- but only while it is empty. With rows in it, stop and leave everything untouched.
DO $$
DECLARE
  old_rows INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_applications' AND column_name = 'role_title'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM agent_applications' INTO old_rows;
    IF old_rows > 0 THEN
      RAISE EXCEPTION 'agent_applications has % row(s) in the old layout; migrate them before running this file.', old_rows;
    END IF;
    DROP TABLE agent_applications;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agent_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  url TEXT,
  location TEXT,
  source TEXT,
  stage TEXT NOT NULL DEFAULT 'saved',
  closed_reason TEXT,
  applied_on DATE,
  stage_changed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  next_step TEXT,
  next_step_due DATE,
  notes TEXT,
  action_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_application_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  application_id UUID NOT NULL REFERENCES agent_applications(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  on_date DATE NOT NULL DEFAULT CURRENT_DATE,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_applications_stage_check') THEN
    ALTER TABLE agent_applications ADD CONSTRAINT agent_applications_stage_check
      CHECK (stage IN ('saved', 'applied', 'interviewing', 'offer', 'closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_applications_closed_reason_check') THEN
    ALTER TABLE agent_applications ADD CONSTRAINT agent_applications_closed_reason_check
      CHECK ((stage = 'closed') = (closed_reason IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_application_events_stage_check') THEN
    ALTER TABLE agent_application_events ADD CONSTRAINT agent_application_events_stage_check
      CHECK (to_stage IN ('saved', 'applied', 'interviewing', 'offer', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_applications_user_stage ON agent_applications(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_agent_application_events_user_date ON agent_application_events(user_id, on_date);
CREATE INDEX IF NOT EXISTS idx_agent_application_events_application ON agent_application_events(application_id);

ALTER TABLE agent_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_application_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_applications_owner_select" ON agent_applications;
DROP POLICY IF EXISTS "agent_applications_owner_insert" ON agent_applications;
DROP POLICY IF EXISTS "agent_applications_owner_update" ON agent_applications;
DROP POLICY IF EXISTS "agent_applications_owner_delete" ON agent_applications;
CREATE POLICY "agent_applications_owner_select" ON agent_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "agent_applications_owner_insert" ON agent_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "agent_applications_owner_update" ON agent_applications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "agent_applications_owner_delete" ON agent_applications FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "agent_application_events_owner_select" ON agent_application_events;
DROP POLICY IF EXISTS "agent_application_events_owner_insert" ON agent_application_events;
DROP POLICY IF EXISTS "agent_application_events_owner_delete" ON agent_application_events;
CREATE POLICY "agent_application_events_owner_select" ON agent_application_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "agent_application_events_owner_insert" ON agent_application_events FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM agent_applications a WHERE a.id = application_id AND a.user_id = auth.uid())
);
CREATE POLICY "agent_application_events_owner_delete" ON agent_application_events FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;
