import { nestApi } from '@/lib/nestApi';
import type { NestPaginated } from './leadsApi';

export interface NestBatch {
  id: string;
  name: string;
  courseId: string;
  centreId: string;
  startDate: string | null;
  endDate: string | null;
  timings: string | null;
  capacity: number;
  status: string;
  course?: { id: string; name: string; code: string };
  centre?: { id: string; code: string; name: string };
  _count?: { students: number };
}

export const nestBatchesApi = {
  list: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<NestBatch>>('/batches', params),

  get: (id: string) => nestApi.get<NestBatch>(`/batches/${id}`),

  create: (body: Record<string, unknown>) =>
    nestApi.post<NestBatch>('/batches', body),

  update: (id: string, body: Record<string, unknown>) =>
    nestApi.patch<NestBatch>(`/batches/${id}`, body),
};
