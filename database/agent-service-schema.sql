-- Agent Service Store tables (solo personal OS). Apply in Supabase SQL editor.
-- ADR-0006: glossary nouns live in the Agent Service Store port; this is the adapter dialect.

CREATE TABLE IF NOT EXISTS agent_day_plans (
  date_key TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  intention TEXT,
  locked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive for existing deployments (idempotent).
ALTER TABLE agent_day_plans ADD COLUMN IF NOT EXISTS intention TEXT;
ALTER TABLE agent_day_plans ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS agent_day_plan_changes (
  id BIGSERIAL PRIMARY KEY,
  date_key TEXT NOT NULL,
  type TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_agent_day_plan_changes_date ON agent_day_plan_changes (date_key, at);

CREATE TABLE IF NOT EXISTS agent_email_digest_items (
  date_key TEXT NOT NULL,
  message_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (date_key, message_id)
);

CREATE TABLE IF NOT EXISTS agent_calendar_events (
  external_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_daily_points (
  date_key TEXT PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_completions (
  id BIGSERIAL PRIMARY KEY,
  date_key TEXT NOT NULL,
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_agent_completions_date ON agent_completions (date_key, at);

CREATE TABLE IF NOT EXISTS agent_streak (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  count INTEGER NOT NULL DEFAULT 0,
  freeze_remaining_this_week INTEGER NOT NULL DEFAULT 1,
  freeze_week_key TEXT
);

CREATE TABLE IF NOT EXISTS agent_streak_days (
  date_key TEXT PRIMARY KEY,
  met BOOLEAN NOT NULL DEFAULT FALSE,
  resolved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS agent_activity (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_activity_at ON agent_activity (at);

CREATE TABLE IF NOT EXISTS agent_habit_checkins (
  date_key TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  label TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (date_key, habit_id)
);

CREATE TABLE IF NOT EXISTS agent_sender_allowlist (
  id TEXT PRIMARY KEY,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS agent_goals (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS agent_weekly_plan_proposals (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO agent_streak (id, count, freeze_remaining_this_week, freeze_week_key)
VALUES (1, 0, 1, NULL)
ON CONFLICT (id) DO NOTHING;
