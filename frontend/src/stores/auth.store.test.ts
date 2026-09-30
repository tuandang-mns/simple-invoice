import { describe, expect, it } from 'vitest';
import { isSessionValid, useAuthStore } from './auth.store';

describe('auth store', () => {
  it('computes expiry from expiresIn and clears everything on logout', () => {
    const before = Date.now();
    useAuthStore
      .getState()
      .login('t', 3600, { id: '1', email: 'a@b.c', fullname: 'A', createdAt: '' });
    const { expiresAt } = useAuthStore.getState();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 3600_000);
    expect(isSessionValid(useAuthStore.getState())).toBe(true);

    useAuthStore.getState().logout('expired');
    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      logoutReason: 'expired',
    });
    expect(isSessionValid(useAuthStore.getState())).toBe(false);
  });

  it('treats a past expiry as invalid', () => {
    expect(isSessionValid({ token: 't', expiresAt: Date.now() - 1 })).toBe(false);
  });
});
