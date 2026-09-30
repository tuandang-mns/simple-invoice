import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoicesApi } from '../../api/invoices.api';
import { appendixInvoice } from '../../test/fixtures';
import { renderWithProviders, signIn } from '../../test/render';
import { CreateInvoicePage } from './CreateInvoicePage';

vi.mock('../../api/invoices.api', () => ({
  invoicesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
}));
const create = vi.mocked(invoicesApi.create);

const setValue = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/invoice number/i), 'INV-9000');
  setValue(/invoice date/i, '2026-06-03');
  setValue(/due date/i, '2026-07-03');
  await user.type(screen.getByLabelText(/customer name/i), 'Paul');
  await user.type(screen.getByLabelText(/customer email/i), 'paul@101digital.io');
  await user.type(screen.getByLabelText(/item name/i), 'Honda RC150');
  await user.clear(screen.getByLabelText(/quantity/i));
  await user.type(screen.getByLabelText(/quantity/i), '2');
  await user.type(screen.getByLabelText(/rate/i), '1000');
  await user.clear(screen.getByLabelText(/discount/i));
  await user.type(screen.getByLabelText(/discount/i), '20');
}

describe('CreateInvoicePage', () => {
  beforeEach(() => {
    signIn();
    create.mockReset();
  });

  it('shows required-field errors and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateInvoicePage />, { route: '/invoices/new', path: '/invoices/new' });

    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('Invoice number is required')).toBeInTheDocument();
    expect(screen.getByText('Customer name is required')).toBeInTheDocument();
    expect(screen.getByText('Customer email is required')).toBeInTheDocument();
    expect(screen.getByText('Item name is required')).toBeInTheDocument();
    expect(screen.getByText('Rate is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a due date before the invoice date, a bad email and a non-integer quantity', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateInvoicePage />, { route: '/invoices/new', path: '/invoices/new' });
    await fillValidForm(user);
    setValue(/due date/i, '2026-06-01');
    await user.clear(screen.getByLabelText(/customer email/i));
    await user.type(screen.getByLabelText(/customer email/i), 'paul@');
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), '1.5');

    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(
      await screen.findByText('Due date must be on or after the invoice date'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Quantity must be a whole number')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('submits the payload (no totals — the server calculates them) and returns to the list', async () => {
    create.mockResolvedValue({ ...appendixInvoice, invoiceNumber: 'INV-9000', status: 'Draft' });
    const user = userEvent.setup();
    renderWithProviders(<CreateInvoicePage />, { route: '/invoices/new', path: '/invoices/new' });
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const payload = create.mock.calls[0][0];
    expect(payload).toEqual({
      invoiceNumber: 'INV-9000',
      invoiceReference: undefined,
      invoiceDate: '2026-06-03',
      dueDate: '2026-07-03',
      currency: 'AUD',
      description: undefined,
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: undefined,
        address: undefined,
      },
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 20,
    });
    expect(payload).not.toHaveProperty('totalAmount');
    expect(await screen.findByText('Invoice INV-9000 created')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/invoices$/));
  });

  it('shows a field error when the invoice number already exists (409)', async () => {
    create.mockRejectedValue(
      new AxiosError('Conflict', '409', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          statusCode: 409,
          message: 'Invoice number "INV-9000" already exists',
          error: 'Conflict',
        },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CreateInvoicePage />, { route: '/invoices/new', path: '/invoices/new' });
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('This invoice number is already in use')).toBeInTheDocument();
  });

  it('omits blank tax and discount so the server applies its defaults', async () => {
    create.mockResolvedValue({ ...appendixInvoice, invoiceNumber: 'INV-9000', status: 'Draft' });
    const user = userEvent.setup();
    renderWithProviders(<CreateInvoicePage />, { route: '/invoices/new', path: '/invoices/new' });
    await fillValidForm(user);
    await user.clear(screen.getByLabelText(/^tax/i));
    await user.clear(screen.getByLabelText(/discount/i));

    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0].taxRate).toBeUndefined();
    expect(create.mock.calls[0][0].discount).toBeUndefined();
  });

  it('reports the status the server returned (a back-dated invoice is already Overdue)', async () => {
    create.mockResolvedValue({ ...appendixInvoice, invoiceNumber: 'INV-OLD', status: 'Overdue' });
    const user = userEvent.setup();
    renderWithProviders(<CreateInvoicePage />, { route: '/invoices/new', path: '/invoices/new' });
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('Invoice INV-OLD created. Status: Overdue')).toBeInTheDocument();
  });

  it('blocks a discount larger than subtotal + tax before calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateInvoicePage />, { route: '/invoices/new', path: '/invoices/new' });
    await fillValidForm(user); // 2 × 1000, tax 10% → max discount 2200
    await user.clear(screen.getByLabelText(/discount/i));
    await user.type(screen.getByLabelText(/discount/i), '2200.01');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText('Discount cannot exceed subtotal plus tax')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});
