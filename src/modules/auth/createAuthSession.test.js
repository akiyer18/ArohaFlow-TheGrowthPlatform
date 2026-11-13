import { describe, it, expect, vi } from 'vitest';
import { createAuthSession } from './createAuthSession.js';

describe('Auth session module (#3)', () => {
  it('login succeeds when the adapter returns a user', async () => {
    const auth = createAuthSession({
      login: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      logout: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    });

    await expect(auth.login('a@b.c', 'secret')).resolves.toEqual({ success: true });
  });

  it('login returns adapter error messages', async () => {
    const auth = createAuthSession({
      login: vi.fn(async () => ({ data: {}, error: { message: 'Invalid login' } })),
      logout: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    });

    await expect(auth.login('a@b.c', 'bad')).resolves.toEqual({
      success: false,
      error: 'Invalid login',
    });
  });

  it('subscribeSession maps users and returns unsubscribe', () => {
    let push;
    const unsubscribe = vi.fn();
    const auth = createAuthSession({
      login: vi.fn(),
      logout: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: (cb) => {
        push = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    });

    const seen = [];
    const stop = auth.subscribeSession((user) => seen.push(user));
    push('SIGNED_IN', {
      user: {
        id: 'u1',
        email: 'a@b.c',
        created_at: '2026-01-01',
        email_confirmed_at: '2026-01-01',
        user_metadata: { name: 'Ak' },
      },
    });
    push('SIGNED_OUT', null);

    expect(seen[0]).toMatchObject({ id: 'u1', email: 'a@b.c', name: 'Ak' });
    expect(seen[1]).toBeNull();
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('logout always reports success so the UI can clear', async () => {
    const auth = createAuthSession({
      login: vi.fn(),
      logout: vi.fn(async () => ({ error: { message: 'network' } })),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    });

    await expect(auth.logout()).resolves.toMatchObject({ success: true });
  });
});
