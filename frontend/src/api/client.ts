import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../stores/auth.store';
import type { ApiErrorBody } from './types';

/**
 * Shared HTTP client. Authentication is the HttpOnly session cookie, which the browser attaches
 * itself (`withCredentials`); this code never sees or sends a token. Expired sessions are
 * handled centrally below.
 */
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (
      error.response?.status === 401 &&
      !isLoginCall &&
      useAuthStore.getState().status === 'authenticated'
    ) {
      // Session expired or revoked (e.g. signed out in another tab) → <RequireAuth> redirects to /login.
      useAuthStore.getState().logout('expired');
    }
    return Promise.reject(error);
  },
);

/** Normalises any error into user-facing messages. */
export function getErrorMessages(error: unknown): string[] {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message;
    if (typeof message === 'string') return [message];
    if (!error.response) return ['Cannot reach the server. Please check your connection.'];
  }
  return ['Something went wrong. Please try again.'];
}

export function getErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}
