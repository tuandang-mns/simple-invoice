import { Box, CardActionArea, Divider, Stack, Typography } from '@mui/material';
import { minorUnitsOf, type InvoiceSummary } from '../../../api/types';
import { formatDate, formatMoney } from '../../../lib/format';
import { StatusChip } from './StatusChip';

/** Mobile view: one tappable card per invoice (tables don't fit on small screens). */
export function InvoiceCardList({
  invoices,
  onOpen,
}: {
  invoices: InvoiceSummary[];
  onOpen: (invoiceId: string) => void;
}) {
  return (
    <Stack divider={<Divider />} role="list" aria-label="Invoices">
      {invoices.map((invoice) => (
        <CardActionArea
          key={invoice.invoiceId}
          onClick={() => onOpen(invoice.invoiceId)}
          role="listitem"
          sx={{ p: 2 }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={700} noWrap>
                {invoice.invoiceNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {invoice.customer.fullname}
              </Typography>
            </Box>
            <StatusChip status={invoice.status} />
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mt={1}>
            <Typography variant="caption" color="text.secondary">
              Issued {formatDate(invoice.invoiceDate)}
              <br />
              Due {formatDate(invoice.dueDate)}
            </Typography>
            <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatMoney(
                invoice.totalAmount,
                invoice.currencySymbol,
                minorUnitsOf(invoice.currency),
              )}
            </Typography>
          </Stack>
        </CardActionArea>
      ))}
    </Stack>
  );
}
