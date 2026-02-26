-- Vegetarian Indian Recipes for Meal Planning Database
-- Execute this script in Supabase SQL Editor to add vegetarian recipes

-- Insert Dal Rice (Daal Chawal)
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving) 
SELECT 
    auth.uid(),
    'Dal Rice (Daal Chawal)',
    'Indian',
    ARRAY['basmati rice', 'yellow dal (moong/toor)', 'turmeric', 'salt', 'cumin seeds', 'mustard seeds', 'onion', 'tomato', 'green chilies', 'ginger', 'garlic', 'ghee', 'coriander leaves', 'masala mix'],
    30,
    'easy',
    'dinner',
    '1. Wash and cook rice separately. 2. Cook dal with turmeric and salt. 3. Heat ghee, add cumin seeds, mustard seeds. 4. Add chopped onion, ginger, garlic. 5. Add tomatoes, green chilies, masala mix. 6. Mix cooked dal and serve with rice. 7. Garnish with coriander leaves.',
    4,
    350
WHERE auth.uid() IS NOT NULL;

-- Insert Masala Dosa
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Masala Dosa',
    'South Indian',
    ARRAY['dosa batter', 'potatoes', 'onions', 'mustard seeds', 'curry leaves', 'turmeric', 'green chilies', 'ginger', 'oil', 'salt', 'coconut chutney ingredients', 'sambar dal', 'masala mix'],
    45,
    'medium',
    'breakfast',
    '1. Boil and mash potatoes. 2. Heat oil, add mustard seeds, curry leaves. 3. Add onions, ginger, green chilies. 4. Add turmeric, masala mix, salt. 5. Mix mashed potatoes. 6. Spread dosa batter on pan. 7. Add potato filling and fold. 8. Serve with chutney and sambar.',
    2,
    280
WHERE auth.uid() IS NOT NULL;

-- Insert Paneer Sabzi
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Paneer Sabzi (Paneer Curry)',
    'North Indian',
    ARRAY['paneer', 'onions', 'tomatoes', 'ginger-garlic paste', 'green chilies', 'turmeric', 'cumin seeds', 'oil', 'coriander leaves', 'cream', 'masala mix'],
    25,
    'easy',
    'dinner',
    '1. Cut paneer into cubes. 2. Heat oil, add cumin seeds. 3. Add onions and ginger-garlic paste. 4. Add tomatoes, green chilies. 5. Add turmeric, masala mix. 6. Add paneer cubes gently. 7. Add cream and simmer. 8. Garnish with coriander leaves.',
    4,
    320
WHERE auth.uid() IS NOT NULL;

-- Insert Aloo Gobi
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Aloo Gobi (Potato Cauliflower)',
    'North Indian',
    ARRAY['potatoes', 'cauliflower', 'onions', 'tomatoes', 'ginger', 'garlic', 'turmeric', 'cumin seeds', 'oil', 'salt', 'coriander leaves', 'masala mix'],
    35,
    'easy',
    'lunch',
    '1. Cut potatoes and cauliflower into pieces. 2. Heat oil, add cumin seeds. 3. Add ginger, garlic. 4. Add onions and cook until soft. 5. Add tomatoes, turmeric, masala mix. 6. Add potatoes and cauliflower. 7. Cover and cook until tender. 8. Garnish with coriander.',
    4,
    220
WHERE auth.uid() IS NOT NULL;

-- Insert Rajma
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Rajma (Kidney Bean Curry)',
    'North Indian',
    ARRAY['kidney beans', 'onions', 'tomatoes', 'ginger-garlic paste', 'cumin seeds', 'bay leaves', 'turmeric', 'oil', 'rice', 'coriander leaves', 'masala mix'],
    40,
    'easy',
    'dinner',
    '1. Soak kidney beans overnight and boil until soft. 2. Heat oil, add cumin seeds, bay leaves. 3. Add onions and ginger-garlic paste. 4. Add tomatoes and cook until soft. 5. Add turmeric, masala mix. 6. Add boiled rajma with water. 7. Simmer for 15 minutes. 8. Serve with rice and garnish with coriander.',
    4,
    380
WHERE auth.uid() IS NOT NULL;

-- Insert Chole
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Chole (Chickpea Curry)',
    'Punjabi',
    ARRAY['chickpeas', 'onions', 'tomatoes', 'ginger-garlic paste', 'cumin seeds', 'coriander seeds', 'turmeric', 'amchur powder', 'oil', 'bhature/rice', 'coriander leaves', 'masala mix'],
    35,
    'easy',
    'lunch',
    '1. Soak chickpeas overnight and boil until soft. 2. Heat oil, add cumin and coriander seeds. 3. Add onions and ginger-garlic paste. 4. Add tomatoes and cook well. 5. Add turmeric, masala mix, amchur powder. 6. Add boiled chickpeas with water. 7. Simmer for 15 minutes. 8. Serve with bhature or rice.',
    4,
    340
WHERE auth.uid() IS NOT NULL;

-- Insert Palak Paneer
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Palak Paneer (Spinach Paneer)',
    'North Indian',
    ARRAY['spinach', 'paneer', 'onions', 'tomatoes', 'ginger-garlic paste', 'green chilies', 'cumin seeds', 'turmeric', 'cream', 'oil', 'salt', 'roti/rice', 'masala mix'],
    30,
    'medium',
    'dinner',
    '1. Blanch spinach and blend to puree. 2. Cut paneer into cubes. 3. Heat oil, add cumin seeds. 4. Add onions, ginger-garlic paste. 5. Add tomatoes, green chilies. 6. Add turmeric, masala mix. 7. Add spinach puree and paneer. 8. Add cream, simmer for 5 minutes. 9. Serve with roti or rice.',
    4,
    290
WHERE auth.uid() IS NOT NULL;

-- Insert Vegetable Biryani
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Vegetable Biryani',
    'Hyderabadi',
    ARRAY['basmati rice', 'mixed vegetables', 'onions', 'yogurt', 'ginger-garlic paste', 'biryani masala', 'saffron', 'milk', 'ghee', 'bay leaves', 'cinnamon', 'cardamom', 'mint leaves', 'coriander leaves', 'masala mix'],
    60,
    'hard',
    'lunch',
    '1. Soak rice for 30 minutes. 2. Cook vegetables with masala mix. 3. Fry onions until golden. 4. Layer rice and vegetables in pot. 5. Add saffron soaked in milk. 6. Add fried onions, mint, coriander. 7. Cover and cook on dum for 45 minutes. 8. Serve hot with raita.',
    6,
    420
WHERE auth.uid() IS NOT NULL;

-- Insert Roti/Chapati
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Roti/Chapati',
    'Indian',
    ARRAY['whole wheat flour', 'water', 'salt', 'oil'],
    20,
    'easy',
    'breakfast',
    '1. Mix flour, salt, and a little oil. 2. Gradually add water to form soft dough. 3. Knead well and let rest for 15 minutes. 4. Divide into small balls. 5. Roll each ball into thin circle. 6. Cook on hot griddle until bubbles form. 7. Flip and cook other side. 8. Serve hot.',
    8,
    80
WHERE auth.uid() IS NOT NULL;

-- Insert Jeera Rice
INSERT INTO recipes (user_id, name, cuisine, ingredients, cooking_time, difficulty_level, category, instructions, servings, calories_per_serving)
SELECT 
    auth.uid(),
    'Jeera Rice',
    'Indian',
    ARRAY['basmati rice', 'cumin seeds', 'bay leaves', 'ghee', 'salt', 'water', 'coriander leaves'],
    20,
    'easy',
    'lunch',
    '1. Wash and soak basmati rice for 15 minutes. 2. Heat ghee in pot. 3. Add cumin seeds and bay leaves. 4. Add drained rice and sauté for 2 minutes. 5. Add water and salt. 6. Bring to boil, then simmer covered for 15 minutes. 7. Let it rest for 5 minutes. 8. Garnish with coriander leaves.',
    4,
    200
WHERE auth.uid() IS NOT NULL; 