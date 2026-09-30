import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { getErrorMessages, getErrorStatus } from '../../api/client';
import { minorUnitsOf, type InvoiceDetail } from '../../api/types';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { StatusChip } from './components/StatusChip';
import { useInvoice } from './hooks';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      {children ? (
        <Typography component="div" sx={{ wordBreak: 'break-word' }}>
          {children}
        </Typography>
      ) : (
        <Typography component="div" color="text.secondary">
          Not provided
        </Typography>
      )}
    </Box>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" py={0.5}>
      <Typography fontWeight={strong ? 700 : 400}>{label}</Typography>
      <Typography fontWeight={strong ? 700 : 400} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function InvoiceDetailView({ invoice }: { invoice: InvoiceDetail }) {
  const money = (n: number) =>
    formatMoney(n, invoice.currencySymbol, minorUnitsOf(invoice.currency));

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Invoice
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h1" sx={{ wordBreak: 'break-all' }}>
              {invoice.invoiceNumber}
            </Typography>
            <StatusChip status={invoice.status} size="medium" />
          </Stack>
        </Box>
        <Box textAlign={{ sm: 'right' }}>
          <Typography variant="caption" color="text.secondary">
            Outstanding balance
          </Typography>
          <Typography variant="h1" color={invoice.balanceAmount > 0 ? 'primary' : 'success.main'}>
            {money(invoice.balanceAmount)}
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="h2" gutterBottom>
              Invoice information
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Field label="Invoice date">{formatDate(invoice.invoiceDate)}</Field>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Field label="Due date">{formatDate(invoice.dueDate)}</Field>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Field label="Reference">{invoice.invoiceReference}</Field>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Field label="Currency">
                  {invoice.currency} ({invoice.currencySymbol})
                </Field>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Field label="Description">{invoice.description}</Field>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Field label="Created">{formatDateTime(invoice.createdAt)}</Field>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="h2" gutterBottom>
              Customer
            </Typography>
            <Stack spacing={2}>
              <Field label="Name">{invoice.customer.fullname}</Field>
              <Field label="Email">{invoice.customer.email}</Field>
              <Field label="Mobile">{invoice.customer.mobileNumber}</Field>
              <Field label="Address">{invoice.customer.address}</Field>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ overflow: 'hidden' }}>
        <Typography variant="h2" sx={{ p: 2.5, pb: 1 }}>
          Line items
        </Typography>
        <TableContainer>
          <Table aria-label="Line items">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell sx={{ wordBreak: 'break-word' }}>{item.name}</TableCell>
                  <TableCell align="right">{item.quantity}</TableCell>
                  <TableCell align="right">{money(item.rate)}</TableCell>
                  <TableCell align="right">{money(item.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ p: 2.5, ml: 'auto', maxWidth: 380 }} aria-label="Invoice totals">
          <SummaryRow label="Subtotal" value={money(invoice.invoiceSubTotal)} />
          <SummaryRow label={`Tax (${invoice.taxRate}%)`} value={money(invoice.totalTax)} />
          <SummaryRow label="Discount" value={`−${money(invoice.totalDiscount)}`} />
          <Divider sx={{ my: 1 }} />
          <SummaryRow label="Total" value={money(invoice.totalAmount)} strong />
          <SummaryRow label="Paid" value={money(invoice.totalPaid)} />
          <SummaryRow label="Balance due" value={money(invoice.balanceAmount)} strong />
        </Box>
      </Paper>
    </Stack>
  );
}

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const { data, isPending, isError, error } = useInvoice(id);

  return (
    <Stack spacing={2}>
      <Box>
        <Button component={RouterLink} to="/invoices" startIcon={<ArrowBackIcon />}>
          Back to invoices
        </Button>
      </Box>
      {isPending && (
        <Stack spacing={2} aria-busy="true" aria-label="Loading invoice">
          <Skeleton height={60} width="40%" />
          <Skeleton variant="rounded" height={200} />
          <Skeleton variant="rounded" height={220} />
        </Stack>
      )}
      {isError && (
        <Alert
          severity={
            getErrorStatus(error) === 404 || getErrorStatus(error) === 400 ? 'warning' : 'error'
          }
        >
          {getErrorStatus(error) === 400 ? 'Invoice not found' : getErrorMessages(error).join(' ')}
        </Alert>
      )}
      {data && <InvoiceDetailView invoice={data} />}
    </Stack>
  );
}
