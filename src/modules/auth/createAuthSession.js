/**
 * Auth session module — thin interface (issue #3).
 *
 * login / logout / subscribeSession only. Local vs Supabase are adapters.
 * Google OAuth for Gmail/Calendar stays on the Agent Service.
 *
 * @param {{
 *   login: (email: string, password: string) => Promise<{ data: object, error: object|null }>,
 *   logout: () => Promise<{ error: object|null }>,
 *   getSession: () => Promise<{ data: { session: object|null }, error: object|null }>,
 *   onAuthStateChange: (cb: Function) => { data: { subscription: { unsubscribe: Function } } },
 *   mapUser?: (sessionUser: object) => object,
 * }} ports
 */
export function createAuthSession(ports) {
  const mapUser =
    ports.mapUser ??
    ((sessionUser) => ({
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0],
      createdAt: sessionUser.created_at,
      emailConfirmed: Boolean(sessionUser.email_confirmed_at),
    }));

  async function login(email, password) {
    const { data, error } = await ports.login(email, password);
    if (error) {
      return { success: false, error: error.message || 'Login failed. Please check your credentials.' };
    }
    if (data?.user) return { success: true };
    return { success: false, error: 'Login failed. Please try again.' };
  }

  async function logout() {
    const { error } = await ports.logout();
    if (error) {
      // Still succeed locally; session listener clears user.
      return { success: true, error: error.message };
    }
    return { success: true };
  }

  /**
   * Subscribe to session changes. Invokes listener with mapped user or null.
   * @param {(user: object|null) => void} listener
   * @returns {() => void} unsubscribe
   */
  function subscribeSession(listener) {
    const { data } = ports.onAuthStateChange((_event, session) => {
      listener(session?.user ? mapUser(session.user) : null);
    });
    return () => data?.subscription?.unsubscribe?.();
  }

  async function getCurrentUser() {
    const { data, error } = await ports.getSession();
    if (error || !data?.session?.user) return null;
    return mapUser(data.session.user);
  }

  return { login, logout, subscribeSession, getCurrentUser };
}
