import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSessionValid, useAuthStore } from '../../stores/auth.store';

/**
 * Route guard: renders children only for a valid (present + unexpired) session.
 * Otherwise redirects to /login, remembering where the user wanted to go.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const expiresAt = useAuthStore((s) => s.expiresAt);
  const location = useLocation();

  if (!isSessionValid({ token, expiresAt })) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
