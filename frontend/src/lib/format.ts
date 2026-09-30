const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2026-07-03" → "03 Jul 2026". Parsed by hand (no Date object) so the browser's
 * timezone can never shift a calendar date by a day.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return isoDate;
  return `${day} ${monthName} ${year}`;
}

const formatters = new Map<number, Intl.NumberFormat>();
const amountFormatter = (decimals: number) => {
  let formatter = formatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(decimals, formatter);
  }
  return formatter;
};

/**
 * 2180 + "AU$" → "AU$2,180.00"; 1650000 + "₫" + 0 decimals → "₫1,650,000".
 * `decimals` is the currency's minor units (2 by default, 0 for VND).
 */
export function formatMoney(amount: number, currencySymbol = '', decimals = 2): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currencySymbol}${amountFormatter(decimals).format(Math.abs(amount))}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Today's date as YYYY-MM-DD in the browser's local timezone (for form defaults). */
export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

const MIN_FILTER_YEAR = 1900;
const MAX_FILTER_YEAR = 2999;

/** '' (cleared) or a real YYYY-MM-DD date with a plausible year. */
export function isCommittableDate(value: string): boolean {
  if (value === '') return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  return year >= MIN_FILTER_YEAR && year <= MAX_FILTER_YEAR;
}
