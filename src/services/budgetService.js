import { supabase } from '../config/supabase';
import { getTransactionsByCategory } from './transactionsService';

/**
 * Budget Service
 * Handles budget category operations and spending tracking
 */

export const getBudgetCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('budget_categories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getBudgetCategories:', error);
    throw error;
  }
};

export const createBudgetCategory = async (categoryData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('budget_categories')
      .insert([{
        user_id: user.id,
        name: categoryData.name,
        category_type: categoryData.categoryType,
        budget_amount: parseFloat(categoryData.budget)
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in createBudgetCategory:', error);
    throw error;
  }
};

export const updateBudgetCategory = async (categoryId, updates) => {
  try {
    const { data, error } = await supabase
      .from('budget_categories')
      .update({
        name: updates.name,
        category_type: updates.categoryType,
        budget_amount: parseFloat(updates.budget)
      })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateBudgetCategory:', error);
    throw error;
  }
};

export const deleteBudgetCategory = async (categoryId) => {
  try {
    const { error } = await supabase
      .from('budget_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error in deleteBudgetCategory:', error);
    throw error;
  }
};

export const getBudgetAnalysis = async () => {
  try {
    const categories = await getBudgetCategories();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startDate = `${currentMonth}-01`;
    const endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

    const analysis = await Promise.all(
      categories.map(async (category) => {
        const transactions = await getTransactionsByCategory(category.category_type, startDate, endDate);
        const spent = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const remaining = category.budget_amount - spent;
        const percentage = category.budget_amount > 0 ? (spent / category.budget_amount) * 100 : 0;

        return {
          ...category,
          spent,
          remaining,
          percentage,
          status: percentage > 100 ? 'over' : percentage > 80 ? 'warning' : 'good'
        };
      })
    );

    return analysis;
  } catch (error) {
    console.error('Error in getBudgetAnalysis:', error);
    throw error;
  }
}; 