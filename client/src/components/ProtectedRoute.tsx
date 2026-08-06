import React from 'react';
import { useAuth, useRole } from '../hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import Loading from '@/components/ui/loading';
import { Navigate, useLocation } from 'react-router-dom';
import type { ModulePermission } from '@shared/permissions';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  element?: React.ReactElement;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, element, allowedRoles }: ProtectedRouteProps) {
  const { userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loading size="lg" color="primary" text="Loading..." />
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userProfile.approved) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : element || null;
}

interface PermissionRouteProps {
  children: React.ReactNode;
  permission: ModulePermission;
}

export function PermissionRoute({ children, permission }: PermissionRouteProps) {
  const { userProfile, loading } = useAuth();
  const { canAccess } = usePermissions();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loading size="lg" color="primary" text="Loading..." />
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userProfile.approved) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (!canAccess(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

export function DirectorRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['director']}>
      {children}
    </ProtectedRoute>
  );
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isDirector } = useRole();
  if (!isDirector()) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}

export function FacultyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['faculty', 'academic_head', 'director']}>
      {children}
    </ProtectedRoute>
  );
}

export function StudentRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      {children}
    </ProtectedRoute>
  );
}
