import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  TablePagination,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { getErrorMessages } from '../../api/client';
import type { SortableField } from '../../api/types';
import { InvoiceCardList } from './components/InvoiceCardList';
import { InvoiceFilters } from './components/InvoiceFilters';
import { InvoiceTable } from './components/InvoiceTable';
import { useInvoices } from './hooks';
import { PAGE_SIZE_OPTIONS, useInvoiceListParams } from './useInvoiceListParams';

/** Home screen: server-side paginated, searchable, filterable, sortable invoice list. */
export function InvoiceListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { params, update, reset } = useInvoiceListParams();
  const { data, isPending, isFetching, isError, error, refetch } = useInvoices(params);

  const openInvoice = (id: string) => navigate(`/invoices/${id}`);

  // Clicking the active column flips direction; a new column starts descending.
  const toggleSort = (field: SortableField) =>
    update({
      sortBy: field,
      ordering: params.sortBy === field && params.ordering !== 'ASC' ? 'ASC' : 'DESC',
    });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h1">Invoices</Typography>
          {data && (
            <Typography variant="body2" color="text.secondary">
              {data.paging.total} {data.paging.total === 1 ? 'invoice' : 'invoices'}
            </Typography>
          )}
        </Box>
        <Button
          component={RouterLink}
          to="/invoices/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          {isMobile ? 'New' : 'New invoice'}
        </Button>
      </Stack>

      <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
        <InvoiceFilters params={params} onChange={update} onReset={reset} />
      </Paper>

      <Paper sx={{ overflow: 'hidden' }}>
        {isFetching && !isPending && <LinearProgress aria-label="Refreshing" />}

        {isPending && (
          <Stack spacing={1} p={2} aria-busy="true" aria-label="Loading invoices">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </Stack>
        )}

        {isError && (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => void refetch()}>
                Retry
              </Button>
            }
          >
            {getErrorMessages(error).join(' ')}
          </Alert>
        )}

        {data && data.data.length === 0 && data.paging.total === 0 && (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 2, textAlign: 'center' }}>
            <Typography fontWeight={600}>No invoices found</Typography>
            <Typography variant="body2" color="text.secondary">
              Try a different search or clear the filters.
            </Typography>
          </Stack>
        )}

        {/* e.g. a bookmarked ?page=9 after invoices were filtered away: results exist, just not here. */}
        {data && data.data.length === 0 && data.paging.total > 0 && (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 2, textAlign: 'center' }}>
            <Typography fontWeight={600}>This page is past the end of the results</Typography>
            <Button variant="outlined" onClick={() => update({ page: 1 })}>
              Go to first page
            </Button>
          </Stack>
        )}

        {data &&
          data.data.length > 0 &&
          (isMobile ? (
            <InvoiceCardList invoices={data.data} onOpen={openInvoice} />
          ) : (
            <InvoiceTable
              invoices={data.data}
              params={params}
              onSort={toggleSort}
              onOpen={openInvoice}
            />
          ))}

        {data && data.data.length > 0 && (
          <TablePagination
            component="div"
            count={data.paging.total}
            page={params.page - 1}
            rowsPerPage={params.pageSize}
            rowsPerPageOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(_, page) => update({ page: page + 1 })}
            onRowsPerPageChange={(e) => update({ pageSize: Number(e.target.value) })}
            labelRowsPerPage={isMobile ? 'Rows' : 'Rows per page'}
          />
        )}
      </Paper>
    </Stack>
  );
}
