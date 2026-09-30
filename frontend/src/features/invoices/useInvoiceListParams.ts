import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  INVOICE_STATUSES,
  SORTABLE_FIELDS,
  type InvoiceStatus,
  type ListInvoicesParams,
  type Ordering,
  type SortableField,
} from '../../api/types';

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const oneOf = <T extends string>(list: readonly T[], value: string | null): T | undefined =>
  value && (list as readonly string[]).includes(value) ? (value as T) : undefined;

const positiveInt = (value: string | null, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * The URL query string is the single source of truth for list state, so refresh,
 * back/forward and shared links all reproduce the same view. Invalid values in the
 * URL are ignored rather than sent to the API.
 */
export function useInvoiceListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<ListInvoicesParams>(() => {
    const pageSize = positiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    return {
      page: positiveInt(searchParams.get('page'), 1),
      pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
      sortBy: oneOf<SortableField>(SORTABLE_FIELDS, searchParams.get('sortBy')),
      ordering: oneOf<Ordering>(['ASC', 'DESC'], searchParams.get('ordering')),
      status: oneOf<InvoiceStatus>(INVOICE_STATUSES, searchParams.get('status')),
      keyword: searchParams.get('keyword')?.trim() || undefined,
      fromDate: fromDate && DATE_RE.test(fromDate) ? fromDate : undefined,
      toDate: toDate && DATE_RE.test(toDate) ? toDate : undefined,
    };
  }, [searchParams]);

  /** Merge changes into the URL. Any change other than `page` resets to page 1. */
  const update = useCallback(
    (changes: Partial<ListInvoicesParams>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '' || value === null) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const reset = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);

  return { params, update, reset };
}
