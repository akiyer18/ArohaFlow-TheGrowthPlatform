-- Minimal friction journal: one entry per user per date. All content nullable.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,

  -- Daily state (1-5)
  mood INTEGER CHECK (mood IS NULL OR (mood >= 1 AND mood <= 5)),
  energy INTEGER CHECK (energy IS NULL OR (energy >= 1 AND energy <= 5)),
  focus INTEGER CHECK (focus IS NULL OR (focus >= 1 AND focus <= 5)),
  stress INTEGER CHECK (stress IS NULL OR (stress >= 1 AND stress <= 5)),

  -- Reflection & intention
  reflection_text TEXT,
  small_win TEXT,
  tomorrow_intention TEXT,
  confidence_tomorrow INTEGER CHECK (confidence_tomorrow IS NULL OR (confidence_tomorrow >= 1 AND confidence_tomorrow <= 5)),

  -- Prompt shown this day (for consistency)
  prompt_key TEXT,

  -- Auto metadata (no UI)
  metadata JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON journal_entries(user_id, date);

COMMENT ON COLUMN journal_entries.metadata IS 'timestamp, weekday, timeOfDay, streak, momentumScore, sessionLength, activeModules';
