import { nestApi } from '@/lib/nestApi';
import type { NestPaginated } from './leadsApi';

export interface NestFeeInstallment {
  id: string;
  sequence: number;
  label: string;
  amountDue: string | number;
  amountPaid: string | number;
  dueDate: string | null;
  status: string;
}

export interface NestFeePlan {
  id: string;
  studentId: string;
  centreId: string;
  totalAmount: string | number;
  status: string;
  notes: string | null;
  createdAt: string;
  student?: {
    id: string;
    rollNo: string;
    firstName: string;
    lastName: string | null;
    phone: string;
  };
  installments?: NestFeeInstallment[];
  payments?: Array<{
    id: string;
    amount: string | number;
    paymentMode: string;
    paidAt: string;
    receipt?: { receiptNo: string } | null;
  }>;
}

export interface NestReceipt {
  id: string;
  receiptNo: string;
  studentName: string;
  rollNo: string;
  amount: string | number;
  paymentMode: string;
  paidAt: string;
  issuedAt: string;
}

export const nestFeesApi = {
  listPlans: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<NestFeePlan>>('/fees/plans', params),

  getPlan: (id: string) => nestApi.get<NestFeePlan>(`/fees/plans/${id}`),

  createPlan: (body: Record<string, unknown>) =>
    nestApi.post<NestFeePlan>('/fees/plans', body),

  recordPayment: (body: Record<string, unknown>) =>
    nestApi.post<{
      id: string;
      amount: string | number;
      receipt?: { receiptNo: string };
    }>('/fees/payments', body),

  listReceipts: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<NestReceipt>>('/fees/receipts', params),

  getReceiptByNumber: (receiptNo: string) =>
    nestApi.get<NestReceipt>(`/fees/receipts/by-number/${encodeURIComponent(receiptNo)}`),
};
