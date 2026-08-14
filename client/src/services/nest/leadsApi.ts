import { nestApi } from '@/lib/nestApi';
import { isValidNestPhone, normalizeNestPhone } from '@/lib/nestLeadMapper';

export interface NestPaginated<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NestLead {
  id: string;
  leadNo: string;
  centreId: string;
  assignedToId: string | null;
  status: string;
  source: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  courseInterestId: string | null;
  notes: string | null;
  nextFollowUpAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListNestLeadsParams {
  centreId?: string;
  status?: string;
  source?: string;
  assignedToId?: string;
  courseInterestId?: string;
  search?: string;
  followUpBefore?: string;
  createdFrom?: string;
  createdTo?: string;
  mineOnly?: boolean;
  page?: number;
  limit?: number;
}

export const nestLeadsApi = {
  list: (params?: ListNestLeadsParams) =>
    nestApi.get<NestPaginated<NestLead>>('/leads', params as Record<string, unknown>),

  get: (id: string) => nestApi.get<NestLead>(`/leads/${id}`),

  create: (body: Record<string, unknown>) =>
    nestApi.post<NestLead>('/leads', body),

  update: (id: string, body: Record<string, unknown>) =>
    nestApi.patch<NestLead>(`/leads/${id}`, body),

  changeStatus: (id: string, body: { status: string; lostReason?: string; note?: string }) =>
    nestApi.patch<NestLead>(`/leads/${id}/status`, body),

  addActivity: (
    id: string,
    body: { activityType: string; summary: string; details?: string },
  ) => nestApi.post(`/leads/${id}/activities`, body),

  convert: (id: string, body?: Record<string, unknown>) =>
    nestApi.post<{ student: unknown; leadId: string; rollNo: string }>(
      `/leads/${id}/convert`,
      body ?? {},
    ),

  remove: (id: string) => nestApi.delete<{ success: boolean; id: string }>(`/leads/${id}`),

  /** Exact phone match within a centre (for duplicate-safe create/update). */
  findByPhone: async (centreId: string, phone: string): Promise<NestLead | null> => {
    const normalized = normalizeNestPhone(phone);
    if (!isValidNestPhone(normalized)) return null;
    const result = await nestApi.get<NestPaginated<NestLead>>('/leads', {
      centreId,
      search: normalized,
      limit: 100,
    });
    return (
      result.items?.find((lead) => normalizeNestPhone(lead.phone) === normalized) ?? null
    );
  },
};
