-- Knowledge Expansion: structured learning entries. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  source_type TEXT,
  tags TEXT[] DEFAULT '{}',
  impact_rating INTEGER CHECK (impact_rating IS NULL OR (impact_rating >= 1 AND impact_rating <= 5)),
  date DATE NOT NULL DEFAULT current_date,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_id ON knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_date ON knowledge_entries(date);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_date ON knowledge_entries(user_id, date);

-- GIN index for tag filtering (array overlap / contains)
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_tags ON knowledge_entries USING GIN (tags);

COMMENT ON COLUMN knowledge_entries.source_type IS 'book | article | youtube | course | podcast | other';

-- RLS: users can only access their own entries (idempotent)
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own knowledge_entries" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can insert own knowledge_entries" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can update own knowledge_entries" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can delete own knowledge_entries" ON knowledge_entries;

CREATE POLICY "Users can view own knowledge_entries" ON knowledge_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge_entries" ON knowledge_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge_entries" ON knowledge_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge_entries" ON knowledge_entries FOR DELETE USING (auth.uid() = user_id);
