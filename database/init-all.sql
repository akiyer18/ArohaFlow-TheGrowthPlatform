-- Aroha Flow: full schema init (idempotent)
-- Run once in Supabase SQL Editor. Safe to re-run (CREATE IF NOT EXISTS, etc.).
-- Dev user id used for local/dev RLS bypass: 00000000-0000-0000-0000-000000000001

-- Helper: updated_at trigger (create once)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: public users table for dev user record (no FK to auth.users so we can insert dev id)
CREATE TABLE IF NOT EXISTS public.dev_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert dev user if not exists (for reference; RLS policies allow this id in dev)
INSERT INTO public.dev_users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'dev@local.dev')
ON CONFLICT (id) DO NOTHING;

-- 1. Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 2. Transactions (money)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50),
  source VARCHAR(255),
  item VARCHAR(255),
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- 3. Budget categories
CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_type VARCHAR(50) NOT NULL,
  budget_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON budget_categories(user_id);

-- 4. Planned expenses
CREATE TABLE IF NOT EXISTS planned_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item VARCHAR(255) NOT NULL,
  cost DECIMAL(12, 2) NOT NULL,
  target_date DATE NOT NULL,
  category VARCHAR(50),
  currency VARCHAR(3) DEFAULT 'USD',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planned_expenses_user_id ON planned_expenses(user_id);

-- 5. Income ideas
CREATE TABLE IF NOT EXISTS income_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  idea VARCHAR(255) NOT NULL,
  expected_amount DECIMAL(12, 2) NOT NULL,
  target_date DATE NOT NULL,
  confidence_level INTEGER,
  currency VARCHAR(3) DEFAULT 'USD',
  is_recurring BOOLEAN DEFAULT FALSE,
  frequency VARCHAR(20),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_income_ideas_user_id ON income_ideas(user_id);

-- 6. Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  priority VARCHAR(10),
  currency VARCHAR(3) DEFAULT 'USD',
  is_recurring BOOLEAN DEFAULT FALSE,
  frequency VARCHAR(20),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);

-- 7. Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  notes TEXT,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  category VARCHAR(50) NOT NULL DEFAULT 'Other',
  status VARCHAR(20) DEFAULT 'Pending',
  completed_on TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- 8 and 9. Habits live in the Agent Store (agent_habits, agent_habit_checkins):
--      run database/agent-service-schema.sql, then database/habits-store-migration.sql.

-- 10. Recipes
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  ingredients JSONB,
  cooking_time INTEGER,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);

-- 11. Recipe ingredients (optional separate table)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount TEXT,
  unit VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);

-- 12. Meal plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  planned_date DATE NOT NULL,
  meal_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_planned_date ON meal_plans(planned_date);

-- 13. Grocery items
CREATE TABLE IF NOT EXISTS grocery_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit VARCHAR(50),
  category VARCHAR(100),
  is_purchased BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grocery_items_user_id ON grocery_items(user_id);

-- 14. Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(start_at);

-- RLS: enable on all app tables (Money: accounts/transactions/budget_categories/
-- planned_expenses/income_ideas). No anon policies — only auth.uid()/dev policies below.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['accounts','transactions','budget_categories','planned_expenses','income_ideas','reminders','tasks','recipes','recipe_ingredients','meal_plans','grocery_items','calendar_events'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- RLS policies: allow auth.uid() = user_id OR user_id = dev user (for dev mode)
CREATE OR REPLACE FUNCTION app_user_can_access(user_id_col UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.uid() = user_id_col) OR (user_id_col = '00000000-0000-0000-0000-000000000001'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies: user_id = auth.uid() OR user_id = dev (so dev can use same data)
-- Tables with user_id column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY '{accounts,transactions,budget_categories,planned_expenses,income_ideas,reminders,tasks,recipes,meal_plans,grocery_items,calendar_events}'::TEXT[]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_user_or_dev_sel_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_user_or_dev_sel_%s" ON %I FOR SELECT USING (app_user_can_access(user_id))', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_user_or_dev_ins_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_user_or_dev_ins_%s" ON %I FOR INSERT WITH CHECK (app_user_can_access(user_id))', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_user_or_dev_upd_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_user_or_dev_upd_%s" ON %I FOR UPDATE USING (app_user_can_access(user_id))', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_user_or_dev_del_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_user_or_dev_del_%s" ON %I FOR DELETE USING (app_user_can_access(user_id))', tbl, tbl);
  END LOOP;
END $$;

-- recipe_ingredients: no user_id; allow via recipe ownership
DROP POLICY IF EXISTS "allow_user_or_dev_sel_recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "allow_user_or_dev_ins_recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "allow_user_or_dev_upd_recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "allow_user_or_dev_del_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "allow_user_or_dev_sel_recipe_ingredients" ON recipe_ingredients FOR SELECT USING (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND app_user_can_access(r.user_id))
);
CREATE POLICY "allow_user_or_dev_ins_recipe_ingredients" ON recipe_ingredients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND app_user_can_access(r.user_id))
);
CREATE POLICY "allow_user_or_dev_upd_recipe_ingredients" ON recipe_ingredients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND app_user_can_access(r.user_id))
);
CREATE POLICY "allow_user_or_dev_del_recipe_ingredients" ON recipe_ingredients FOR DELETE USING (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND app_user_can_access(r.user_id))
);

-- Optional seed data for dev user (only if tables empty for that user)
DO $$
DECLARE
  dev_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF (SELECT COUNT(*) FROM tasks WHERE user_id = dev_id) = 0 THEN
    INSERT INTO tasks (user_id, task_name, due_date, priority, category, status)
    VALUES
      (dev_id, 'Sample task 1', NOW() + INTERVAL '1 day', 'Medium', 'Work', 'Pending'),
      (dev_id, 'Sample task 2', NOW() + INTERVAL '2 days', 'High', 'Health', 'Pending'),
      (dev_id, 'Sample task 3', NOW(), 'Low', 'Other', 'Pending');
  END IF;
  IF (SELECT COUNT(*) FROM recipes WHERE user_id = dev_id) = 0 THEN
    INSERT INTO recipes (user_id, name, ingredients, cooking_time, instructions)
    VALUES (dev_id, 'Simple Salad', '[]'::jsonb, 10, 'Chop and mix.');
  END IF;
  IF (SELECT COUNT(*) FROM grocery_items WHERE user_id = dev_id) = 0 THEN
    INSERT INTO grocery_items (user_id, name, quantity, unit)
    VALUES (dev_id, 'Milk', 1, 'gallon');
  END IF;
END $$;
