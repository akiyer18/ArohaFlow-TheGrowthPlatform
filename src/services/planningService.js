import { supabase } from '../config/supabase';

/**
 * Planning Service
 * Handles planned expenses and income ideas
 */

// PLANNED EXPENSES
export const getPlannedExpenses = async () => {
  try {
    const { data, error } = await supabase
      .from('planned_expenses')
      .select('*')
      .order('target_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getPlannedExpenses:', error);
    throw error;
  }
};

export const createPlannedExpense = async (expenseData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('planned_expenses')
      .insert([{
        user_id: user.id,
        item: expenseData.item,
        cost: parseFloat(expenseData.cost),
        target_date: expenseData.date,
        category: expenseData.category,
        currency: expenseData.currency || 'USD'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in createPlannedExpense:', error);
    throw error;
  }
};

export const updatePlannedExpense = async (expenseId, updates) => {
  try {
    const { data, error } = await supabase
      .from('planned_expenses')
      .update({
        item: updates.item,
        cost: parseFloat(updates.cost),
        target_date: updates.date,
        category: updates.category,
        currency: updates.currency,
        is_completed: updates.isCompleted
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updatePlannedExpense:', error);
    throw error;
  }
};

export const deletePlannedExpense = async (expenseId) => {
  try {
    const { error } = await supabase
      .from('planned_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error in deletePlannedExpense:', error);
    throw error;
  }
};

// INCOME IDEAS
export const getIncomeIdeas = async () => {
  try {
    const { data, error } = await supabase
      .from('income_ideas')
      .select('*')
      .order('target_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getIncomeIdeas:', error);
    throw error;
  }
};

export const createIncomeIdea = async (ideaData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('income_ideas')
      .insert([{
        user_id: user.id,
        idea: ideaData.idea,
        expected_amount: parseFloat(ideaData.amount),
        target_date: ideaData.date,
        confidence_level: parseInt(ideaData.confidence),
        currency: ideaData.currency || 'USD',
        is_recurring: ideaData.isRecurring || false,
        frequency: ideaData.frequency || null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in createIncomeIdea:', error);
    throw error;
  }
};

export const updateIncomeIdea = async (ideaId, updates) => {
  try {
    const { data, error } = await supabase
      .from('income_ideas')
      .update({
        idea: updates.idea,
        expected_amount: parseFloat(updates.amount),
        target_date: updates.date,
        confidence_level: parseInt(updates.confidence),
        currency: updates.currency,
        is_recurring: updates.isRecurring,
        frequency: updates.frequency,
        is_completed: updates.isCompleted
      })
      .eq('id', ideaId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateIncomeIdea:', error);
    throw error;
  }
};

export const deleteIncomeIdea = async (ideaId) => {
  try {
    const { error } = await supabase
      .from('income_ideas')
      .delete()
      .eq('id', ideaId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error in deleteIncomeIdea:', error);
    throw error;
  }
}; 