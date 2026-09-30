import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import {
  minorUnitsOf,
  type InvoiceSummary,
  type ListInvoicesParams,
  type SortableField,
} from '../../../api/types';
import { formatDate, formatMoney } from '../../../lib/format';
import { StatusChip } from './StatusChip';

interface Props {
  invoices: InvoiceSummary[];
  params: ListInvoicesParams;
  onSort: (sortBy: SortableField) => void;
  onOpen: (invoiceId: string) => void;
}

/**
 * Long unbroken values (pasted codes, 200-char names) must not stretch the table and push the
 * amount/status columns off-screen: cap the width, ellipsize, and show the full text on hover.
 */
const truncate = (maxWidth: number) => ({
  maxWidth,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/** Desktop/tablet view. Sortable column headers: invoice date, due date, amount. */
export function InvoiceTable({ invoices, params, onSort, onOpen }: Props) {
  const sortHeader = (field: SortableField, label: string, align?: 'right') => (
    <TableCell
      align={align}
      sortDirection={params.sortBy === field ? (params.ordering === 'ASC' ? 'asc' : 'desc') : false}
    >
      <TableSortLabel
        active={params.sortBy === field}
        direction={params.sortBy === field && params.ordering === 'ASC' ? 'asc' : 'desc'}
        onClick={() => onSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <TableContainer>
      <Table size="medium" aria-label="Invoices">
        <TableHead>
          <TableRow>
            <TableCell>Invoice #</TableCell>
            <TableCell>Customer</TableCell>
            {sortHeader('invoiceDate', 'Invoice date')}
            {sortHeader('dueDate', 'Due date')}
            {sortHeader('totalAmount', 'Total', 'right')}
            <TableCell align="center">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow
              key={invoice.invoiceId}
              hover
              tabIndex={0}
              sx={{ cursor: 'pointer' }}
              onClick={() => onOpen(invoice.invoiceId)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(invoice.invoiceId)}
            >
              <TableCell sx={{ ...truncate(220), fontWeight: 600 }} title={invoice.invoiceNumber}>
                {invoice.invoiceNumber}
              </TableCell>
              <TableCell sx={truncate(280)} title={invoice.customer.fullname}>
                {invoice.customer.fullname}
              </TableCell>
              <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
              <TableCell>{formatDate(invoice.dueDate)}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(
                  invoice.totalAmount,
                  invoice.currencySymbol,
                  minorUnitsOf(invoice.currency),
                )}
              </TableCell>
              <TableCell align="center">
                <StatusChip status={invoice.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
