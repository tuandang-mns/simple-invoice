/**
 * Supported ISO 4217 currencies: display symbol + number of minor units (decimal places).
 * Scale matters: VND has NO minor units, so 1000.50 VND is not a valid amount and tax must be
 * rounded to whole dong. Never assume 2 decimals for every currency.
 * A fixed map (not Intl) because the reference data uses e.g. "AU$" rather than "A$".
 */
export const CURRENCIES = {
  AUD: { symbol: 'AU$', minorUnits: 2 },
  USD: { symbol: 'US$', minorUnits: 2 },
  GBP: { symbol: '£', minorUnits: 2 },
  SGD: { symbol: 'S$', minorUnits: 2 },
  EUR: { symbol: '€', minorUnits: 2 },
  VND: { symbol: '₫', minorUnits: 0 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isSupportedCurrency(code: unknown): code is CurrencyCode {
  return typeof code === 'string' && code in CURRENCIES;
}

export function currencySymbolOf(code: CurrencyCode): string {
  return CURRENCIES[code].symbol;
}

/** Decimal places allowed for amounts in this currency (ISO 4217 minor units). */
export function minorUnitsOf(code: CurrencyCode): number {
  return CURRENCIES[code].minorUnits;
}
