import { http } from './client';
import type {
  CreateInvoicePayload,
  InvoiceDetail,
  InvoiceSummary,
  ListInvoicesParams,
  Paged,
} from './types';

export const invoicesApi = {
  list: async (params: ListInvoicesParams): Promise<Paged<InvoiceSummary>> =>
    (await http.get<Paged<InvoiceSummary>>('/invoices', { params })).data,

  get: async (id: string): Promise<InvoiceDetail> =>
    (await http.get<InvoiceDetail>(`/invoices/${encodeURIComponent(id)}`)).data,

  create: async (payload: CreateInvoicePayload): Promise<InvoiceDetail> =>
    (await http.post<InvoiceDetail>('/invoices', payload)).data,
};
