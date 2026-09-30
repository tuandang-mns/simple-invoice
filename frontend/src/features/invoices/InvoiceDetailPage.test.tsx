import { screen } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoicesApi } from '../../api/invoices.api';
import { appendixInvoice } from '../../test/fixtures';
import { renderWithProviders, signIn } from '../../test/render';
import { InvoiceDetailPage } from './InvoiceDetailPage';

vi.mock('../../api/invoices.api', () => ({
  invoicesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
}));
const get = vi.mocked(invoicesApi.get);

describe('InvoiceDetailPage', () => {
  beforeEach(() => {
    signIn();
    get.mockReset();
  });

  it('shows invoice, customer, line items and all totals as returned by the API', async () => {
    get.mockResolvedValue(appendixInvoice);
    renderWithProviders(<InvoiceDetailPage />, {
      route: `/invoices/${appendixInvoice.invoiceId}`,
      path: '/invoices/:id',
    });

    expect(await screen.findByRole('heading', { name: 'IV1780488206995' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(appendixInvoice.invoiceId);
    expect(screen.getAllByText('Overdue')[0]).toBeInTheDocument();
    expect(screen.getByText('paul@101digital.io')).toBeInTheDocument();
    expect(screen.getByText('Honda RC150')).toBeInTheDocument();

    const totals = screen.getByLabelText('Invoice totals');
    expect(totals).toHaveTextContent('SubtotalAU$2,000.00');
    expect(totals).toHaveTextContent('Tax (10%)AU$200.00');
    expect(totals).toHaveTextContent('Discount−AU$20.00');
    expect(totals).toHaveTextContent('TotalAU$2,180.00');
    expect(totals).toHaveTextContent('PaidAU$1,451.34');
    expect(totals).toHaveTextContent('Balance dueAU$728.66');
  });

  it('shows VND amounts without decimals', async () => {
    get.mockResolvedValue({
      ...appendixInvoice,
      currency: 'VND',
      currencySymbol: '₫',
      invoiceSubTotal: 99999,
      totalTax: 10000,
      totalDiscount: 0,
      totalAmount: 109999,
      totalPaid: 0,
      balanceAmount: 109999,
      items: [{ id: 'i', name: 'Coffee', quantity: 3, rate: 33333, amount: 99999 }],
    });
    renderWithProviders(<InvoiceDetailPage />, { route: '/invoices/x', path: '/invoices/:id' });
    const totals = await screen.findByLabelText('Invoice totals');
    expect(totals).toHaveTextContent('Subtotal₫99,999');
    expect(totals).toHaveTextContent('Total₫109,999');
    expect(totals).not.toHaveTextContent('.00');
  });

  it('shows "Invoice not found" for a 404', async () => {
    get.mockRejectedValue(
      new AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
      }),
    );
    renderWithProviders(<InvoiceDetailPage />, {
      route: '/invoices/missing',
      path: '/invoices/:id',
    });
    expect(await screen.findByText('Invoice not found')).toBeInTheDocument();
  });
});
