import { supabase } from '../config/supabase';

/**
 * Meal Planning Service
 * Handles meal plan management and integration with recipes and grocery lists
 */

// Get meal plans for a date range
export const getMealPlans = async (startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('meal_plans_with_recipes')
      .select('*')
      .gte('planned_date', startDate)
      .lte('planned_date', endDate)
      .order('planned_date', { ascending: true })
      .order('meal_type', { ascending: true });

    if (error) {
      console.error('Error fetching meal plans:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getMealPlans:', error);
    throw error;
  }
};

// Get meal plans for current week
export const getWeeklyMealPlan = async () => {
  try {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)

    return await getMealPlans(
      weekStart.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0]
    );
  } catch (error) {
    console.error('Error in getWeeklyMealPlan:', error);
    throw error;
  }
};

// Get meal plans for a specific date
export const getMealPlansForDate = async (date) => {
  try {
    const { data, error } = await supabase
      .from('meal_plans_with_recipes')
      .select('*')
      .eq('planned_date', date)
      .order('meal_type', { ascending: true });

    if (error) {
      console.error('Error fetching meal plans for date:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getMealPlansForDate:', error);
    throw error;
  }
};

// Create a new meal plan
export const createMealPlan = async (mealPlanData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('meal_plans')
      .insert([{
        user_id: user.id,
        recipe_id: mealPlanData.recipeId,
        planned_date: mealPlanData.date,
        meal_type: mealPlanData.mealType,
        servings: mealPlanData.servings || 1,
        notes: mealPlanData.notes || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating meal plan:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createMealPlan:', error);
    throw error;
  }
};

// Update a meal plan
export const updateMealPlan = async (mealPlanId, updates) => {
  try {
    const updateData = {
      recipe_id: updates.recipeId,
      planned_date: updates.date,
      meal_type: updates.mealType,
      servings: updates.servings,
      notes: updates.notes,
      is_prepared: updates.isPrepared,
      updated_at: new Date().toISOString()
    };

    if (updates.isPrepared) {
      updateData.prepared_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('meal_plans')
      .update(updateData)
      .eq('id', mealPlanId)
      .select()
      .single();

    if (error) {
      console.error('Error updating meal plan:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateMealPlan:', error);
    throw error;
  }
};

// Delete a meal plan
export const deleteMealPlan = async (mealPlanId) => {
  try {
    const { error } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', mealPlanId);

    if (error) {
      console.error('Error deleting meal plan:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteMealPlan:', error);
    throw error;
  }
};

// Mark meal as prepared
export const markMealAsPrepared = async (mealPlanId) => {
  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .update({
        is_prepared: true,
        prepared_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', mealPlanId)
      .select()
      .single();

    if (error) {
      console.error('Error marking meal as prepared:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in markMealAsPrepared:', error);
    throw error;
  }
};

// Get upcoming meals (next 7 days)
export const getUpcomingMeals = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekDate = nextWeek.toISOString().split('T')[0];

    return await getMealPlans(today, nextWeekDate);
  } catch (error) {
    console.error('Error in getUpcomingMeals:', error);
    throw error;
  }
};

// Get meal plan statistics
export const getMealPlanStatistics = async () => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);

    const monthlyPlans = await getMealPlans(
      startOfMonth.toISOString().split('T')[0],
      endOfMonth.toISOString().split('T')[0]
    );

    const stats = {
      totalPlannedMeals: monthlyPlans.length,
      preparedMeals: monthlyPlans.filter(plan => plan.is_prepared).length,
      mealTypeBreakdown: monthlyPlans.reduce((acc, plan) => {
        acc[plan.meal_type] = (acc[plan.meal_type] || 0) + 1;
        return acc;
      }, {}),
      averageCookingTime: monthlyPlans.length > 0 
        ? Math.round(monthlyPlans.reduce((sum, plan) => sum + (plan.cooking_time || 0), 0) / monthlyPlans.length)
        : 0,
      preparationRate: monthlyPlans.length > 0 
        ? Math.round((monthlyPlans.filter(plan => plan.is_prepared).length / monthlyPlans.length) * 100)
        : 0
    };

    return stats;
  } catch (error) {
    console.error('Error in getMealPlanStatistics:', error);
    throw error;
  }
};

// Suggest recipes based on criteria
export const suggestRecipesForMealPlan = async (criteria = {}) => {
  try {
    let query = supabase
      .from('recipes')
      .select('*');

    // Apply criteria filters
    if (criteria.maxTime) {
      query = query.lte('cooking_time', criteria.maxTime);
    }
    if (criteria.difficulty) {
      query = query.eq('difficulty_level', criteria.difficulty);
    }
    if (criteria.category) {
      query = query.eq('category', criteria.category);
    }
    if (criteria.cuisine) {
      query = query.eq('cuisine', criteria.cuisine);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching recipe suggestions:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in suggestRecipesForMealPlan:', error);
    throw error;
  }
};

// Generate shopping list from meal plans
export const generateShoppingListFromMealPlans = async (startDate, endDate) => {
  try {
    const mealPlans = await getMealPlans(startDate, endDate);
    const ingredientsMap = new Map();

    // Collect all ingredients from meal plans
    mealPlans.forEach(plan => {
      if (plan.ingredients && Array.isArray(plan.ingredients)) {
        plan.ingredients.forEach(ingredient => {
          const key = ingredient.toLowerCase();
          if (ingredientsMap.has(key)) {
            ingredientsMap.set(key, ingredientsMap.get(key) + (plan.servings || 1));
          } else {
            ingredientsMap.set(key, plan.servings || 1);
          }
        });
      }
    });

    // Convert to grocery items format
    const groceryItems = Array.from(ingredientsMap.entries()).map(([ingredient, quantity]) => ({
      name: ingredient,
      quantity: quantity.toString(),
      category: 'Other', // Could be enhanced with ingredient categorization
      added_from_meal_plan: true
    }));

    return groceryItems;
  } catch (error) {
    console.error('Error in generateShoppingListFromMealPlans:', error);
    throw error;
  }
};

// Clone meal plan to another date
export const cloneMealPlan = async (mealPlanId, newDate) => {
  try {
    // Get the original meal plan
    const { data: originalPlan, error: fetchError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', mealPlanId)
      .single();

    if (fetchError) {
      console.error('Error fetching original meal plan:', fetchError);
      throw fetchError;
    }

    // Create new meal plan with same data but different date
    const newMealPlanData = {
      recipeId: originalPlan.recipe_id,
      date: newDate,
      mealType: originalPlan.meal_type,
      servings: originalPlan.servings,
      notes: originalPlan.notes
    };

    return await createMealPlan(newMealPlanData);
  } catch (error) {
    console.error('Error in cloneMealPlan:', error);
    throw error;
  }
}; 