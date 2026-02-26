import { supabase } from '../config/supabase';
import { logDbError } from '../lib/db/logger';

/**
 * Calendar Events Service
 * CRUD for calendar_events (unified calendar meetings/events).
 */

export async function getCalendarEvents(startDate, endDate) {
  try {
    const start = new Date(startDate).toISOString();
    const end = new Date(endDate + 'T23:59:59.999Z').toISOString();
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_at', start)
      .lte('start_at', end)
      .order('start_at', { ascending: true });

    if (error) {
      logDbError('getCalendarEvents', error);
      throw error;
    }
    return data ?? [];
  } catch (err) {
    logDbError('getCalendarEvents', err);
    throw err;
  }
}

export async function getCalendarEventsForDate(dateStr) {
  try {
    const start = new Date(dateStr + 'T00:00:00.000Z').toISOString();
    const end = new Date(dateStr + 'T23:59:59.999Z').toISOString();
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_at', start)
      .lte('start_at', end)
      .order('start_at', { ascending: true });

    if (error) {
      logDbError('getCalendarEventsForDate', error);
      throw error;
    }
    return data ?? [];
  } catch (err) {
    logDbError('getCalendarEventsForDate', err);
    throw err;
  }
}

export async function createCalendarEvent(eventData) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const payload = {
      user_id: user.id,
      title: eventData.title,
      description: eventData.description ?? null,
      start_at: eventData.startAt,
      end_at: eventData.endAt ?? eventData.startAt,
      location: eventData.location ?? null,
    };

    const { data, error } = await supabase
      .from('calendar_events')
      .insert([payload])
      .select()
      .single();

    if (error) {
      logDbError('createCalendarEvent', error);
      throw error;
    }
    return data;
  } catch (err) {
    logDbError('createCalendarEvent', err);
    throw err;
  }
}

export async function updateCalendarEvent(eventId, updates) {
  try {
    const payload = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.startAt !== undefined) payload.start_at = updates.startAt;
    if (updates.endAt !== undefined) payload.end_at = updates.endAt;
    if (updates.location !== undefined) payload.location = updates.location;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('calendar_events')
      .update(payload)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      logDbError('updateCalendarEvent', error);
      throw error;
    }
    return data;
  } catch (err) {
    logDbError('updateCalendarEvent', err);
    throw err;
  }
}

export async function deleteCalendarEvent(eventId) {
  try {
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
    if (error) {
      logDbError('deleteCalendarEvent', error);
      throw error;
    }
    return true;
  } catch (err) {
    logDbError('deleteCalendarEvent', err);
    throw err;
  }
}
