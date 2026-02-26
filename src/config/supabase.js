import { DATA_SOURCE, dataClient, dataService } from '../services/data/DataService';
import { isLocalDataSource } from './appConfig';

// Single Supabase/client instance for the app. Use this or supabase.
export function getSupabaseClient() {
  return dataClient;
}

// Backward-compatible export name used throughout existing services.
export const supabase = dataClient;

// Explicitly expose current data source for debugging and feature checks.
export const activeDataSource = DATA_SOURCE;
export const isLocalMode = isLocalDataSource;

export const getCurrentUser = async () => {
  const { user, error } = await dataService.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};

/** Throws if not authenticated. Use in services that require a user. */
export const getCurrentUserId = async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  return user.id;
};

export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};

export default supabase;