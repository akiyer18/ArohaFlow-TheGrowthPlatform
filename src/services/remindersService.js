import { supabase } from '../config/supabase';

/**
 * Reminders Service
 * Handles payment reminders and notifications
 */

export const getReminders = async () => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getReminders:', error);
    throw error;
  }
};

export const createReminder = async (reminderData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('reminders')
      .insert([{
        user_id: user.id,
        title: reminderData.title,
        amount: parseFloat(reminderData.amount),
        due_date: reminderData.date,
        priority: reminderData.priority,
        currency: reminderData.currency || 'USD',
        is_recurring: reminderData.isRecurring || false,
        frequency: reminderData.frequency || null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in createReminder:', error);
    throw error;
  }
};

export const updateReminder = async (reminderId, updates) => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .update({
        title: updates.title,
        amount: parseFloat(updates.amount),
        due_date: updates.date,
        priority: updates.priority,
        currency: updates.currency,
        is_recurring: updates.isRecurring,
        frequency: updates.frequency,
        is_completed: updates.isCompleted
      })
      .eq('id', reminderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateReminder:', error);
    throw error;
  }
};

export const deleteReminder = async (reminderId) => {
  try {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error in deleteReminder:', error);
    throw error;
  }
};

export const getUpcomingReminders = async (days = 7) => {
  try {
    const today = new Date();
    const futureDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));
    
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .eq('is_completed', false)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getUpcomingReminders:', error);
    throw error;
  }
};

export const markReminderComplete = async (reminderId) => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .update({ is_completed: true })
      .eq('id', reminderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in markReminderComplete:', error);
    throw error;
  }
}; 