import '@fontsource-variable/geist'; // self-hosted: allowed by CSP font-src 'self'
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { getErrorStatus } from './api/client';
import { AppRoutes } from './App';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry transient failures only — never 4xx (e.g. 401/404 won't fix themselves).
      retry: (failureCount, error) => {
        const status = getErrorStatus(error);
        return (status === undefined || status >= 500) && failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
