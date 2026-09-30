import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { INVOICE_STATUSES, type InvoiceStatus } from '../domain/invoice-status';

export class CustomerResponseDto {
  @ApiProperty({ example: 'Paul' })
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io' })
  email: string;

  @ApiPropertyOptional({ example: '947717364111', nullable: true, type: String })
  mobileNumber: string | null;

  @ApiPropertyOptional({ example: 'Singapore', nullable: true, type: String })
  address: string | null;
}

export class InvoiceItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Honda RC150' })
  name: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 1000 })
  rate: number;

  @ApiProperty({ example: 2000, description: 'quantity × rate' })
  amount: number;
}

/** Invoice as shown in the list (no line items). */
export class InvoiceSummaryDto {
  @ApiProperty({ format: 'uuid' })
  invoiceId: string;

  @ApiProperty({ example: 'IV1780488206995' })
  invoiceNumber: string;

  @ApiPropertyOptional({ example: '#5721662', nullable: true, type: String })
  invoiceReference: string | null;

  @ApiProperty({ example: '2026-06-03', format: 'date' })
  invoiceDate: string;

  @ApiProperty({ example: '2026-07-03', format: 'date' })
  dueDate: string;

  @ApiProperty({ example: 'AUD' })
  currency: string;

  @ApiProperty({ example: 'AU$' })
  currencySymbol: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ enum: INVOICE_STATUSES, description: 'Overdue is derived at read time' })
  status: InvoiceStatus;

  @ApiProperty({ type: CustomerResponseDto })
  customer: CustomerResponseDto;

  @ApiProperty({ example: 10, description: 'Tax percentage applied' })
  taxRate: number;

  @ApiProperty({ example: 2000 })
  invoiceSubTotal: number;

  @ApiProperty({ example: 200 })
  totalTax: number;

  @ApiProperty({ example: 20 })
  totalDiscount: number;

  @ApiProperty({ example: 2180 })
  totalAmount: number;

  @ApiProperty({ example: 1451.34 })
  totalPaid: number;

  @ApiProperty({ example: 728.66, description: 'Outstanding balance = totalAmount − totalPaid' })
  balanceAmount: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'uuid' })
  createdBy: string;
}

/** Full invoice including line items. */
export class InvoiceDetailDto extends InvoiceSummaryDto {
  @ApiProperty({ type: [InvoiceItemResponseDto] })
  items: InvoiceItemResponseDto[];
}

export class PagingDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 100, description: 'Total matching records' })
  total: number;
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceSummaryDto] })
  data: InvoiceSummaryDto[];

  @ApiProperty({ type: PagingDto })
  paging: PagingDto;
}
