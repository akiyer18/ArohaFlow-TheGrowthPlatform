/**
 * Smart Bank Statement Analyzer: store and query normalized transactions only.
 * Raw files are not stored.
 */

import { supabase } from '../config/supabase';
import { getCurrentUserId } from '../config/supabase';
import { logDbError } from '../lib/db/logger';

export async function getBankStatementTransactions(filters = {}) {
  try {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('bank_statement_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.type) query = query.eq('type', filters.type);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    logDbError('getBankStatementTransactions', err);
    throw err;
  }
}

export async function saveBankStatementTransactions(transactions, sourceBank = null) {
  try {
    const userId = await getCurrentUserId();
    const rows = transactions.map((t) => ({
      user_id: userId,
      date: t.date,
      description: t.description || '',
      amount: Math.abs(Number(t.amount)) || 0,
      type: t.type || (Number(t.amount) < 0 ? 'expense' : 'income'),
      merchant: t.merchant || null,
      category: t.category || 'Uncategorized',
      source_bank: sourceBank || t.sourceBank || null,
    }));

    if (rows.length === 0) return [];
    const { data, error } = await supabase
      .from('bank_statement_transactions')
      .insert(rows)
      .select();
    if (error) throw error;
    return data || [];
  } catch (err) {
    logDbError('saveBankStatementTransactions', err);
    throw err;
  }
}

export async function deleteAllBankStatementTransactions() {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('bank_statement_transactions')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  } catch (err) {
    logDbError('deleteAllBankStatementTransactions', err);
    throw err;
  }
}

export async function updateBankStatementTransactionCategory(id, category) {
  try {
    const userId = await getCurrentUserId();
    const categoryStr = category == null || category === '' ? 'Uncategorized' : String(category);
    const { data, error } = await supabase
      .from('bank_statement_transactions')
      .update({ category: categoryStr })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    logDbError('updateBankStatementTransactionCategory', err);
    throw err;
  }
}
