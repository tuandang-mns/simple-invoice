import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UserProfile } from '../api/types';

export type LogoutReason = 'expired' | 'manual' | null;

interface AuthState {
  token: string | null;
  /** Epoch ms when the token stops being valid. */
  expiresAt: number | null;
  user: UserProfile | null;
  logoutReason: LogoutReason;
  login: (token: string, expiresInSeconds: number, user: UserProfile) => void;
  logout: (reason?: LogoutReason) => void;
}

/**
 * Client session. Persisted to sessionStorage (not localStorage): the token is cleared
 * when the tab closes and is not shared across tabs. See docs/ARCHITECTURE.md §6 for
 * the trade-off vs httpOnly cookies.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      user: null,
      logoutReason: null,
      login: (token, expiresInSeconds, user) =>
        set({ token, user, expiresAt: Date.now() + expiresInSeconds * 1000, logoutReason: null }),
      logout: (reason = 'manual') =>
        set({ token: null, expiresAt: null, user: null, logoutReason: reason }),
    }),
    {
      name: 'simple-invoice.session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ token, expiresAt, user }) => ({ token, expiresAt, user }),
    },
  ),
);

/** True when a token exists and has not expired. */
export function isSessionValid(state: Pick<AuthState, 'token' | 'expiresAt'>, now = Date.now()) {
  return Boolean(state.token && state.expiresAt && state.expiresAt > now);
}
