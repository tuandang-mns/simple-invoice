import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';
import { renderWithProviders, signOut } from '../../test/render';
import { LoginPage } from './LoginPage';
import { RequireAuth } from './RequireAuth';

vi.mock('../../api/auth.api', () => ({ authApi: { login: vi.fn(), me: vi.fn() } }));
const login = vi.mocked(authApi.login);

function unauthorized() {
  return new AxiosError('Unauthorized', '401', undefined, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 401, message: 'Invalid email or password', error: 'Unauthorized' },
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    signOut();
    login.mockReset();
  });

  it('validates required fields and email format on the client', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('stores the session and redirects to the invoice list on success', async () => {
    login.mockResolvedValue({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: 'u1', email: 'admin@simpleinvoice.dev', fullname: 'Demo Admin', createdAt: '' },
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });

    await user.type(screen.getByLabelText(/email address/i), 'admin@simpleinvoice.dev');
    await user.type(screen.getByLabelText(/^password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/invoices'));
    expect(login).toHaveBeenCalledWith('admin@simpleinvoice.dev', 'Password123!');
    expect(useAuthStore.getState().token).toBe('jwt-token');
  });

  it('shows the server error for invalid credentials', async () => {
    login.mockRejectedValue(unauthorized());
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });

    await user.type(screen.getByLabelText(/email address/i), 'admin@simpleinvoice.dev');
    await user.type(screen.getByLabelText(/^password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(useAuthStore.getState().token).toBeNull();
    expect(screen.getByLabelText(/^password/i)).toHaveValue(''); // rejected password is cleared
  });

  it('returns the user to the deep link they were bounced from (path + query)', async () => {
    login.mockResolvedValue({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: 'u1', email: 'admin@simpleinvoice.dev', fullname: 'Demo Admin', createdAt: '' },
    });
    const user = userEvent.setup();
    // Render the real guard + login page so the redirect state is produced exactly as in the app.
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/invoices/:id"
          element={
            <RequireAuth>
              <div>invoice page</div>
            </RequireAuth>
          }
        />
      </Routes>,
      { route: '/invoices/abc?tab=items' },
    );

    await user.type(await screen.findByLabelText(/email address/i), 'admin@simpleinvoice.dev');
    await user.type(screen.getByLabelText(/^password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('invoice page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/invoices/abc?tab=items');
  });
});
