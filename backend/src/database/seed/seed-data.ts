import { addDays } from '../../common/utils/date.util';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../invoices/domain/currency';
import type { PersistedStatus } from '../../invoices/domain/invoice-status';

/** User id referenced by Appendix A's `createdBy`; the seeded demo user gets this id. */
export const SEED_USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';

export interface SeedInvoice {
  id?: string;
  itemId?: string;
  invoiceNumber: string;
  invoiceReference?: string;
  invoiceDate: string;
  dueDate: string;
  currency: CurrencyCode;
  description?: string;
  status: PersistedStatus;
  customer: { fullname: string; email: string; mobileNumber?: string; address?: string };
  item: { name: string; quantity: number; rate: number };
  taxRate: number;
  discount: number;
  /** Fraction of the total already paid (0..1). Paid invoices are always 1. */
  paidRatio: number;
  createdAt?: string;
}

/**
 * Appendix A record, verbatim — except status: the mock says "Overdue", which must never be
 * persisted (spec §2.3.2). We store Pending; its past due date derives Overdue at read time.
 * Totals match the mock: 2 × 1000 = 2000, tax 200, discount 20 → 2180, paid 1451.34 → balance 728.66.
 */
export const APPENDIX_A_INVOICE: SeedInvoice = {
  id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  itemId: 'b1c2d3e4-0000-0000-0000-000000000001',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  status: 'Pending',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  item: { name: 'Honda RC150', quantity: 2, rate: 1000 },
  taxRate: 10,
  discount: 20,
  paidRatio: 1451.34 / 2180,
  createdAt: '2026-06-03T12:03:26.995Z',
};

const CUSTOMERS = [
  { fullname: 'Kang Lee', city: 'Singapore' },
  { fullname: 'Olivia Tan', city: 'Singapore' },
  { fullname: 'Nguyen Van An', city: 'Ho Chi Minh City' },
  { fullname: 'Tran Thi Mai', city: 'Hanoi' },
  { fullname: 'James Wilson', city: 'Sydney' },
  { fullname: 'Charlotte Brown', city: 'Melbourne' },
  { fullname: 'Arjun Mehta', city: 'Kuala Lumpur' },
  { fullname: 'Sofia Rossi', city: 'Milan' },
  { fullname: "Liam O'Connor", city: 'London' },
  { fullname: 'Emily Chen', city: 'San Francisco' },
  { fullname: 'Harbourline Freight Pte Ltd', city: 'Singapore' },
  { fullname: 'Blue Ocean Logistics', city: 'Brisbane' },
];

const ITEMS = [
  { name: 'Honda RC150', min: 800, max: 1500 },
  { name: 'Consulting hours', min: 90, max: 250 },
  { name: 'Cloud hosting (monthly)', min: 50, max: 900 },
  { name: 'Mobile app licence', min: 200, max: 2000 },
  { name: 'Payment gateway setup', min: 500, max: 5000 },
  { name: 'Security audit', min: 1500, max: 12000 },
  { name: 'Office chairs', min: 120, max: 450 },
  { name: 'Training workshop', min: 300, max: 3000 },
];

/** Tiny deterministic PRNG (mulberry32) so every seed run produces the same data shape. */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates `count` invoices with dates RELATIVE to `today`, so the mix of
 * Draft / Pending / Paid / (derived) Overdue stays meaningful whenever the seed runs.
 */
export function generateInvoices(today: string, count = 40): SeedInvoice[] {
  const rand = prng(20260929);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const between = (min: number, max: number) => min + rand() * (max - min);

  const statuses: PersistedStatus[] = ['Draft', 'Pending', 'Paid'];
  const taxRates = [0, 7, 9, 10, 10, 10];

  return Array.from({ length: count }, (_, i) => {
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const itemDef = pick(ITEMS);
    const status = statuses[i % statuses.length];

    // Payment terms of 7–60 days. Roughly 60% of invoices are still within terms (due date in
    // the future) and 40% are past due — so unpaid past-due ones demonstrate derived Overdue.
    const term = pick([7, 14, 30, 45, 60]);
    const withinTerms = rand() < 0.6;
    const invoiceDate = withinTerms
      ? addDays(today, -Math.floor(between(0, term)))
      : addDays(today, -(term + 1 + Math.floor(between(0, 90))));
    const dueDate = addDays(invoiceDate, term);

    // Every 8th invoice is billed in VND (0 minor units): whole-dong amounts at roughly 1 AUD ≈ 16,500 VND.
    const isVnd = i % 8 === 5;
    const currency: CurrencyCode = isVnd
      ? 'VND'
      : pick(SUPPORTED_CURRENCIES.filter((c) => c !== 'VND'));
    const baseRate = Math.round(between(itemDef.min, itemDef.max) * 100) / 100;
    const rate = isVnd ? Math.round(baseRate * 16_500) : baseRate;
    const quantity = 1 + Math.floor(rand() * 10);
    const baseDiscount = rand() < 0.4 ? Math.round(between(5, 100)) : 0;
    const discount = isVnd ? baseDiscount * 16_500 : baseDiscount;
    const paidRatio = status === 'Paid' ? 1 : status === 'Pending' && rand() < 0.5 ? 0.5 : 0;
    const emailLocal = customer.fullname
      .toLowerCase()
      .replace(/[^a-z]+/g, '.')
      .replace(/\.$/, '');

    return {
      invoiceNumber: `INV-${today.slice(0, 4)}-${String(1001 + i)}`,
      invoiceReference: rand() < 0.5 ? `PO-${Math.floor(between(10000, 99999))}` : undefined,
      invoiceDate,
      dueDate,
      currency,
      description: `${itemDef.name} for ${customer.fullname}`,
      status,
      customer: {
        fullname: customer.fullname,
        email: `${emailLocal}@example.com`,
        mobileNumber: rand() < 0.7 ? `+65 ${Math.floor(between(80000000, 99999999))}` : undefined,
        address: customer.city,
      },
      item: { name: itemDef.name, quantity, rate },
      taxRate: pick(taxRates),
      discount,
      paidRatio,
      createdAt: `${invoiceDate}T0${i % 10}:00:00.000Z`,
    };
  });
}
