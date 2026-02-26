import { supabase } from '../config/supabase';

/**
 * Accounts Service
 * Handles all account-related database operations
 */

// Get all accounts for the current user
export const getAccounts = async () => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAccounts:', error);
    throw error;
  }
};

// Create a new account
export const createAccount = async (accountData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('accounts')
      .insert([{
        user_id: user.id,
        name: accountData.name,
        type: accountData.type,
        balance: parseFloat(accountData.balance) || 0,
        currency: accountData.currency || 'USD'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createAccount:', error);
    throw error;
  }
};

// Update an existing account
export const updateAccount = async (accountId, updates) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        name: updates.name,
        type: updates.type,
        balance: parseFloat(updates.balance),
        currency: updates.currency,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      console.error('Error updating account:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateAccount:', error);
    throw error;
  }
};

// Delete an account
export const deleteAccount = async (accountId) => {
  try {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      console.error('Error deleting account:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteAccount:', error);
    throw error;
  }
};

// Update account balance (for transactions)
export const updateAccountBalance = async (accountId, newBalance) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update({ 
        balance: parseFloat(newBalance),
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      console.error('Error updating account balance:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateAccountBalance:', error);
    throw error;
  }
};

// Get account by ID
export const getAccountById = async (accountId) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) {
      console.error('Error fetching account:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getAccountById:', error);
    throw error;
  }
};

// Calculate total balance across all accounts
export const getTotalBalance = async () => {
  try {
    const accounts = await getAccounts();
    return accounts.reduce((total, account) => total + parseFloat(account.balance), 0);
  } catch (error) {
    console.error('Error in getTotalBalance:', error);
    throw error;
  }
}; 