import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../../stores/auth.store';
import { renderWithProviders, signIn, signOut } from '../../test/render';
import { RequireAuth } from './RequireAuth';

const Protected = () => (
  <RequireAuth>
    <div>secret invoices</div>
  </RequireAuth>
);

describe('RequireAuth', () => {
  beforeEach(signOut);

  it('redirects unauthenticated users to /login', () => {
    renderWithProviders(<Protected />, { route: '/invoices', path: '/invoices' });
    expect(screen.queryByText('secret invoices')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('renders the protected page for a valid session', () => {
    signIn();
    renderWithProviders(<Protected />, { route: '/invoices', path: '/invoices' });
    expect(screen.getByText('secret invoices')).toBeInTheDocument();
  });

  it('treats an expired token as signed out', () => {
    signIn();
    useAuthStore.setState({ expiresAt: Date.now() - 1000 });
    renderWithProviders(<Protected />, { route: '/invoices', path: '/invoices' });
    expect(screen.queryByText('secret invoices')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });
});
