import { z } from 'zod';
import { CURRENCIES, minorUnitsOf, type CreateInvoicePayload } from '../../api/types';

/**
 * Client-side mirror of the backend CreateInvoiceDto rules (spec §2.1.4) for instant feedback.
 * The backend stays the authority — it re-validates everything and calculates totals.
 *
 * Form inputs are strings; the schema converts them to numbers on output.
 */
/**
 * Decimal places are checked on the TEXT the user typed, never with float maths:
 * `19.99 * 100 === 1998.9999999999998`, so a float-based check wrongly rejects ~9% of valid prices.
 */
export const hasAtMostTwoDecimals = (text: string) => !/\.\d{3,}$/.test(text.trim());

const requiredNumber = (label: string, { money = false } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => !money || hasAtMostTwoDecimals(v), 'Max 2 decimal places')
    .transform(Number);

/** '' → undefined (field omitted); otherwise must parse as a number with at most 2 decimals. */
const optionalNumber = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine(hasAtMostTwoDecimals, 'Max 2 decimal places')
    .transform((v) => (v === '' ? undefined : Number(v)));

/** Mirrors the API limits (they keep every total exact as a JSON number). */
export const MAX_QUANTITY = 100_000;
export const MAX_RATE = 100_000_000;

/** Real YYYY-MM-DD date in the same 1900-2999 window the API accepts. */
const businessDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .date('Enter a valid date')
    .refine((v) => {
      const year = Number(v.slice(0, 4));
      return year >= 1900 && year <= 2999;
    }, 'Year must be between 1900 and 2999');

export const invoiceFormSchema = z
  .object({
    invoiceNumber: z
      .string()
      .trim()
      .min(1, 'Invoice number is required')
      .max(50, 'Max 50 characters'),
    invoiceReference: z.string().trim().max(100, 'Max 100 characters'),
    invoiceDate: businessDate('Invoice date'),
    dueDate: businessDate('Due date'),
    currency: z.enum(CURRENCIES, { message: 'Currency is required' }),
    description: z.string().trim().max(1000, 'Max 1000 characters'),
    customerName: z.string().trim().min(1, 'Customer name is required').max(200),
    customerEmail: z
      .string()
      .trim()
      .min(1, 'Customer email is required')
      .email('Enter a valid email address'),
    customerMobile: z.string().trim().max(30, 'Max 30 characters'),
    customerAddress: z.string().trim().max(500, 'Max 500 characters'),
    itemName: z.string().trim().min(1, 'Item name is required').max(200),
    quantity: requiredNumber('Quantity').pipe(
      z
        .number()
        .int('Quantity must be a whole number')
        .positive('Quantity must be greater than 0')
        .max(MAX_QUANTITY, `Quantity cannot exceed ${MAX_QUANTITY.toLocaleString('en-US')}`),
    ),
    rate: requiredNumber('Rate', { money: true }).pipe(
      z
        .number()
        .positive('Rate must be greater than 0')
        .max(MAX_RATE, `Rate cannot exceed ${MAX_RATE.toLocaleString('en-US')}`),
    ),
    // Blank tax/discount are omitted from the payload so the SERVER applies its defaults
    // (10% tax, 0 discount) — the client never duplicates business defaults.
    taxRate: optionalNumber('Tax').pipe(
      z.number().min(0, 'Tax cannot be negative').max(100, 'Tax cannot exceed 100%').optional(),
    ),
    discount: optionalNumber('Discount').pipe(
      z.number().min(0, 'Discount cannot be negative').optional(),
    ),
  })
  // VND has no minor units: rate and discount must be whole dong (mirrors the API).
  .superRefine((v, ctx) => {
    if (minorUnitsOf(v.currency) > 0) return;
    const whole = (n: number | undefined) => n === undefined || Number.isInteger(n);
    if (!whole(v.rate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rate'],
        message: `Whole numbers only for ${v.currency}`,
      });
    }
    if (!whole(v.discount)) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount'],
        message: `Whole numbers only for ${v.currency}`,
      });
    }
  })
  .refine((v) => !v.invoiceDate || !v.dueDate || v.dueDate >= v.invoiceDate, {
    path: ['dueDate'],
    message: 'Due date must be on or after the invoice date',
  })
  // Mirrors the server rule (no negative invoices) for instant feedback; tax defaults to 10%
  // exactly as the server applies it. The server still re-checks with exact decimal maths.
  .refine(
    (v) => {
      const subTotal = v.quantity * v.rate;
      const tax = (subTotal * (v.taxRate ?? 10)) / 100;
      return (v.discount ?? 0) <= subTotal + tax + 1e-9;
    },
    { path: ['discount'], message: 'Discount cannot exceed subtotal plus tax' },
  );

export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
export type InvoiceFormOutput = z.output<typeof invoiceFormSchema>;

const optional = (v: string) => (v === '' ? undefined : v);

/** Form values → API payload (the API expects the nested customer/items shape). */
export function toCreateInvoicePayload(v: InvoiceFormOutput): CreateInvoicePayload {
  return {
    invoiceNumber: v.invoiceNumber,
    invoiceReference: optional(v.invoiceReference),
    invoiceDate: v.invoiceDate,
    dueDate: v.dueDate,
    currency: v.currency,
    description: optional(v.description),
    customer: {
      fullname: v.customerName,
      email: v.customerEmail,
      mobileNumber: optional(v.customerMobile),
      address: optional(v.customerAddress),
    },
    items: [{ name: v.itemName, quantity: v.quantity, rate: v.rate }],
    taxRate: v.taxRate,
    discount: v.discount,
  };
}
