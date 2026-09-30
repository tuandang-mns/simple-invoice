import { useEffect } from 'react';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';

/**
 * On page load, asks the API who is signed in. The HttpOnly session cookie (if any) goes with the
 * request automatically; the app itself never sees the token. A new tab therefore starts signed in
 * as long as the browser holds a valid session cookie.
 */
export function useSessionBootstrap() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== 'unknown') return;
    let cancelled = false;
    authApi
      .me()
      .then((user) => !cancelled && useAuthStore.getState().login(user))
      .catch(() => !cancelled && useAuthStore.getState().logout(null));
    return () => {
      cancelled = true;
    };
  }, [status]);
}
