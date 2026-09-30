import type { Prisma, PrismaClient } from '@prisma/client';
import { toDbDate } from '../../common/utils/date.util';
import { currencySymbolOf, minorUnitsOf } from '../../invoices/domain/currency';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-calculator';
import { roundTo } from '../../invoices/domain/money';
import { APPENDIX_A_INVOICE, generateInvoices, type SeedInvoice } from './seed-data';

/** Figures published in Appendix A — the seed refuses to run if our maths disagrees. */
const APPENDIX_A_PUBLISHED = {
  invoiceSubTotal: '2000',
  totalTax: '200',
  totalDiscount: '20',
  totalAmount: '2180',
  totalPaid: '1451.34',
  balanceAmount: '728.66',
} as const;

/** Totals go through the SAME calculator the API uses — seed data can't drift from the rules. */
function seedTotals(seed: SeedInvoice) {
  const gross = calculateInvoiceTotals({
    items: [seed.item],
    taxRate: seed.taxRate,
    discount: seed.discount,
    scale: minorUnitsOf(seed.currency),
  });
  return calculateInvoiceTotals({
    items: [seed.item],
    taxRate: seed.taxRate,
    discount: seed.discount,
    totalPaid: roundTo(gross.totalAmount.times(seed.paidRatio), minorUnitsOf(seed.currency)),
    scale: minorUnitsOf(seed.currency),
  });
}

export function toInvoiceCreateInput(
  seed: SeedInvoice,
  userId: string,
): Prisma.InvoiceUncheckedCreateInput {
  const totals = seedTotals(seed);

  return {
    id: seed.id,
    invoiceNumber: seed.invoiceNumber,
    invoiceReference: seed.invoiceReference,
    invoiceDate: toDbDate(seed.invoiceDate),
    dueDate: toDbDate(seed.dueDate),
    currency: seed.currency,
    currencySymbol: currencySymbolOf(seed.currency),
    description: seed.description,
    status: seed.status,
    customerFullname: seed.customer.fullname,
    customerEmail: seed.customer.email,
    customerMobile: seed.customer.mobileNumber,
    customerAddress: seed.customer.address,
    taxRate: seed.taxRate.toString(),
    invoiceSubTotal: totals.subTotal.toString(),
    totalTax: totals.taxAmount.toString(),
    totalDiscount: totals.discount.toString(),
    totalAmount: totals.totalAmount.toString(),
    totalPaid: totals.totalPaid.toString(),
    balanceAmount: totals.balanceAmount.toString(),
    createdAt: seed.createdAt ? new Date(seed.createdAt) : undefined,
    createdBy: userId,
    items: {
      create: [
        {
          id: seed.itemId,
          name: seed.item.name,
          quantity: seed.item.quantity,
          rate: seed.item.rate.toString(),
          amount: totals.lineAmounts[0].toString(),
        },
      ],
    },
  };
}

/**
 * Self-check: if a change to the calculator ever breaks the published reference figures,
 * seeding fails loudly instead of quietly writing different numbers.
 */
export function assertAppendixAFigures(): void {
  const totals = seedTotals(APPENDIX_A_INVOICE);
  const actual: Record<keyof typeof APPENDIX_A_PUBLISHED, string> = {
    invoiceSubTotal: totals.subTotal.toString(),
    totalTax: totals.taxAmount.toString(),
    totalDiscount: totals.discount.toString(),
    totalAmount: totals.totalAmount.toString(),
    totalPaid: totals.totalPaid.toString(),
    balanceAmount: totals.balanceAmount.toString(),
  };
  const mismatches = (Object.keys(APPENDIX_A_PUBLISHED) as (keyof typeof APPENDIX_A_PUBLISHED)[])
    .filter((field) => actual[field] !== APPENDIX_A_PUBLISHED[field])
    .map((field) => `${field} expected ${APPENDIX_A_PUBLISHED[field]}, got ${actual[field]}`);
  if (mismatches.length > 0) {
    throw new Error(`Appendix A figures do not match the calculator: ${mismatches.join('; ')}`);
  }
}

/** Inserts the Appendix A invoice plus generated invoices dated relative to `today`. */
export async function insertSeedInvoices(
  prisma: PrismaClient,
  userId: string,
  today: string,
): Promise<number> {
  assertAppendixAFigures();
  const invoices = [APPENDIX_A_INVOICE, ...generateInvoices(today)];
  await prisma.$transaction(
    invoices.map((invoice) =>
      prisma.invoice.create({ data: toInvoiceCreateInput(invoice, userId) }),
    ),
  );
  return invoices.length;
}
