-- Meal Planning & Grocery Management Database Schema for Supabase
-- Add these tables to your existing database

-- 1. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cuisine VARCHAR(100),
    ingredients TEXT[] NOT NULL, -- Array of ingredient names
    cooking_time INTEGER NOT NULL, -- in minutes
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('breakfast', 'lunch', 'dinner', 'snack', 'dessert')),
    instructions TEXT,
    recipe_url VARCHAR(500), -- optional YouTube or recipe link
    servings INTEGER DEFAULT 1,
    calories_per_serving INTEGER,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Meal Plans Table
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    servings INTEGER DEFAULT 1,
    notes TEXT,
    is_prepared BOOLEAN DEFAULT FALSE,
    prepared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, planned_date, meal_type) -- One meal per type per date
);

-- 3. Grocery Items Table
CREATE TABLE IF NOT EXISTS grocery_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'Other' CHECK (category IN ('Produce', 'Dairy', 'Meat', 'Pantry', 'Bakery', 'Frozen', 'Other')),
    quantity VARCHAR(100), -- e.g., "2 lbs", "1 gallon", "3 pieces"
    unit VARCHAR(50), -- e.g., "lbs", "kg", "pieces", "gallons"
    notes TEXT,
    frequency VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    is_purchased BOOLEAN DEFAULT FALSE,
    is_in_inventory BOOLEAN DEFAULT FALSE, -- whether user has this item at home
    priority INTEGER DEFAULT 3 CHECK (priority IN (1, 2, 3, 4, 5)), -- 1=urgent, 5=low
    estimated_price DECIMAL(10, 2),
    store_section VARCHAR(100), -- aisle or section in store
    due_date DATE, -- when to buy next
    last_purchased DATE,
    purchase_count INTEGER DEFAULT 0,
    added_from_meal_plan BOOLEAN DEFAULT FALSE, -- track if added from meal planning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. User Inventory Table (items currently available at home)
CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity VARCHAR(100),
    unit VARCHAR(50),
    expiry_date DATE,
    location VARCHAR(100), -- fridge, pantry, freezer
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, ingredient_name) -- One entry per ingredient per user
);

-- 5. Recipe Categories Table (for custom categorization)
CREATE TABLE IF NOT EXISTS recipe_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'utensils',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 6. Shopping Lists Table (organized lists for shopping trips)
CREATE TABLE IF NOT EXISTS shopping_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    store_name VARCHAR(255),
    total_estimated_cost DECIMAL(10, 2),
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Shopping List Items (junction table)
CREATE TABLE IF NOT EXISTS shopping_list_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE,
    grocery_item_id UUID REFERENCES grocery_items(id) ON DELETE CASCADE,
    is_purchased BOOLEAN DEFAULT FALSE,
    actual_price DECIMAL(10, 2),
    purchased_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Recipes
CREATE POLICY "Users can view own recipes" ON recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON recipes FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Meal Plans
CREATE POLICY "Users can view own meal plans" ON meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans" ON meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON meal_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON meal_plans FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Grocery Items
CREATE POLICY "Users can view own grocery items" ON grocery_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own grocery items" ON grocery_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grocery items" ON grocery_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grocery items" ON grocery_items FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for User Inventory
CREATE POLICY "Users can view own inventory" ON user_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory" ON user_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory" ON user_inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory" ON user_inventory FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Recipe Categories
CREATE POLICY "Users can view own recipe categories" ON recipe_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipe categories" ON recipe_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipe categories" ON recipe_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipe categories" ON recipe_categories FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Shopping Lists
CREATE POLICY "Users can view own shopping lists" ON shopping_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shopping lists" ON shopping_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shopping lists" ON shopping_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shopping lists" ON shopping_lists FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Shopping List Items (through shopping list ownership)
CREATE POLICY "Users can view own shopping list items" ON shopping_list_items FOR SELECT 
USING (shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own shopping list items" ON shopping_list_items FOR INSERT 
WITH CHECK (shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own shopping list items" ON shopping_list_items FOR UPDATE 
USING (shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own shopping list items" ON shopping_list_items FOR DELETE 
USING (shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_cooking_time ON recipes(cooking_time);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_date ON meal_plans(planned_date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_grocery_items_user_id ON grocery_items(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_items_category ON grocery_items(category);
CREATE INDEX IF NOT EXISTS idx_grocery_items_purchased ON grocery_items(is_purchased);
CREATE INDEX IF NOT EXISTS idx_grocery_items_due_date ON grocery_items(due_date);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_ingredient ON user_inventory(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_id ON shopping_lists(user_id);

-- Create updated_at triggers
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grocery_items_updated_at BEFORE UPDATE ON grocery_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_inventory_updated_at BEFORE UPDATE ON user_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default recipe categories
INSERT INTO recipe_categories (user_id, name, color, icon, is_default) 
SELECT auth.uid(), 'Quick & Easy', '#10b981', 'clock', true
WHERE auth.uid() IS NOT NULL;

INSERT INTO recipe_categories (user_id, name, color, icon, is_default) 
SELECT auth.uid(), 'Healthy', '#22c55e', 'heart', true
WHERE auth.uid() IS NOT NULL;

INSERT INTO recipe_categories (user_id, name, color, icon, is_default) 
SELECT auth.uid(), 'Comfort Food', '#f59e0b', 'home', true
WHERE auth.uid() IS NOT NULL;

-- Insert some default recipes (optional)
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings) 
SELECT 
    auth.uid(),
    'Spaghetti Aglio e Olio',
    'Italian',
    ARRAY['spaghetti', 'garlic', 'olive oil', 'red pepper flakes', 'parsley', 'parmesan cheese'],
    15,
    'easy',
    'dinner',
    'Cook spaghetti. Heat olive oil, add garlic and red pepper flakes. Toss with pasta, parsley, and cheese.',
    2
WHERE auth.uid() IS NOT NULL;

INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings)
SELECT 
    auth.uid(),
    'Greek Salad',
    'Mediterranean',
    ARRAY['tomatoes', 'cucumber', 'red onion', 'feta cheese', 'olives', 'olive oil', 'lemon juice'],
    10,
    'easy',
    'lunch',
    'Chop vegetables, add feta and olives. Dress with olive oil and lemon juice.',
    4
WHERE auth.uid() IS NOT NULL;

-- Views for easier querying
CREATE OR REPLACE VIEW meal_plans_with_recipes AS
SELECT 
    mp.*,
    r.name as recipe_name,
    r.cuisine,
    r.ingredients,
    r.cooking_time,
    r.difficulty_level,
    r.servings as recipe_servings
FROM meal_plans mp
JOIN recipes r ON mp.recipe_id = r.id;

CREATE OR REPLACE VIEW weekly_meal_plan AS
SELECT 
    mp.*,
    r.name as recipe_name,
    r.cuisine,
    r.cooking_time,
    r.ingredients
FROM meal_plans mp
JOIN recipes r ON mp.recipe_id = r.id
WHERE mp.planned_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY mp.planned_date, mp.meal_type;

-- Function to automatically add ingredients to grocery list when meal is planned
CREATE OR REPLACE FUNCTION add_meal_ingredients_to_grocery_list()
RETURNS TRIGGER AS $$
DECLARE
    ingredient TEXT;
    existing_item UUID;
BEGIN
    -- Only process if this is a new meal plan
    IF TG_OP = 'INSERT' THEN
        -- Loop through each ingredient in the recipe
        FOR ingredient IN SELECT unnest(
            (SELECT ingredients FROM recipes WHERE id = NEW.recipe_id)
        ) LOOP
            -- Check if ingredient is already in user's inventory
            IF NOT EXISTS (
                SELECT 1 FROM user_inventory 
                WHERE user_id = NEW.user_id 
                AND LOWER(ingredient_name) = LOWER(ingredient)
            ) THEN
                -- Check if ingredient is already in grocery list
                SELECT id INTO existing_item
                FROM grocery_items 
                WHERE user_id = NEW.user_id 
                AND LOWER(name) = LOWER(ingredient)
                AND NOT is_purchased;
                
                -- If not in grocery list, add it
                IF existing_item IS NULL THEN
                    INSERT INTO grocery_items (
                        user_id, 
                        name, 
                        category, 
                        quantity,
                        added_from_meal_plan,
                        due_date
                    ) VALUES (
                        NEW.user_id,
                        ingredient,
                        'Other', -- Could be enhanced with ingredient categorization
                        '1', -- Default quantity
                        TRUE,
                        NEW.planned_date - INTERVAL '1 day' -- Buy day before cooking
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add ingredients to grocery list
CREATE TRIGGER trigger_add_meal_ingredients
    AFTER INSERT ON meal_plans
    FOR EACH ROW
    EXECUTE FUNCTION add_meal_ingredients_to_grocery_list();

-- Grant permissions on views
GRANT SELECT ON meal_plans_with_recipes TO authenticated;
GRANT SELECT ON weekly_meal_plan TO authenticated; 