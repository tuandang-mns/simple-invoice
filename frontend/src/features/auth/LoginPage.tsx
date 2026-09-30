import { zodResolver } from '@hookform/resolvers/zod';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { authApi } from '../../api/auth.api';
import { getErrorMessages } from '../../api/client';
import { useAuthStore } from '../../stores/auth.store';
import { loginSchema, type LoginFormValues } from './login.schema';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, logoutReason, login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  // Where to go after signing in: the page the user was bounced from (deep link), else the list.
  // Used by BOTH the post-login navigate and the "already signed in" redirect below — otherwise the
  // re-render triggered by login() would redirect to /invoices and win over the deep link.
  const from = (location.state as { from?: Location } | null)?.from;
  const redirectTo =
    from && from.pathname !== '/login' ? `${from.pathname}${from.search}` : '/invoices';

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => authApi.login(values.email, values.password),
    onSuccess: (res) => {
      // The API also returns the token in the body (for API clients); the web app ignores it
      // and relies on the HttpOnly cookie set by the same response.
      login(res.user, res.expiresIn);
      navigate(redirectTo, { replace: true });
    },
    onError: () => resetField('password'), // never leave a rejected password in the field
  });

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 } }}>
        <Stack spacing={1} alignItems="center" mb={3}>
          <ReceiptLongIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h1" component="h1">
            SimpleInvoice
          </Typography>
          <Typography color="text.secondary">Sign in to manage your invoices</Typography>
        </Stack>

        {logoutReason === 'expired' && !loginMutation.isError && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Your session has expired. Please sign in again.
          </Alert>
        )}
        {loginMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {getErrorMessages(loginMutation.error).join(' ')}
          </Alert>
        )}

        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        >
          <Stack spacing={2}>
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              autoFocus
              size="medium"
              {...register('email')}
              error={Boolean(errors.email)}
              helperText={errors.email?.message ?? ' '}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              size="medium"
              {...register('password')}
              error={Boolean(errors.password)}
              helperText={errors.password?.message ?? ' '}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loginMutation.isPending}
              startIcon={loginMutation.isPending ? <CircularProgress size={18} /> : undefined}
            >
              {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
