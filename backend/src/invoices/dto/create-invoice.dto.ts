import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsIsoDate } from '../../common/validators/is-iso-date.decorator';
import { IsOnOrAfter } from '../../common/validators/is-on-or-after.validator';
import { trim, trimToUndefined } from '../../common/utils/transform.util';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../domain/currency';
import { FitsCurrencyScale, ItemRatesFitCurrencyScale } from './currency-scale.validator';

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

/**
 * Amounts are sent to clients as JSON numbers (IEEE-754 doubles), which represent cents exactly
 * only below ~90 trillion (2^53 / 100). These caps keep the largest possible total
 * (100,000 × 100,000,000 + 100% tax = 2×10^13) safely inside that range.
 */
export const MAX_QUANTITY = 100_000;
export const MAX_RATE = 100_000_000;

export class CreateCustomerDto {
  @ApiProperty({ example: 'Paul' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io' })
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: '947717364111' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'Singapore' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Honda RC150' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_QUANTITY, description: 'Positive integer' })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity: number;

  @ApiProperty({
    example: 1000,
    maximum: MAX_RATE,
    description: 'Unit price, positive; max 2 decimals (whole numbers for VND)',
  })
  @IsNumber(MONEY, { message: '$property must be a number with at most 2 decimal places' })
  @IsPositive()
  @Max(MAX_RATE)
  rate: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    example: 'IV1780488206995',
    description: 'User-provided, unique (case-insensitive)',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  invoiceNumber: string;

  @ApiPropertyOptional({ example: '#5721662' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceReference?: string;

  @ApiProperty({ example: '2026-06-03', format: 'date' })
  @IsIsoDate()
  invoiceDate: string;

  @ApiProperty({
    example: '2026-07-03',
    format: 'date',
    description: 'Must be on or after invoiceDate',
  })
  @IsIsoDate()
  @IsOnOrAfter('invoiceDate', { message: 'dueDate must be on or after invoiceDate' })
  dueDate: string;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'AUD' })
  @IsIn(SUPPORTED_CURRENCIES, {
    message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  currency: CurrencyCode;

  @ApiPropertyOptional({ example: 'Invoice is issued to Kanglee' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ type: CreateCustomerDto })
  @IsDefined({ message: 'customer is required' })
  @IsObject({ message: 'customer must be an object' })
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer: CreateCustomerDto;

  @ApiProperty({
    type: [CreateInvoiceItemDto],
    minItems: 1,
    maxItems: 1,
    description: 'Exactly one line item for this version (model supports many)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1, { message: 'items must contain exactly one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  @ItemRatesFitCurrencyScale()
  items: CreateInvoiceItemDto[];

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Tax percentage (0–100)' })
  @IsOptional()
  @IsNumber(MONEY, { message: '$property must be a number with at most 2 decimal places' })
  @Min(0)
  @Max(100)
  taxRate?: number = 10;

  @ApiPropertyOptional({
    example: 20,
    default: 0,
    description:
      "Absolute discount amount (at most the currency's minor units, e.g. whole dong for VND)",
  })
  @FitsCurrencyScale()
  @IsOptional()
  @IsNumber(MONEY, { message: '$property must be a number with at most 2 decimal places' })
  @Min(0)
  discount?: number = 0;
}
