import { nestApi } from '@/lib/nestApi';
import type { NestPaginated } from './leadsApi';

export interface NestStudent {
  id: string;
  rollNo: string;
  centreId: string;
  courseId: string;
  batchId: string | null;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  status: string;
  admissionDate: string;
}

export const nestStudentsApi = {
  list: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<NestStudent>>('/students', params),

  get: (id: string) => nestApi.get<NestStudent>(`/students/${id}`),

  getByRoll: (rollNo: string) =>
    nestApi.get<NestStudent>(`/students/by-roll/${encodeURIComponent(rollNo)}`),

  update: (id: string, body: Record<string, unknown>) =>
    nestApi.patch<NestStudent>(`/students/${id}`, body),

  changeStatus: (id: string, status: string) =>
    nestApi.patch<NestStudent>(`/students/${id}/status`, { status }),

  assignBatch: (id: string, batchId: string | null) =>
    nestApi.patch<NestStudent>(`/students/${id}/batch`, { batchId }),
};
