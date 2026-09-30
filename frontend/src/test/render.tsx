import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { SnackbarProvider } from 'notistack';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { theme } from '../theme';

/** Renders the current location so tests can assert on navigation. */
export function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/** Test harness with all app providers and an in-memory router. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '*' }: { route?: string; path?: string } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

export function signIn() {
  useAuthStore.getState().login(
    {
      id: 'u1',
      email: 'admin@simpleinvoice.dev',
      fullname: 'Demo Admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    3600,
  );
}

export function signOut() {
  useAuthStore.setState({ status: 'anonymous', user: null, expiresAt: null, logoutReason: null });
}
