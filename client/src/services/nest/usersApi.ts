import { nestApi } from '@/lib/nestApi';
import type { NestPaginated } from './leadsApi';

export interface NestStaffUser {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone?: string | null;
  role: string;
  centreId: string | null;
  approved: boolean;
  isActive: boolean;
  permissionsGranted: string[];
  permissionsRevoked: string[];
  createdAt: string;
}

export const nestUsersApi = {
  list: (params?: Record<string, unknown>) =>
    nestApi.get<NestPaginated<NestStaffUser>>('/users', params),

  assignees: () =>
    nestApi.get<
      Array<{
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        role: string;
        centreId: string | null;
      }>
    >('/users/assignees'),

  updateAccess: (
    id: string,
    body: {
      role?: string;
      permissionsGranted?: string[];
      permissionsRevoked?: string[];
      isActive?: boolean;
    },
  ) => nestApi.patch<NestStaffUser>(`/users/${id}/access`, body),

  approve: (id: string, role: string) =>
    nestApi.post<NestStaffUser>(`/users/${id}/approve`, { role }),

  reject: (id: string) => nestApi.post<NestStaffUser>(`/users/${id}/reject`),
};
