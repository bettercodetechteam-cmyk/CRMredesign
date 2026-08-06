import { nestApi } from '@/lib/nestApi';
import type { NestPaginated } from './leadsApi';

export const nestFeesApi = {
  listPlans: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<unknown>>('/fees/plans', params),

  getPlan: (id: string) => nestApi.get(`/fees/plans/${id}`),

  createPlan: (body: Record<string, unknown>) =>
    nestApi.post('/fees/plans', body),

  recordPayment: (body: Record<string, unknown>) =>
    nestApi.post<{ payment: unknown; receipt: { receiptNo: string } }>(
      '/fees/payments',
      body,
    ),

  listReceipts: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<unknown>>('/fees/receipts', params),

  getReceiptByNumber: (receiptNo: string) =>
    nestApi.get(`/fees/receipts/by-number/${encodeURIComponent(receiptNo)}`),
};
