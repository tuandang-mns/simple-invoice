import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 10, textAlign: 'center' }}>
      <Typography variant="h1">Page not found</Typography>
      <Typography color="text.secondary">The page you are looking for doesn’t exist.</Typography>
      <Button component={RouterLink} to="/invoices" variant="contained">
        Back to invoices
      </Button>
    </Stack>
  );
}
