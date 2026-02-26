-- Recipe parse: recipe_ingredients table and optional new recipe columns
-- Run in Supabase SQL Editor. Idempotent.

-- Recipe ingredients (structured, for AI-parsed and manual)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10, 2),
  unit TEXT,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);

-- Optional: add description and time breakdown to recipes (skip if your recipes table already has different schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'description') THEN
    ALTER TABLE recipes ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'prep_time_minutes') THEN
    ALTER TABLE recipes ADD COLUMN prep_time_minutes INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'cook_time_minutes') THEN
    ALTER TABLE recipes ADD COLUMN cook_time_minutes INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'total_time_minutes') THEN
    ALTER TABLE recipes ADD COLUMN total_time_minutes INTEGER;
  END IF;
END $$;

-- RLS for recipe_ingredients (allow via recipe ownership)
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipe_ingredients_select" ON recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_insert" ON recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_update" ON recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_delete" ON recipe_ingredients;

CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients FOR SELECT USING (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid())
);
CREATE POLICY "recipe_ingredients_insert" ON recipe_ingredients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid())
);
CREATE POLICY "recipe_ingredients_update" ON recipe_ingredients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid())
);
CREATE POLICY "recipe_ingredients_delete" ON recipe_ingredients FOR DELETE USING (
  EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid())
);
