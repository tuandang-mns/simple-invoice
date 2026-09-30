import type { Invoice, InvoiceItem } from '@prisma/client';
import { toIsoDate } from '../common/utils/date.util';
import { deriveInvoiceStatus } from './domain/invoice-status';
import { toAmount } from './domain/money';
import type {
  InvoiceDetailDto,
  InvoiceItemResponseDto,
  InvoiceSummaryDto,
} from './dto/invoice-response.dto';

/** Maps a DB row to the API contract, deriving Overdue relative to `today`. */
export function toInvoiceSummary(invoice: Invoice, today: string): InvoiceSummaryDto {
  const dueDate = toIsoDate(invoice.dueDate);
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceReference: invoice.invoiceReference,
    invoiceDate: toIsoDate(invoice.invoiceDate),
    dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    description: invoice.description,
    status: deriveInvoiceStatus(invoice.status, dueDate, today),
    customer: {
      fullname: invoice.customerFullname,
      email: invoice.customerEmail,
      mobileNumber: invoice.customerMobile,
      address: invoice.customerAddress,
    },
    taxRate: toAmount(invoice.taxRate),
    invoiceSubTotal: toAmount(invoice.invoiceSubTotal),
    totalTax: toAmount(invoice.totalTax),
    totalDiscount: toAmount(invoice.totalDiscount),
    totalAmount: toAmount(invoice.totalAmount),
    totalPaid: toAmount(invoice.totalPaid),
    balanceAmount: toAmount(invoice.balanceAmount),
    createdAt: invoice.createdAt.toISOString(),
    createdBy: invoice.createdBy,
  };
}

export function toInvoiceDetail(
  invoice: Invoice & { items: InvoiceItem[] },
  today: string,
): InvoiceDetailDto {
  return {
    ...toInvoiceSummary(invoice, today),
    items: invoice.items.map((item): InvoiceItemResponseDto => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      rate: toAmount(item.rate),
      amount: toAmount(item.amount),
    })),
  };
}
