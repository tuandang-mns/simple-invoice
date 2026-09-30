import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';
import { useSessionBootstrap } from './useSessionBootstrap';

vi.mock('../../api/auth.api', () => ({ authApi: { me: vi.fn() } }));
const me = vi.mocked(authApi.me);
const profile = {
  id: 'u1',
  email: 'admin@simpleinvoice.dev',
  fullname: 'Demo Admin',
  createdAt: '',
};

describe('useSessionBootstrap', () => {
  beforeEach(() => {
    me.mockReset();
    useAuthStore.setState({ status: 'unknown', user: null, expiresAt: null, logoutReason: null });
  });

  it('signs in from an existing session cookie (e.g. a new tab)', async () => {
    me.mockResolvedValue(profile);
    renderHook(() => useSessionBootstrap());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(useAuthStore.getState().user).toEqual(profile);
  });

  it('marks the visitor as signed out, without an "expired" notice, when there is no session', async () => {
    me.mockRejectedValue(new Error('401'));
    renderHook(() => useSessionBootstrap());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'));
    expect(useAuthStore.getState().logoutReason).toBeNull();
  });

  it('does not ask again once the status is known', () => {
    useAuthStore.setState({ status: 'anonymous' });
    renderHook(() => useSessionBootstrap());
    expect(me).not.toHaveBeenCalled();
  });
});
