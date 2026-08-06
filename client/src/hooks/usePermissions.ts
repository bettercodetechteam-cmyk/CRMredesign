import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  type ModulePermission,
  resolvePermissions,
  canAccess as checkAccess,
  isDirectorRole,
  isDirectorEmail,
} from '@shared/permissions';

export function usePermissions() {
  const { userProfile } = useAuth();

  const permissions = useMemo(
    () =>
      resolvePermissions(
        userProfile?.role,
        (userProfile?.permissionsGranted ?? []) as ModulePermission[],
        (userProfile?.permissionsRevoked ?? []) as ModulePermission[]
      ),
    [userProfile?.role, userProfile?.permissionsGranted, userProfile?.permissionsRevoked]
  );

  const isDirector = useMemo(
    () =>
      isDirectorRole(userProfile?.role) || isDirectorEmail(userProfile?.email),
    [userProfile?.role, userProfile?.email]
  );

  const canAccess = (module: ModulePermission) => checkAccess(permissions, module);

  return {
    permissions,
    canAccess,
    isDirector,
    role: userProfile?.role ?? null,
  };
}
