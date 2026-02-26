import { supabase } from '../config/supabase';
import { normalizeIngredientUnit } from '../utils/normalizeIngredientUnit';
import { logDbError } from '../lib/db/logger';

/**
 * Recipes Service
 * Handles all recipe-related database operations
 */

// Get all recipes for the current user
export const getRecipes = async (filters = {}) => {
  try {
    let query = supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.cuisine) {
      query = query.eq('cuisine', filters.cuisine);
    }
    if (filters.difficulty) {
      query = query.eq('difficulty_level', filters.difficulty);
    }
    if (filters.maxTime) {
      query = query.lte('cooking_time', filters.maxTime);
    }
    if (filters.favorites) {
      query = query.eq('is_favorite', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recipes:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRecipes:', error);
    throw error;
  }
};

// Search recipes by name or ingredients
export const searchRecipes = async (searchTerm, filters = {}) => {
  try {
    let query = supabase
      .from('recipes')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,instructions.ilike.%${searchTerm}%`)
      .order('name', { ascending: true });

    // Apply additional filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.maxTime) {
      query = query.lte('cooking_time', filters.maxTime);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error searching recipes:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchRecipes:', error);
    throw error;
  }
};

// Create a new recipe
export const createRecipe = async (recipeData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('recipes')
      .insert([{
        user_id: user.id,
        name: recipeData.name,
        cuisine: recipeData.cuisine || null,
        ingredients: recipeData.ingredients,
        cooking_time: recipeData.cookingTime,
        difficulty_level: recipeData.difficulty || 'medium',
        category: recipeData.category,
        instructions: recipeData.instructions || null,
        recipe_url: recipeData.recipeUrl || null,
        servings: recipeData.servings || 1,
        calories_per_serving: recipeData.calories || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating recipe:', error);
      throw error;
    }

    return data;
  } catch (error) {
    logDbError('createRecipe', error);
    throw error;
  }
};

/**
 * Create recipe from AI-parsed data: inserts recipe then batch inserts recipe_ingredients.
 * Uses existing recipes columns; optional description/prep/cook/total stored if columns exist.
 */
export const createRecipeFromParsed = async (parsed) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('User not authenticated');

  const totalMinutes = parsed.total_time_minutes ?? ((parsed.prep_time_minutes || 0) + (parsed.cook_time_minutes || 0) || 0);
  const ingredientsList = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  const ingredientsStrings = ingredientsList.map(
    (i) => [i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim() || i.name
  );

  const recipePayload = {
    user_id: user.id,
    name: parsed.title?.trim() || 'Untitled Recipe',
    cooking_time: totalMinutes,
    difficulty_level: 'medium',
    category: 'dinner',
    instructions: parsed.instructions?.trim() || null,
    servings: parsed.servings ?? 1,
    ingredients: ingredientsStrings.length ? ingredientsStrings : [],
  };

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert([recipePayload])
    .select()
    .single();

  if (recipeError) {
    logDbError('createRecipeFromParsed (recipe)', recipeError);
    throw recipeError;
  }

  if (ingredientsList.length > 0 && recipe?.id) {
    const rows = ingredientsList.map((ing) => ({
      recipe_id: recipe.id,
      name: ing.name?.trim() || '',
      quantity: ing.quantity != null ? Number(ing.quantity) : null,
      unit: normalizeIngredientUnit(ing.unit) || ing.unit || null,
      is_optional: Boolean(ing.optional),
      notes: null,
    })).filter((r) => r.name);

    if (rows.length > 0) {
      const { error: ingError } = await supabase.from('recipe_ingredients').insert(rows);
      if (ingError) logDbError('createRecipeFromParsed (ingredients)', ingError);
    }
  }

  return recipe;
};

// Update an existing recipe (only defined fields are sent to avoid overwriting with undefined)
export const updateRecipe = async (recipeId, updates) => {
  try {
    const mapping = {
      name: updates.name,
      cuisine: updates.cuisine,
      ingredients: updates.ingredients,
      cooking_time: updates.cookingTime,
      difficulty_level: updates.difficulty,
      category: updates.category,
      instructions: updates.instructions,
      recipe_url: updates.recipeUrl,
      servings: updates.servings,
      calories_per_serving: updates.calories,
    };
    const updateData = { updated_at: new Date().toISOString() };
    Object.entries(mapping).forEach(([key, value]) => {
      if (value !== undefined) updateData[key] = value;
    });

    const { data, error } = await supabase
      .from('recipes')
      .update(updateData)
      .eq('id', recipeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating recipe:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateRecipe:', error);
    throw error;
  }
};

// Delete a recipe
export const deleteRecipe = async (recipeId) => {
  try {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (error) {
      console.error('Error deleting recipe:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteRecipe:', error);
    throw error;
  }
};

// Toggle favorite status
export const toggleRecipeFavorite = async (recipeId, isFavorite) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .update({ is_favorite: isFavorite })
      .eq('id', recipeId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling recipe favorite:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in toggleRecipeFavorite:', error);
    throw error;
  }
};

// Get recipe by ID
export const getRecipeById = async (recipeId) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (error) {
      console.error('Error fetching recipe:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getRecipeById:', error);
    throw error;
  }
};

// Get recipes that can be made with available ingredients
export const getRecipesWithAvailableIngredients = async (availableIngredients = []) => {
  try {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*');

    if (error) {
      console.error('Error fetching recipes for ingredient matching:', error);
      throw error;
    }

    if (!recipes) return [];

    // Filter recipes based on available ingredients
    const matchedRecipes = recipes.map(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const availableSet = new Set(availableIngredients.map(ing => ing.toLowerCase()));
      
      const matchingIngredients = recipeIngredients.filter(ingredient => 
        availableSet.has(ingredient.toLowerCase())
      );
      
      const matchPercentage = recipeIngredients.length > 0 
        ? (matchingIngredients.length / recipeIngredients.length) * 100 
        : 0;

      return {
        ...recipe,
        matchingIngredients,
        matchPercentage: Math.round(matchPercentage),
        missingIngredients: recipeIngredients.filter(ingredient => 
          !availableSet.has(ingredient.toLowerCase())
        )
      };
    });

    // Sort by match percentage (highest first)
    return matchedRecipes
      .filter(recipe => recipe.matchPercentage > 0)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);

  } catch (error) {
    console.error('Error in getRecipesWithAvailableIngredients:', error);
    throw error;
  }
};

// Get recipe categories
export const getRecipeCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('recipe_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching recipe categories:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRecipeCategories:', error);
    throw error;
  }
};

// Create custom recipe category
export const createRecipeCategory = async (categoryData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('recipe_categories')
      .insert([{
        user_id: user.id,
        name: categoryData.name,
        color: categoryData.color || '#6366f1',
        icon: categoryData.icon || 'utensils'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating recipe category:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createRecipeCategory:', error);
    throw error;
  }
};

// Get recipe statistics
export const getRecipeStatistics = async () => {
  try {
    const recipes = await getRecipes();
    
    const stats = {
      totalRecipes: recipes.length,
      favoriteRecipes: recipes.filter(r => r.is_favorite).length,
      avgCookingTime: recipes.length > 0 
        ? Math.round(recipes.reduce((sum, r) => sum + r.cooking_time, 0) / recipes.length)
        : 0,
      categoryBreakdown: recipes.reduce((acc, recipe) => {
        acc[recipe.category] = (acc[recipe.category] || 0) + 1;
        return acc;
      }, {}),
      difficultyBreakdown: recipes.reduce((acc, recipe) => {
        acc[recipe.difficulty_level] = (acc[recipe.difficulty_level] || 0) + 1;
        return acc;
      }, {}),
      cuisineBreakdown: recipes.reduce((acc, recipe) => {
        if (recipe.cuisine) {
          acc[recipe.cuisine] = (acc[recipe.cuisine] || 0) + 1;
        }
        return acc;
      }, {})
    };

    return stats;
  } catch (error) {
    console.error('Error in getRecipeStatistics:', error);
    throw error;
  }
}; 