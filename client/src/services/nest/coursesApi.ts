import { nestApi } from '@/lib/nestApi';
import type { NestPaginated } from './leadsApi';

export interface NestCourse {
  id: string;
  name: string;
  code: string;
  rollPrefix: string;
  durationMonths: number;
  fees: string | null;
  category: string | null;
  isActive: boolean;
}

export const nestCoursesApi = {
  list: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<NestCourse>>('/courses', params),

  get: (id: string) => nestApi.get<NestCourse>(`/courses/${id}`),

  create: (body: Record<string, unknown>) =>
    nestApi.post<NestCourse>('/courses', body),

  update: (id: string, body: Record<string, unknown>) =>
    nestApi.patch<NestCourse>(`/courses/${id}`, body),
};
