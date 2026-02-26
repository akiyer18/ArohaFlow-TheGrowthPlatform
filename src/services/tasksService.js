import { supabase } from '../config/supabase';
import { logDbError } from '../lib/db/logger';

/**
 * Tasks Service
 * Handles all task-related database operations
 */

// Get all tasks for the current user with optional filtering
export const getTasks = async (filters = {}) => {
  try {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.startDate) {
      query = query.gte('due_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('due_date', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      logDbError('getTasks', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logDbError('getTasks', error);
    throw error;
  }
};

// Create a new task
export const createTask = async (taskData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        user_id: user.id,
        task_name: taskData.taskName ?? '',
        notes: taskData.notes || null,
        due_date: taskData.dueDate,
        priority: taskData.priority || 'Medium',
        category: taskData.category || 'Other',
        status: 'Pending',
      }])
      .select()
      .single();

    if (error) {
      logDbError('createTask', error);
      throw error;
    }

    return data;
  } catch (error) {
    logDbError('createTask', error);
    throw error;
  }
};

// Update an existing task
export const updateTask = async (taskId, updates) => {
  try {
    const updateData = {
      task_name: updates.taskName,
      notes: updates.notes,
      due_date: updates.dueDate,
      priority: updates.priority,
      category: updates.category,
      updated_at: new Date().toISOString()
    };

    // Only update status and completed_on if status is being changed to completed
    if (updates.status === 'Completed' && updates.status !== updates.currentStatus) {
      updateData.status = 'Completed';
      updateData.completed_on = new Date().toISOString();
    } else if (updates.status && updates.status !== 'Completed') {
      updateData.status = updates.status;
      updateData.completed_on = null;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      logDbError('updateTask', error);
      throw error;
    }

    return data;
  } catch (error) {
    logDbError('updateTask', error);
    throw error;
  }
};

// Complete a task
export const completeTask = async (taskId) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'Completed',
        completed_on: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      logDbError('completeTask', error);
      throw error;
    }

    return data;
  } catch (error) {
    logDbError('completeTask', error);
    throw error;
  }
};

// Delete a task
export const deleteTask = async (taskId) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      logDbError('deleteTask', error);
      throw error;
    }

    return true;
  } catch (error) {
    logDbError('deleteTask', error);
    throw error;
  }
};

// Get pending tasks (active tasks)
export const getPendingTasks = async () => {
  try {
    return await getTasks({ status: 'Pending' });
  } catch (error) {
    logDbError('getPendingTasks', error);
    throw error;
  }
};

// Get completed tasks (last 30 days)
export const getCompletedTasks = async (days = 30) => {
  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'Completed')
      .gte('completed_on', daysAgo.toISOString())
      .order('completed_on', { ascending: false });

    if (error) {
      logDbError('getCompletedTasks', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logDbError('getCompletedTasks', error);
    throw error;
  }
};

// Get tasks due today
export const getTasksDueToday = async () => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'Pending')
      .gte('due_date', startOfDay.toISOString())
      .lte('due_date', endOfDay.toISOString())
      .order('due_date', { ascending: true });

    if (error) {
      logDbError('getTasksDueToday', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logDbError('getTasksDueToday', error);
    throw error;
  }
};

// Get overdue tasks
export const getOverdueTasks = async () => {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'Pending')
      .lt('due_date', now)
      .order('due_date', { ascending: true });

    if (error) {
      logDbError('getOverdueTasks', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logDbError('getOverdueTasks', error);
    throw error;
  }
};

// Get tasks grouped by time period (today, this week, upcoming)
export const getTasksGroupedByTime = async () => {
  try {
    const tasks = await getPendingTasks();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromToday = new Date(today);
    weekFromToday.setDate(weekFromToday.getDate() + 7);

    const groups = {
      today: [],
      thisWeek: [],
      upcoming: []
    };

    tasks.forEach(task => {
      const taskDate = new Date(task.due_date);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      
      if (taskDay <= today) {
        groups.today.push(task);
      } else if (taskDay <= weekFromToday) {
        groups.thisWeek.push(task);
      } else {
        groups.upcoming.push(task);
      }
    });

    return groups;
  } catch (error) {
    logDbError('getTasksGroupedByTime', error);
    throw error;
  }
};

// Get task statistics
export const getTaskStatistics = async () => {
  try {
    const [pendingTasks, completedTasks, overdueTasks] = await Promise.all([
      getPendingTasks(),
      getCompletedTasks(7), // Last 7 days
      getOverdueTasks()
    ]);

    // Priority breakdown
    const priorityBreakdown = pendingTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});

    // Category breakdown
    const categoryBreakdown = pendingTasks.reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPending: pendingTasks.length,
      totalCompleted: completedTasks.length,
      totalOverdue: overdueTasks.length,
      priorityBreakdown,
      categoryBreakdown,
      completionRate: pendingTasks.length > 0 
        ? (completedTasks.length / (completedTasks.length + pendingTasks.length)) * 100 
        : 0
    };
  } catch (error) {
    logDbError('getTaskStatistics', error);
    throw error;
  }
};

// Search tasks
export const searchTasks = async (searchTerm, filters = {}) => {
  try {
    let query = supabase
      .from('tasks')
      .select('*')
      .or(`task_name.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
      .order('due_date', { ascending: true });

    // Apply additional filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
      logDbError('searchTasks', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logDbError('searchTasks', error);
    throw error;
  }
}; 