import { Money, MoneyInput, roundTo } from './money';

export interface InvoiceLineInput {
  quantity: number;
  rate: MoneyInput;
}

export interface InvoiceTotalsInput {
  items: InvoiceLineInput[];
  /** Tax percentage, e.g. 10 for 10%. */
  taxRate: MoneyInput;
  /** Absolute discount amount in the invoice currency. */
  discount: MoneyInput;
  totalPaid?: MoneyInput;
  /** Currency minor units: 2 for AUD/USD/..., 0 for VND. Defaults to 2. */
  scale?: number;
}

export interface InvoiceTotals {
  lineAmounts: Money[];
  subTotal: Money;
  taxAmount: Money;
  discount: Money;
  totalAmount: Money;
  totalPaid: Money;
  balanceAmount: Money;
}

export class InvoiceCalculationError extends Error {}

/**
 * Server-side totals (spec §2.3.2):
 *
 *   subTotal      = Σ quantity × rate
 *   taxAmount     = subTotal × (tax% / 100)      rounded half-up to the currency's minor units
 *   totalAmount   = subTotal + taxAmount − discount
 *   balanceAmount = totalAmount − totalPaid
 *
 * Pure function: no I/O, no framework — the single source of truth for invoice maths.
 */
export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  if (input.items.length === 0) {
    throw new InvoiceCalculationError('An invoice needs at least one line item');
  }

  const scale = input.scale ?? 2;
  const round = (value: MoneyInput) => roundTo(value, scale);

  const lineAmounts = input.items.map((item) => round(new Money(item.rate).times(item.quantity)));
  const subTotal = round(lineAmounts.reduce((sum, amount) => sum.plus(amount), new Money(0)));
  const taxAmount = round(subTotal.times(input.taxRate).dividedBy(100));
  const discount = round(input.discount);
  const grossTotal = subTotal.plus(taxAmount);

  if (discount.greaterThan(grossTotal)) {
    throw new InvoiceCalculationError('discount must not exceed subtotal plus tax');
  }

  const totalAmount = round(grossTotal.minus(discount));
  const totalPaid = round(input.totalPaid ?? 0);
  const balanceAmount = round(totalAmount.minus(totalPaid));

  return { lineAmounts, subTotal, taxAmount, discount, totalAmount, totalPaid, balanceAmount };
}
