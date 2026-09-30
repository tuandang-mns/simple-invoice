import { create } from 'zustand';
import type { UserProfile } from '../api/types';

export type LogoutReason = 'expired' | 'manual' | null;

/** 'unknown' until the app has asked the API (GET /auth/me) whether the session cookie is valid. */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  user: UserProfile | null;
  /** Epoch ms when the session ends, when known (sign-in happened in this tab). */
  expiresAt: number | null;
  logoutReason: LogoutReason;
  login: (user: UserProfile, expiresInSeconds?: number) => void;
  logout: (reason?: LogoutReason) => void;
}

/**
 * What the web app knows about the session. The token itself is NOT here and never reaches
 * JavaScript: it lives in an HttpOnly cookie the browser sends automatically, so an XSS bug
 * cannot steal it. Nothing is persisted; on load the app asks GET /auth/me (see
 * useSessionBootstrap), which is also why a new tab is already signed in.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  expiresAt: null,
  logoutReason: null,
  login: (user, expiresInSeconds) =>
    set({
      status: 'authenticated',
      user,
      expiresAt: expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : null,
      logoutReason: null,
    }),
  logout: (reason = 'manual') =>
    set({ status: 'anonymous', user: null, expiresAt: null, logoutReason: reason }),
}));
