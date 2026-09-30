import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceDetailDto, InvoiceListResponseDto } from './dto/invoice-response.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token', type: ErrorResponseDto })
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices with search, filter, sort and server-side pagination' })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters', type: ErrorResponseDto })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice detail by ID' })
  @ApiOkResponse({ type: InvoiceDetailDto })
  @ApiBadRequestResponse({ description: 'id is not a UUID', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Invoice not found', type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDetailDto> {
    return this.invoices.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new invoice (status Draft; totals calculated server-side)',
  })
  @ApiCreatedResponse({ type: InvoiceDetailDto })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Invoice number already exists', type: ErrorResponseDto })
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<InvoiceDetailDto> {
    return this.invoices.create(dto, user.sub);
  }
}
