import ClearIcon from '@mui/icons-material/FilterAltOff';
import SearchIcon from '@mui/icons-material/Search';
import { Button, Grid, InputAdornment, MenuItem, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  INVOICE_STATUSES,
  type InvoiceStatus,
  type ListInvoicesParams,
  type Ordering,
  type SortableField,
} from '../../../api/types';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { DateFilterField } from './DateFilterField';

const SORT_OPTIONS: {
  value: string;
  label: string;
  sortBy?: SortableField;
  ordering?: Ordering;
}[] = [
  { value: 'default', label: 'Newest created' },
  {
    value: 'invoiceDate:DESC',
    label: 'Invoice date (newest)',
    sortBy: 'invoiceDate',
    ordering: 'DESC',
  },
  {
    value: 'invoiceDate:ASC',
    label: 'Invoice date (oldest)',
    sortBy: 'invoiceDate',
    ordering: 'ASC',
  },
  { value: 'dueDate:ASC', label: 'Due date (soonest)', sortBy: 'dueDate', ordering: 'ASC' },
  { value: 'dueDate:DESC', label: 'Due date (latest)', sortBy: 'dueDate', ordering: 'DESC' },
  {
    value: 'totalAmount:DESC',
    label: 'Amount (high → low)',
    sortBy: 'totalAmount',
    ordering: 'DESC',
  },
  {
    value: 'totalAmount:ASC',
    label: 'Amount (low → high)',
    sortBy: 'totalAmount',
    ordering: 'ASC',
  },
];

interface Props {
  params: ListInvoicesParams;
  onChange: (changes: Partial<ListInvoicesParams>) => void;
  onReset: () => void;
}

/** Search (debounced), status filter, invoice-date range and sort. */
export function InvoiceFilters({ params, onChange, onReset }: Props) {
  const [keyword, setKeyword] = useState(params.keyword ?? '');
  const debouncedKeyword = useDebouncedValue(keyword, 400);

  // Push the debounced keyword into the URL (one request per pause, not per keystroke).
  useEffect(() => {
    const next = debouncedKeyword.trim() || undefined;
    if (next !== params.keyword) onChange({ keyword: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced value
  }, [debouncedKeyword]);

  // Keep the input in sync when the URL changes externally (e.g. "Clear filters", back button).
  useEffect(() => {
    setKeyword(params.keyword ?? '');
  }, [params.keyword]);

  const sortValue = params.sortBy ? `${params.sortBy}:${params.ordering ?? 'DESC'}` : 'default';
  const hasFilters = Boolean(
    params.keyword || params.status || params.fromDate || params.toDate || params.sortBy,
  );

  return (
    <Grid container spacing={1.5} alignItems="center">
      <Grid size={{ xs: 12, md: 12, lg: 3 }}>
        <TextField
          placeholder="Search invoice # or customer"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          slotProps={{
            htmlInput: { 'aria-label': 'Search invoices' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3, lg: 2 }}>
        <TextField
          select
          label="Status"
          value={params.status ?? ''}
          onChange={(e) =>
            onChange({ status: (e.target.value || undefined) as InvoiceStatus | undefined })
          }
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {INVOICE_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 6, md: 3, lg: 2 }}>
        <TextField
          select
          label="Sort by"
          value={sortValue}
          onChange={(e) => {
            const option = SORT_OPTIONS.find((o) => o.value === e.target.value);
            onChange({ sortBy: option?.sortBy, ordering: option?.ordering });
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 6, md: 2.5, lg: 2 }}>
        <DateFilterField
          label="From"
          value={params.fromDate}
          max={params.toDate}
          onCommit={(fromDate) => onChange({ fromDate })}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 2.5, lg: 2 }}>
        <DateFilterField
          label="To"
          value={params.toDate}
          min={params.fromDate}
          onCommit={(toDate) => onChange({ toDate })}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 1, lg: 1 }}>
        <Button
          fullWidth
          onClick={onReset}
          disabled={!hasFilters}
          startIcon={<ClearIcon />}
          aria-label="Clear filters"
        >
          Clear
        </Button>
      </Grid>
    </Grid>
  );
}
