import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto';

const valid = () => ({
  invoiceNumber: 'INV-1',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  customer: { fullname: 'Paul', email: 'paul@101digital.io' },
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
});

async function errorsFor(payload: object): Promise<string[]> {
  const dto = plainToInstance(CreateInvoiceDto, payload);
  const errors = await validate(dto);
  const flatten = (list: typeof errors, prefix = ''): string[] =>
    list.flatMap((e) => [
      ...Object.values(e.constraints ?? {}).map((m) => prefix + m),
      ...flatten(e.children ?? [], `${prefix}${e.property}.`),
    ]);
  return flatten(errors);
}

describe('CreateInvoiceDto validation', () => {
  it('accepts a valid payload and applies defaults (tax 10%, discount 0)', async () => {
    expect(await errorsFor(valid())).toEqual([]);
    const dto = plainToInstance(CreateInvoiceDto, valid());
    expect(dto.taxRate).toBe(10);
    expect(dto.discount).toBe(0);
  });

  describe('due date rule', () => {
    it('rejects dueDate before invoiceDate with the spec message', async () => {
      expect(await errorsFor({ ...valid(), dueDate: '2026-06-02' })).toContain(
        'dueDate must be on or after invoiceDate',
      );
    });

    it('accepts dueDate equal to invoiceDate', async () => {
      expect(await errorsFor({ ...valid(), dueDate: '2026-06-03' })).toEqual([]);
    });

    it('rejects impossible or non-ISO dates', async () => {
      const errors = await errorsFor({
        ...valid(),
        invoiceDate: '2026-02-30',
        dueDate: '03/07/2026',
      });
      expect(errors).toContain('invoiceDate must be a valid date');
      expect(errors).toContain('dueDate must be in YYYY-MM-DD format');
    });
  });

  it('requires customer name (non-blank) and a valid email', async () => {
    const errors = await errorsFor({ ...valid(), customer: { fullname: '   ', email: 'nope' } });
    expect(errors).toContain('customer.fullname should not be empty');
    expect(errors).toContain('customer.email must be a valid email address');
  });

  it('requires a positive integer quantity and a positive rate', async () => {
    const errors = await errorsFor({ ...valid(), items: [{ name: 'x', quantity: 1.5, rate: 0 }] });
    expect(errors).toContain('items.0.quantity must be an integer number');
    expect(errors).toContain('items.0.rate must be a positive number');
  });

  it('accepts exactly one line item', async () => {
    const item = { name: 'x', quantity: 1, rate: 1 };
    expect(await errorsFor({ ...valid(), items: [] })).toContain(
      'items must contain at least 1 elements',
    );
    expect(await errorsFor({ ...valid(), items: [item, item] })).toContain(
      'items must contain exactly one line item',
    );
  });

  it('rejects negative tax and discount, and unsupported currencies', async () => {
    const errors = await errorsFor({ ...valid(), taxRate: -1, discount: -5, currency: 'XYZ' });
    expect(errors).toContain('taxRate must not be less than 0');
    expect(errors).toContain('discount must not be less than 0');
    expect(errors.some((e) => e.startsWith('currency must be one of'))).toBe(true);
  });

  it('accepts every 2-decimal rate from 0.01 to 999.99 and rejects 3 decimals', async () => {
    const rejected: string[] = [];
    for (let cents = 1; cents < 100_000; cents += 1) {
      const rate = Number((cents / 100).toFixed(2));
      const errors = await errorsFor({ ...valid(), items: [{ name: 'x', quantity: 1, rate }] });
      if (errors.length > 0) rejected.push(String(rate));
    }
    expect(rejected).toEqual([]);
    expect(
      await errorsFor({ ...valid(), items: [{ name: 'x', quantity: 1, rate: 10.999 }] }),
    ).toContain('items.0.rate must be a number with at most 2 decimal places');
  });

  it('rejects a missing customer with a 400 message instead of crashing', async () => {
    const { customer: _customer, ...withoutCustomer } = valid();
    void _customer;
    expect(await errorsFor(withoutCustomer)).toContain('customer is required');
  });

  it('caps quantity and rate so every total stays exact as a JSON number', async () => {
    const errors = await errorsFor({
      ...valid(),
      items: [{ name: 'x', quantity: 100_001, rate: 100_000_000.01 }],
    });
    expect(errors).toContain('items.0.quantity must not be greater than 100000');
    expect(errors).toContain('items.0.rate must not be greater than 100000000');
    expect(
      await errorsFor({ ...valid(), items: [{ name: 'x', quantity: 100_000, rate: 100_000_000 }] }),
    ).toEqual([]);
  });

  it('rejects implausible years', async () => {
    const errors = await errorsFor({
      ...valid(),
      invoiceDate: '9999-12-30',
      dueDate: '9999-12-31',
    });
    expect(errors).toContain('invoiceDate year must be between 1900 and 2999');
    expect(errors).toContain('dueDate year must be between 1900 and 2999');
  });

  describe('currency scale', () => {
    it('accepts whole-dong amounts for VND', async () => {
      expect(
        await errorsFor({
          ...valid(),
          currency: 'VND',
          items: [{ name: 'x', quantity: 2, rate: 1_650_000 }],
          discount: 5_000,
        }),
      ).toEqual([]);
    });

    it('rejects decimals for VND (no minor units)', async () => {
      const errors = await errorsFor({
        ...valid(),
        currency: 'VND',
        items: [{ name: 'x', quantity: 1, rate: 1000.5 }],
        discount: 0.5,
      });
      expect(errors).toContain('items.0.rate must be a whole number for VND (no minor units)');
      expect(errors).toContain('discount must be a whole number for VND (no minor units)');
    });

    it('still allows 2 decimals for AUD', async () => {
      expect(
        await errorsFor({
          ...valid(),
          currency: 'AUD',
          items: [{ name: 'x', quantity: 1, rate: 19.99 }],
          discount: 0.5,
        }),
      ).toEqual([]);
    });
  });
});
