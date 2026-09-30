/** API contract types — mirror the backend DTOs (see backend Swagger at /api/docs). */

export const INVOICE_STATUSES = ['Draft', 'Pending', 'Paid', 'Overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const SORTABLE_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];
export type Ordering = 'ASC' | 'DESC';

export const CURRENCIES = ['AUD', 'USD', 'GBP', 'SGD', 'EUR', 'VND'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** ISO 4217 minor units (decimal places). Mirrors the API: VND has none. */
export const CURRENCY_MINOR_UNITS: Record<CurrencyCode, number> = {
  AUD: 2,
  USD: 2,
  GBP: 2,
  SGD: 2,
  EUR: 2,
  VND: 0,
};

export function minorUnitsOf(currency: string): number {
  return CURRENCY_MINOR_UNITS[currency as CurrencyCode] ?? 2;
}

export interface UserProfile {
  id: string;
  email: string;
  fullname: string;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserProfile;
}

export interface Customer {
  fullname: string;
  email: string;
  mobileNumber: string | null;
  address: string | null;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  description: string | null;
  status: InvoiceStatus;
  customer: Customer;
  taxRate: number;
  invoiceSubTotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
  totalPaid: number;
  balanceAmount: number;
  createdAt: string;
  createdBy: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  items: InvoiceItem[];
}

export interface Paged<T> {
  data: T[];
  paging: { page: number; pageSize: number; total: number };
}

export interface ListInvoicesParams {
  page: number;
  pageSize: number;
  sortBy?: SortableField;
  ordering?: Ordering;
  status?: InvoiceStatus;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreateInvoicePayload {
  invoiceNumber: string;
  invoiceReference?: string;
  invoiceDate: string;
  dueDate: string;
  currency: CurrencyCode;
  description?: string;
  customer: {
    fullname: string;
    email: string;
    mobileNumber?: string;
    address?: string;
  };
  items: { name: string; quantity: number; rate: number }[];
  taxRate?: number;
  discount?: number;
}

/** Error body returned by every failing endpoint. */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}
