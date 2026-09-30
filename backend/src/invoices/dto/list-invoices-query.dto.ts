import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsIsoDate } from '../../common/validators/is-iso-date.decorator';
import { IsOnOrAfter } from '../../common/validators/is-on-or-after.validator';
import { trimToUndefined } from '../../common/utils/transform.util';
import { INVOICE_STATUSES, type InvoiceStatus } from '../domain/invoice-status';

export const SORTABLE_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];
export const ORDERINGS = ['ASC', 'DESC'] as const;
export type Ordering = (typeof ORDERINGS)[number];

export const MAX_PAGE_SIZE = 100;

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 10;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, description: 'Defaults to newest created first' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: SortableField;

  @ApiPropertyOptional({ enum: ORDERINGS, default: 'DESC' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(ORDERINGS)
  ordering?: Ordering;

  @ApiPropertyOptional({ enum: INVOICE_STATUSES })
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Partial, case-insensitive match on invoice number or customer name',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({ format: 'date', description: 'invoiceDate on/after (YYYY-MM-DD)' })
  @IsOptional()
  @IsIsoDate()
  fromDate?: string;

  @ApiPropertyOptional({ format: 'date', description: 'invoiceDate on/before (YYYY-MM-DD)' })
  @IsOptional()
  @IsIsoDate()
  @IsOnOrAfter('fromDate', { message: 'toDate must be on or after fromDate' })
  toDate?: string;
}
