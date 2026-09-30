import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import type { ReactNode } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { getErrorMessages, getErrorStatus } from '../../api/client';
import { CURRENCIES, minorUnitsOf } from '../../api/types';
import { addDaysIso, formatMoney, todayIsoDate } from '../../lib/format';
import { useCreateInvoice } from './hooks';
import {
  invoiceFormSchema,
  toCreateInvoicePayload,
  type InvoiceFormInput,
  type InvoiceFormOutput,
} from './invoice-form.schema';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Typography variant="h2" gutterBottom>
        {title}
      </Typography>
      <Grid container spacing={2}>
        {children}
      </Grid>
    </Paper>
  );
}

/**
 * Indicative total for the user while typing. Display only — the persisted totals are
 * always calculated by the backend (spec §2.1.4) and shown on the detail screen.
 */
function EstimatedTotal({
  control,
}: {
  control: Control<InvoiceFormInput, unknown, InvoiceFormOutput>;
}) {
  const [quantity, rate, taxRate, discount, currency] = useWatch({
    control,
    name: ['quantity', 'rate', 'taxRate', 'discount', 'currency'],
  });
  const sub = Number(quantity) * Number(rate);
  const tax = taxRate === '' ? 10 : Number(taxRate);
  const total = sub + (sub * tax) / 100 - Number(discount || 0);
  if (!Number.isFinite(total) || sub <= 0) return null;
  return (
    <Typography variant="body2" color="text.secondary">
      Estimated total: <strong>{formatMoney(total, '', minorUnitsOf(currency))}</strong> · final
      amount is calculated by the server
    </Typography>
  );
}

export function CreateInvoicePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const createInvoice = useCreateInvoice();
  const today = todayIsoDate();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InvoiceFormInput, unknown, InvoiceFormOutput>({
    resolver: zodResolver(invoiceFormSchema),
    mode: 'onTouched',
    defaultValues: {
      invoiceNumber: '',
      invoiceReference: '',
      invoiceDate: today,
      dueDate: addDaysIso(today, 30),
      currency: 'AUD',
      description: '',
      customerName: '',
      customerEmail: '',
      customerMobile: '',
      customerAddress: '',
      itemName: '',
      quantity: '1',
      rate: '',
      taxRate: '10',
      discount: '0',
    },
  });

  // VND has no minor units: whole-number steps for money inputs.
  const moneyStep = minorUnitsOf(useWatch({ control, name: 'currency' })) === 0 ? 1 : '0.01';

  const onSubmit = (values: InvoiceFormOutput) =>
    createInvoice.mutate(toCreateInvoicePayload(values), {
      onSuccess: (invoice) => {
        // Show the status the server returned: a back-dated invoice is stored as Draft
        // but already reads as Overdue — never assume "Draft" on the client.
        const note = invoice.status === 'Draft' ? '' : `. Status: ${invoice.status}`;
        enqueueSnackbar(`Invoice ${invoice.invoiceNumber} created${note}`, { variant: 'success' });
        navigate('/invoices');
      },
      onError: (error) => {
        if (getErrorStatus(error) === 409) {
          setError(
            'invoiceNumber',
            { message: 'This invoice number is already in use' },
            { shouldFocus: true },
          );
        }
      },
    });

  // helperText is always rendered (' ' when valid) so an error appearing on blur never
  // shifts the layout — otherwise the Create button can move mid-click and the click is lost.
  const field = (name: keyof InvoiceFormInput) => ({
    ...register(name),
    error: Boolean(errors[name]),
    helperText: errors[name]?.message ?? ' ',
  });

  const serverErrors =
    createInvoice.isError && getErrorStatus(createInvoice.error) !== 409
      ? getErrorMessages(createInvoice.error)
      : [];

  return (
    <Stack
      spacing={2}
      component="form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      aria-label="Create invoice"
    >
      <Box>
        <Button component={RouterLink} to="/invoices" startIcon={<ArrowBackIcon />}>
          Back to invoices
        </Button>
      </Box>
      <Box>
        <Typography variant="h1">New invoice</Typography>
        <Typography variant="body2" color="text.secondary">
          New invoices are saved as <strong>Draft</strong>. Fields marked * are required.
        </Typography>
      </Box>

      {serverErrors.length > 0 && (
        <Alert severity="error" role="alert">
          {serverErrors.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </Alert>
      )}

      <Section title="Invoice details">
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Invoice number *" {...field('invoiceNumber')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Reference" {...field('invoiceReference')} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            type="date"
            label="Invoice date *"
            {...field('invoiceDate')}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: '1900-01-01', max: '2999-12-31' },
            }}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            type="date"
            label="Due date *"
            {...field('dueDate')}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: '1900-01-01', max: '2999-12-31' },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Controller
            name="currency"
            control={control}
            render={({ field: f, fieldState }) => (
              <TextField
                select
                label="Currency *"
                {...f}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? ' '}
              >
                {CURRENCIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField label="Description" multiline minRows={2} {...field('description')} />
        </Grid>
      </Section>

      <Section title="Customer">
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Customer name *" autoComplete="off" {...field('customerName')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Customer email *"
            type="email"
            autoComplete="off"
            {...field('customerEmail')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Mobile" type="tel" {...field('customerMobile')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Address" {...field('customerAddress')} />
        </Grid>
      </Section>

      <Section title="Line item">
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Item name *" {...field('itemName')} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label="Quantity *"
            type="number"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            {...field('quantity')}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label="Rate *"
            type="number"
            slotProps={{ htmlInput: { min: 0, step: moneyStep } }}
            {...field('rate')}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label="Tax"
            type="number"
            {...field('taxRate')}
            helperText={errors.taxRate?.message ?? 'Blank = 10% default'}
            slotProps={{
              htmlInput: { min: 0, max: 100, step: '0.01' },
              input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
            }}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            label="Discount"
            type="number"
            slotProps={{ htmlInput: { min: 0, step: moneyStep } }}
            {...field('discount')}
            helperText={errors.discount?.message ?? 'Amount, not a percentage'}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <EstimatedTotal control={control} />
        </Grid>
      </Section>

      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        spacing={1.5}
        justifyContent="flex-end"
      >
        <Button component={RouterLink} to="/invoices" disabled={createInvoice.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={createInvoice.isPending}
          startIcon={createInvoice.isPending ? <CircularProgress size={18} /> : undefined}
        >
          {createInvoice.isPending ? 'Creating…' : 'Create invoice'}
        </Button>
      </Stack>
    </Stack>
  );
}
