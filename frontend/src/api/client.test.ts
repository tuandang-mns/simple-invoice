import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/auth.store';
import { signIn, signOut } from '../test/render';
import { getErrorMessages, http } from './client';

/** Replaces the network with a fake that records requests and answers with `status`. */
function fakeServer(status: number, data: unknown = {}) {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = (config) => {
    seen.push(config);
    const response = { data, status, statusText: '', headers: {}, config };
    return status < 400
      ? Promise.resolve(response)
      : Promise.reject(new AxiosError('fail', String(status), config, undefined, response));
  };
  http.defaults.adapter = adapter;
  return seen;
}

describe('http client', () => {
  const original = http.defaults.adapter;
  beforeEach(signOut);
  afterEach(() => {
    http.defaults.adapter = original;
  });

  it('sends the bearer token and serialises list params into the query string', async () => {
    signIn();
    const seen = fakeServer(200);
    await http.get('/invoices', { params: { page: 2, status: 'Overdue', keyword: undefined } });

    expect(seen[0].headers.Authorization).toBe('Bearer test-token');
    expect(http.getUri(seen[0])).toBe('http://localhost:3000/invoices?page=2&status=Overdue');
  });

  it('sends no Authorization header when signed out', async () => {
    const seen = fakeServer(200);
    await http.post('/auth/login', {});
    expect(seen[0].headers.Authorization).toBeUndefined();
  });

  it('ends the session on a 401 from a protected endpoint', async () => {
    signIn();
    fakeServer(401, {
      statusCode: 401,
      message: 'Invalid or expired access token',
      error: 'Unauthorized',
    });
    await expect(http.get('/invoices')).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState()).toMatchObject({ token: null, logoutReason: 'expired' });
  });

  it('does not treat a failed login as an expired session', async () => {
    fakeServer(401, {
      statusCode: 401,
      message: 'Invalid email or password',
      error: 'Unauthorized',
    });
    await expect(http.post('/auth/login', {})).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().logoutReason).toBeNull();
  });

  it('turns API errors into user-facing messages', async () => {
    fakeServer(400, { statusCode: 400, message: ['a', 'b'], error: 'Bad Request' });
    const error = await http.get('/x').catch((e: unknown) => e);
    expect(getErrorMessages(error)).toEqual(['a', 'b']);
    expect(getErrorMessages(new Error('boom'))).toEqual([
      'Something went wrong. Please try again.',
    ]);
  });
});
