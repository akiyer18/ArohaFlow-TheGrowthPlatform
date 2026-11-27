-- Startups Store (ADR-0014). Run once in the Supabase SQL editor; idempotent.
-- Every company the Startups search has checked (kept, rejected or unreachable), so a company is
-- never looked up twice, plus a log of runs. Agent-only, like the other agent_* tables: RLS is on
-- with no policies, so only the Agent Service (service role) can read or write.

BEGIN;

CREATE TABLE IF NOT EXISTS agent_startups (
  name_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  verdict TEXT NOT NULL,
  status TEXT,
  fit INTEGER,
  checked_at DATE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_startups_verdict_check') THEN
    ALTER TABLE agent_startups ADD CONSTRAINT agent_startups_verdict_check
      CHECK (verdict IN ('keep', 'reject', 'unreachable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_startups_status_check') THEN
    ALTER TABLE agent_startups ADD CONSTRAINT agent_startups_status_check
      CHECK (status IS NULL OR status IN ('new', 'dismissed', 'saved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_startups_domain ON agent_startups(domain);
CREATE INDEX IF NOT EXISTS idx_agent_startups_verdict ON agent_startups(verdict);

CREATE TABLE IF NOT EXISTS agent_startup_runs (
  ran_at TIMESTAMPTZ PRIMARY KEY,
  summary JSONB NOT NULL
);

ALTER TABLE agent_startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_startup_runs ENABLE ROW LEVEL SECURITY;

COMMIT;
