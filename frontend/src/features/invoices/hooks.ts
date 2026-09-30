import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../../api/invoices.api';
import type { CreateInvoicePayload, ListInvoicesParams } from '../../api/types';

/** Query keys in one place so invalidation stays consistent. */
export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (params: ListInvoicesParams) => ['invoices', 'list', params] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
};

export function useInvoices(params: ListInvoicesParams) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => invoicesApi.list(params),
    placeholderData: keepPreviousData, // keep the current page visible while the next loads
  });
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: invoiceKeys.detail(id), queryFn: () => invoicesApi.get(id) });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => invoicesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}
