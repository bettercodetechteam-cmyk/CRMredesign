import type { ModulePermission } from '@shared/permissions';
import { nestUsersApi } from '@/services/nest/usersApi';

export async function approveUser(targetUid: string, role: string) {
  await nestUsersApi.approve(targetUid, role);
  return { success: true };
}

export async function rejectUser(targetUid: string) {
  await nestUsersApi.reject(targetUid);
  return { success: true };
}

export async function updateUserAccess(payload: {
  targetUid: string;
  role?: string;
  permissionsGranted?: ModulePermission[];
  permissionsRevoked?: ModulePermission[];
}) {
  await nestUsersApi.updateAccess(payload.targetUid, {
    role: payload.role,
    permissionsGranted: payload.permissionsGranted,
    permissionsRevoked: payload.permissionsRevoked,
  });
  return { success: true };
}

export async function migrateKnownUsers() {
  return { success: true, updated: 0 };
}
