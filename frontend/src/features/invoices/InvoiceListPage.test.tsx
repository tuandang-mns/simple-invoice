import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoicesApi } from '../../api/invoices.api';
import { page, summary } from '../../test/fixtures';
import { renderWithProviders, signIn } from '../../test/render';
import { InvoiceListPage } from './InvoiceListPage';

vi.mock('../../api/invoices.api', () => ({
  invoicesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
}));
const list = vi.mocked(invoicesApi.list);

describe('InvoiceListPage', () => {
  beforeEach(() => {
    signIn();
    list.mockReset();
    list.mockResolvedValue(
      page(
        [
          summary({ invoiceId: 'a', invoiceNumber: 'INV-001', status: 'Overdue' }),
          summary({
            invoiceId: 'b',
            invoiceNumber: 'INV-002',
            status: 'Paid',
            customer: { ...summary({}).customer, fullname: 'Olivia Tan' },
            totalAmount: 99.5,
            currencySymbol: 'S$',
          }),
        ],
        42,
      ),
    );
  });

  it('renders the key invoice fields with the server total', async () => {
    renderWithProviders(<InvoiceListPage />, { route: '/invoices', path: '/invoices' });

    const table = await screen.findByRole('table', { name: 'Invoices' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    expect(within(rows[1]).getByText('INV-001')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Paul')).toBeInTheDocument();
    expect(within(rows[1]).getByText('03 Jun 2026')).toBeInTheDocument();
    expect(within(rows[1]).getByText('03 Jul 2026')).toBeInTheDocument();
    expect(within(rows[1]).getByText('AU$2,180.00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Overdue')).toBeInTheDocument();
    expect(within(rows[2]).getByText('S$99.50')).toBeInTheDocument();
    expect(screen.getByText('42 invoices')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('reads filters from the URL and sends them to the API', async () => {
    renderWithProviders(<InvoiceListPage />, {
      route: '/invoices?status=Paid&sortBy=totalAmount&ordering=ASC&page=2&keyword=tan&pageSize=20',
      path: '/invoices',
    });
    await screen.findByRole('table', { name: 'Invoices' });
    expect(list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      status: 'Paid',
      sortBy: 'totalAmount',
      ordering: 'ASC',
      keyword: 'tan',
    });
  });

  it('searches after the user stops typing (debounced) and resets to page 1', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoiceListPage />, { route: '/invoices?page=3', path: '/invoices' });
    await screen.findByRole('table', { name: 'Invoices' });

    await user.type(screen.getByRole('textbox', { name: 'Search invoices' }), 'olivia');

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'olivia', page: 1 }),
      ),
    );
    // One request for the initial load + one for the debounced keyword — not one per keystroke.
    expect(list.mock.calls.filter(([p]) => p.keyword)).toHaveLength(1);
  });

  it('toggles sorting from the column header', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoiceListPage />, { route: '/invoices', path: '/invoices' });
    await screen.findByRole('table', { name: 'Invoices' });

    await user.click(screen.getByRole('button', { name: 'Total' }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'totalAmount', ordering: 'DESC' }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Total' }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'totalAmount', ordering: 'ASC' }),
      ),
    );
  });

  it('opens the invoice detail when a row is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoiceListPage />, { route: '/invoices', path: '/invoices' });
    await user.click(await screen.findByText('INV-002'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/invoices/b'));
  });

  it('shows an empty state when nothing matches', async () => {
    list.mockResolvedValue(page([], 0));
    renderWithProviders(<InvoiceListPage />, { route: '/invoices?keyword=zzz', path: '/invoices' });
    expect(await screen.findByText('No invoices found')).toBeInTheDocument();
  });

  it('offers a way back when the URL points past the last page', async () => {
    list.mockResolvedValueOnce({ data: [], paging: { page: 9, pageSize: 10, total: 42 } });
    const user = userEvent.setup();
    renderWithProviders(<InvoiceListPage />, { route: '/invoices?page=9', path: '/invoices' });

    expect(await screen.findByText('This page is past the end of the results')).toBeInTheDocument();
    expect(screen.queryByText('No invoices found')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to first page' }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })),
    );
  });

  it('truncates very long values so the amount and status columns stay visible', async () => {
    const longName = 'X'.repeat(200);
    list.mockResolvedValue(
      page([
        summary({ invoiceId: 'z', customer: { ...summary({}).customer, fullname: longName } }),
      ]),
    );
    renderWithProviders(<InvoiceListPage />, { route: '/invoices', path: '/invoices' });

    const cell = await screen.findByTitle(longName); // full text available on hover
    expect(cell).toHaveStyle({ textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  });
});
