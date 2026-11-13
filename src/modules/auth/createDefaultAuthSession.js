import { supabase } from '../../config/supabase.js';
import { dataService } from '../../services/data/DataService.js';
import { createAuthSession } from './createAuthSession.js';

/** Production Auth session module: dataService login/logout + supabase session bus. */
export function createDefaultAuthSession() {
  return createAuthSession({
    login: (email, password) => dataService.login(email, password),
    logout: () => dataService.logout(),
    getSession: () => supabase.auth.getSession(),
    onAuthStateChange: (cb) => supabase.auth.onAuthStateChange(cb),
  });
}
