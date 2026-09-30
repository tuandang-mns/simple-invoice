import Decimal from 'decimal.js';

/** Money uses decimal arithmetic — never JS floats (0.1 + 0.2 !== 0.3). */
export const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Money = InstanceType<typeof Money>;

export type MoneyInput = Money | number | string;

/** Round half-up to `scale` decimal places (the currency's minor units). */
export function roundTo(value: MoneyInput, scale: number): Money {
  return new Money(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
}

/** Round to 2 decimal places, half-up (e.g. 0.005 -> 0.01). */
export function round2(value: MoneyInput): Money {
  return roundTo(value, 2);
}

/** Number of decimal places actually present in a value (1000 → 0, 19.99 → 2). */
export function decimalPlacesOf(value: MoneyInput): number {
  return new Money(value).decimalPlaces();
}

/** Serialise for JSON responses: a number with at most 2 dp. */
export function toAmount(value: { toString(): string }): number {
  return round2(value.toString()).toNumber();
}
