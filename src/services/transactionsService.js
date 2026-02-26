import { supabase } from '../config/supabase';
import { updateAccountBalance, getAccountById } from './accountsService';

/**
 * Transactions Service
 * Handles all transaction-related database operations
 */

// Get all transactions for the current user
export const getTransactions = async (filters = {}) => {
  try {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        accounts:account_id (
          id,
          name,
          type,
          currency
        )
      `)
      .order('date', { ascending: false });

    // Apply filters
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTransactions:', error);
    throw error;
  }
};

// Create a new income transaction
export const createIncomeTransaction = async (incomeData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Start a transaction to ensure data consistency
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert([{
        user_id: user.id,
        account_id: incomeData.accountId,
        type: 'income',
        source: incomeData.source,
        amount: parseFloat(incomeData.amount),
        date: incomeData.date,
        notes: incomeData.notes || null
      }])
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating income transaction:', transactionError);
      throw transactionError;
    }

    // Update account balance
    if (incomeData.accountId) {
      const account = await getAccountById(incomeData.accountId);
      const newBalance = parseFloat(account.balance) + parseFloat(incomeData.amount);
      await updateAccountBalance(incomeData.accountId, newBalance);
    }

    return transaction;
  } catch (error) {
    console.error('Error in createIncomeTransaction:', error);
    throw error;
  }
};

// Create a new expense transaction
export const createExpenseTransaction = async (expenseData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Check if using online payment and validate account balance
    if (expenseData.paymentMethod === 'online' && expenseData.accountId) {
      const account = await getAccountById(expenseData.accountId);
      if (parseFloat(account.balance) < parseFloat(expenseData.amount)) {
        throw new Error('Insufficient funds in selected account');
      }
    }

    // Create the transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert([{
        user_id: user.id,
        account_id: expenseData.accountId || null,
        type: 'expense',
        category: expenseData.category,
        item: expenseData.item,
        amount: parseFloat(expenseData.amount),
        payment_method: expenseData.paymentMethod,
        date: expenseData.date,
        notes: expenseData.notes || null
      }])
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating expense transaction:', transactionError);
      throw transactionError;
    }

    // Update account balance if using online payment
    if (expenseData.paymentMethod === 'online' && expenseData.accountId) {
      const account = await getAccountById(expenseData.accountId);
      const newBalance = parseFloat(account.balance) - parseFloat(expenseData.amount);
      await updateAccountBalance(expenseData.accountId, newBalance);
    }

    return transaction;
  } catch (error) {
    console.error('Error in createExpenseTransaction:', error);
    throw error;
  }
};

// Update an existing transaction
export const updateTransaction = async (transactionId, updates) => {
  try {
    // Get the original transaction to handle account balance adjustments
    const { data: originalTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError) throw fetchError;

    // Update the transaction
    const { data, error } = await supabase
      .from('transactions')
      .update({
        category: updates.category,
        source: updates.source,
        item: updates.item,
        amount: parseFloat(updates.amount),
        date: updates.date,
        notes: updates.notes,
        payment_method: updates.paymentMethod,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }

    // Handle account balance adjustments if amount changed
    if (originalTransaction.account_id && 
        parseFloat(originalTransaction.amount) !== parseFloat(updates.amount)) {
      
      const account = await getAccountById(originalTransaction.account_id);
      let newBalance = parseFloat(account.balance);

      // Reverse the original transaction effect
      if (originalTransaction.type === 'income') {
        newBalance -= parseFloat(originalTransaction.amount);
      } else {
        newBalance += parseFloat(originalTransaction.amount);
      }

      // Apply the new transaction effect
      if (originalTransaction.type === 'income') {
        newBalance += parseFloat(updates.amount);
      } else {
        newBalance -= parseFloat(updates.amount);
      }

      await updateAccountBalance(originalTransaction.account_id, newBalance);
    }

    return data;
  } catch (error) {
    console.error('Error in updateTransaction:', error);
    throw error;
  }
};

// Delete a transaction
export const deleteTransaction = async (transactionId) => {
  try {
    // Get the transaction to handle account balance adjustments
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the transaction
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }

    // Reverse the transaction effect on account balance
    if (transaction.account_id) {
      const account = await getAccountById(transaction.account_id);
      let newBalance = parseFloat(account.balance);

      if (transaction.type === 'income') {
        newBalance -= parseFloat(transaction.amount);
      } else {
        newBalance += parseFloat(transaction.amount);
      }

      await updateAccountBalance(transaction.account_id, newBalance);
    }

    return true;
  } catch (error) {
    console.error('Error in deleteTransaction:', error);
    throw error;
  }
};

// Get transactions by category (for budget tracking)
export const getTransactionsByCategory = async (category, startDate, endDate) => {
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('type', 'expense')
      .eq('category', category)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions by category:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTransactionsByCategory:', error);
    throw error;
  }
};

// Calculate totals
export const calculateTransactionTotals = async (filters = {}) => {
  try {
    const transactions = await getTransactions(filters);
    
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      income,
      expenses,
      netSavings: income - expenses
    };
  } catch (error) {
    console.error('Error in calculateTransactionTotals:', error);
    throw error;
  }
}; 