import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicesService } from './invoices.service';

const USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';

function dto(overrides: Partial<CreateInvoiceDto> = {}): CreateInvoiceDto {
  return {
    invoiceNumber: 'INV-1',
    invoiceDate: '2026-06-03',
    dueDate: '2026-07-03',
    currency: 'AUD',
    customer: { fullname: 'Paul', email: 'paul@101digital.io' },
    items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
    taxRate: 10,
    discount: 20,
    ...overrides,
  };
}

/** Echoes back what Prisma would have stored, so we can assert on the persisted values. */
function dbRowFrom(data: Record<string, unknown>) {
  const items = (data.items as { create: Record<string, unknown>[] }).create;
  return {
    ...data,
    id: '11111111-1111-4111-8111-111111111111',
    totalPaid: new Prisma.Decimal(data.totalPaid as string),
    createdAt: new Date('2026-06-03T00:00:00Z'),
    items: items.map((item, i) => ({ ...item, id: `item-${i}` })),
  };
}

describe('InvoicesService', () => {
  let prisma: { invoice: { create: jest.Mock; findUnique: jest.Mock } };
  let service: InvoicesService;

  beforeEach(() => {
    prisma = {
      invoice: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(dbRowFrom(data)),
        ),
        findUnique: jest.fn(),
      },
    };
    const config = { get: () => 'Asia/Singapore' } as unknown as ConfigService;
    service = new InvoicesService(prisma as unknown as PrismaService, config as never);
  });

  describe('create', () => {
    it('persists server-calculated totals and always status Draft', async () => {
      await service.create(dto(), USER_ID);

      const { data } = prisma.invoice.create.mock.calls[0][0];
      expect(data).toMatchObject({
        status: 'Draft',
        currencySymbol: 'AU$',
        invoiceSubTotal: '2000',
        totalTax: '200',
        totalDiscount: '20',
        totalAmount: '2180',
        totalPaid: '0',
        balanceAmount: '2180',
        createdBy: USER_ID,
      });
      expect(data.items.create[0]).toMatchObject({ quantity: 2, rate: '1000', amount: '2000' });
    });

    it('applies the 10% default tax when taxRate is omitted', async () => {
      await service.create(dto({ taxRate: undefined, discount: undefined }), USER_ID);
      const { data } = prisma.invoice.create.mock.calls[0][0];
      expect(data.taxRate).toBe('10');
      expect(data.totalAmount).toBe('2200');
    });

    it('rejects a due date before the invoice date (server-side, independent of the DTO)', async () => {
      await expect(service.create(dto({ dueDate: '2026-06-01' }), USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it('rejects a discount that would make the total negative', async () => {
      await expect(service.create(dto({ discount: 5000 }), USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('maps a DB unique violation on invoice number to 409 Conflict', async () => {
      prisma.invoice.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.create(dto(), USER_ID)).rejects.toThrow(ConflictException);
    });

    it('does not swallow unrelated database errors', async () => {
      prisma.invoice.create.mockRejectedValueOnce(new Error('connection lost'));
      await expect(service.create(dto(), USER_ID)).rejects.toThrow('connection lost');
    });
  });

  describe('findOne', () => {
    it('throws 404 "Invoice not found" when missing', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.findOne('11111111-1111-4111-8111-111111111111')).rejects.toThrow(
        new NotFoundException('Invoice not found'),
      );
    });
  });
});
