-- Smart Calendar: ensure calendar_events has location and indexes
-- Safe to run multiple times (IF NOT EXISTS / DO block).

-- Add location column if missing (for events)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_events' AND column_name = 'location'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN location TEXT;
  END IF;
END $$;

-- Indexes (IF NOT EXISTS via separate statements where supported)
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(start_at);
