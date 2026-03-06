-- Smart Bank Statement Analyzer: store normalized transactions only (no raw files).
-- Run after init-all.sql. Idempotent.

CREATE TABLE IF NOT EXISTS bank_statement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount DECIMAL(12, 2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  merchant TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'Uncategorized',
  source_bank TEXT,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_user_id ON bank_statement_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_date ON bank_statement_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_user_date ON bank_statement_transactions(user_id, date);

COMMENT ON TABLE bank_statement_transactions IS 'Parsed bank statement rows; raw files are not stored';

-- RLS
ALTER TABLE bank_statement_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bank_statement_transactions" ON bank_statement_transactions;
DROP POLICY IF EXISTS "Users can insert own bank_statement_transactions" ON bank_statement_transactions;
DROP POLICY IF EXISTS "Users can update own bank_statement_transactions" ON bank_statement_transactions;
DROP POLICY IF EXISTS "Users can delete own bank_statement_transactions" ON bank_statement_transactions;

CREATE POLICY "Users can view own bank_statement_transactions" ON bank_statement_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bank_statement_transactions" ON bank_statement_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank_statement_transactions" ON bank_statement_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank_statement_transactions" ON bank_statement_transactions FOR DELETE USING (auth.uid() = user_id);
