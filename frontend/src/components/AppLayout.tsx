import LogoutIcon from '@mui/icons-material/Logout';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';

/** Authenticated shell: top bar with the current user, and the page outlet. */
export function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const expiresAt = useAuthStore((s) => s.expiresAt);
  const logout = useAuthStore((s) => s.logout);

  // GET /auth/me — confirms the token is still accepted and shows who is signed in.
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 5 * 60_000 });

  // Log out exactly when the JWT expires, instead of waiting for the next failing request.
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => logout('expired'), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt, logout]);

  const handleLogout = () => {
    queryClient.clear(); // don't leave the previous user's data in the cache
    logout('manual');
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* Keyboard users can jump past the header straight to the page content. */}
      <Box
        component="a"
        href="#main"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: (t) => t.zIndex.appBar + 1,
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Box>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <ReceiptLongIcon color="primary" />
          <Typography
            component={RouterLink}
            to="/invoices"
            variant="h6"
            sx={{ color: 'primary.main', textDecoration: 'none', flexGrow: 1 }}
          >
            SimpleInvoice
          </Typography>
          {me && !isMobile && (
            <Typography variant="body2" color="text.secondary" data-testid="current-user">
              {me.fullname}
            </Typography>
          )}
          {isMobile ? (
            <Tooltip title="Sign out">
              <IconButton color="inherit" onClick={handleLogout} aria-label="Sign out">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
              Sign out
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Container
        component="main"
        id="main"
        tabIndex={-1}
        maxWidth="lg"
        sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 }, outline: 'none' }}
      >
        <Outlet />
      </Container>
    </Box>
  );
}
