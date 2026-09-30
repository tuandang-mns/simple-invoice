import { describe, expect, it } from 'vitest';
import { useAuthStore } from './auth.store';

const profile = { id: '1', email: 'a@b.c', fullname: 'A', createdAt: '' };

describe('auth store', () => {
  it('starts unknown until the API has been asked', () => {
    expect(useAuthStore.getInitialState().status).toBe('unknown');
  });

  it('records the signed-in user and expiry, and clears everything on logout', () => {
    const before = Date.now();
    useAuthStore.getState().login(profile, 3600);
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user: profile });
    expect(useAuthStore.getState().expiresAt).toBeGreaterThanOrEqual(before + 3600_000);

    useAuthStore.getState().logout('expired');
    expect(useAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      user: null,
      expiresAt: null,
      logoutReason: 'expired',
    });
  });

  it('holds no token and writes nothing to web storage', () => {
    useAuthStore.getState().login(profile, 3600);
    expect(Object.keys(useAuthStore.getState())).not.toContain('token');
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
