import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toDbDate, todayIn } from '../common/utils/date.util';
import type { EnvironmentVariables } from '../config/env.validation';
import { isUniqueViolation } from '../database/prisma-errors';
import { PrismaService } from '../database/prisma.service';
import { currencySymbolOf, minorUnitsOf } from './domain/currency';
import { calculateInvoiceTotals, InvoiceCalculationError } from './domain/invoice-calculator';
import { isDueDateValid } from './domain/invoice-status';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { InvoiceDetailDto, InvoiceListResponseDto } from './dto/invoice-response.dto';
import type { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { buildInvoiceOrderBy, buildInvoiceWhere } from './invoice-query.builder';
import { toInvoiceDetail, toInvoiceSummary } from './invoice.mapper';

export const DEFAULT_TAX_RATE = 10;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** "Today" in the business timezone — the reference point for Overdue. */
  today(): string {
    return todayIn(this.config.get('APP_TIMEZONE', { infer: true }));
  }

  async list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const today = this.today();
    const where = buildInvoiceWhere(query, today);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy: buildInvoiceOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => toInvoiceSummary(row, today)),
      paging: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findOne(id: string): Promise<InvoiceDetailDto> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return toInvoiceDetail(invoice, this.today());
  }

  async create(dto: CreateInvoiceDto, userId: string): Promise<InvoiceDetailDto> {
    // Defence in depth: the DTO validator already checks this, but the service
    // must hold the rule even if called from elsewhere (e.g. a future importer).
    if (!isDueDateValid(dto.invoiceDate, dto.dueDate)) {
      throw new BadRequestException(['dueDate must be on or after invoiceDate']);
    }

    const taxRate = dto.taxRate ?? DEFAULT_TAX_RATE;
    let totals: ReturnType<typeof calculateInvoiceTotals>;
    try {
      totals = calculateInvoiceTotals({
        items: dto.items,
        taxRate,
        discount: dto.discount ?? 0,
        scale: minorUnitsOf(dto.currency),
      });
    } catch (error) {
      if (error instanceof InvoiceCalculationError) {
        throw new BadRequestException([error.message]);
      }
      throw error;
    }

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber: dto.invoiceNumber,
          invoiceReference: dto.invoiceReference,
          invoiceDate: toDbDate(dto.invoiceDate),
          dueDate: toDbDate(dto.dueDate),
          currency: dto.currency,
          currencySymbol: currencySymbolOf(dto.currency),
          description: dto.description,
          status: 'Draft', // spec: new invoices are always Draft
          customerFullname: dto.customer.fullname,
          customerEmail: dto.customer.email,
          customerMobile: dto.customer.mobileNumber,
          customerAddress: dto.customer.address,
          taxRate: taxRate.toString(),
          invoiceSubTotal: totals.subTotal.toString(),
          totalTax: totals.taxAmount.toString(),
          totalDiscount: totals.discount.toString(),
          totalAmount: totals.totalAmount.toString(),
          totalPaid: totals.totalPaid.toString(),
          balanceAmount: totals.balanceAmount.toString(),
          createdBy: userId,
          items: {
            create: dto.items.map((item, i) => ({
              name: item.name,
              quantity: item.quantity,
              rate: item.rate.toString(),
              amount: totals.lineAmounts[i].toString(),
            })),
          },
        },
        include: { items: true },
      });
      return toInvoiceDetail(invoice, this.today());
    } catch (error) {
      // Uniqueness is enforced by the DB index (race-safe), not by a check-then-insert.
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Invoice number "${dto.invoiceNumber}" already exists`);
      }
      throw error;
    }
  }
}
