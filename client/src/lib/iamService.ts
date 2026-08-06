import type { ModulePermission } from '@shared/permissions';
import { auth, db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  DIRECTOR_EMAILS,
  EMAIL_ROLE_MIGRATION,
  isDirectorEmail,
  isDirectorRole,
  normalizeEmail,
  normalizeRole,
} from '@shared/permissions';

async function getAuthHeaders(): Promise<HeadersInit> {
  if (!auth?.currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await auth.currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function assertCallerIsDirector() {
  const user = auth?.currentUser;
  if (!user || !db) {
    throw new Error('You must be signed in to perform this action.');
  }
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) {
    throw new Error('User profile not found.');
  }
  const data = snap.data();
  const role = normalizeRole(data.role);
  const email = normalizeEmail(data.email ?? user.email);
  if (!isDirectorRole(role) && !isDirectorEmail(email)) {
    throw new Error('Only directors can perform this action.');
  }
  return { uid: user.uid, email };
}

async function iamPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

async function withServerOrClientFallback<T>(
  serverCall: () => Promise<T>,
  clientCall: () => Promise<T>
): Promise<T> {
  try {
    return await serverCall();
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    const useFallback =
      err.status === 503 ||
      err.message?.includes('IAM service unavailable') ||
      err.message?.includes('Firebase Admin');

    if (!useFallback) {
      throw error;
    }

    return clientCall();
  }
}

async function clientApproveUser(targetUid: string, role: string) {
  const caller = await assertCallerIsDirector();
  if (!db) throw new Error('Database not available');

  const normalizedRole = normalizeRole(role);
  if (!normalizedRole || normalizedRole === 'pending') {
    throw new Error('Valid role is required.');
  }

  await updateDoc(doc(db, 'users', targetUid), {
    approved: true,
    rejected: false,
    role: normalizedRole,
    permissionsGranted: [],
    permissionsRevoked: [],
    approvedBy: caller.uid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'notifications'), {
    type: 'account_approved',
    message: 'Your account has been approved! You can now sign in to the CRM.',
    userId: targetUid,
    createdAt: serverTimestamp(),
    seen: false,
  });

  return { success: true };
}

async function clientRejectUser(targetUid: string) {
  const caller = await assertCallerIsDirector();
  if (!db) throw new Error('Database not available');

  await updateDoc(doc(db, 'users', targetUid), {
    approved: false,
    rejected: true,
    rejectedBy: caller.uid,
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'notifications'), {
    type: 'account_rejected',
    message: 'Your account request has been rejected. Please contact your administrator.',
    userId: targetUid,
    createdAt: serverTimestamp(),
    seen: false,
  });

  return { success: true };
}

async function clientUpdateUserAccess(payload: {
  targetUid: string;
  role?: string;
  permissionsGranted?: ModulePermission[];
  permissionsRevoked?: ModulePermission[];
}) {
  const caller = await assertCallerIsDirector();
  if (!db) throw new Error('Database not available');

  const targetRef = doc(db, 'users', payload.targetUid);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) {
    throw new Error('Target user not found.');
  }

  const target = targetSnap.data();
  const targetEmail = normalizeEmail(target.email);
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: caller.uid,
  };

  if (payload.role !== undefined) {
    const nextRole = normalizeRole(payload.role);
    if (DIRECTOR_EMAILS.includes(targetEmail as (typeof DIRECTOR_EMAILS)[number]) && nextRole !== 'director') {
      throw new Error('Cannot demote protected director accounts.');
    }
    if (payload.targetUid === caller.uid && nextRole !== 'director') {
      throw new Error('Directors cannot remove their own director role.');
    }
    patch.role = nextRole;
  }
  if (payload.permissionsGranted !== undefined) {
    patch.permissionsGranted = payload.permissionsGranted;
  }
  if (payload.permissionsRevoked !== undefined) {
    patch.permissionsRevoked = payload.permissionsRevoked;
  }

  await updateDoc(targetRef, patch);
  return { success: true };
}

async function clientMigrateKnownUsers() {
  await assertCallerIsDirector();
  if (!db) throw new Error('Database not available');

  const snapshot = await getDocs(collection(db, 'users'));
  let updated = 0;

  for (const docSnap of snapshot.docs) {
    const user = docSnap.data();
    const email = normalizeEmail(user.email);
    const mappedRole = EMAIL_ROLE_MIGRATION[email];
    const patch: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    let shouldUpdate = false;

    if (mappedRole) {
      patch.role = mappedRole;
      patch.approved = true;
      patch.permissionsGranted = [];
      patch.permissionsRevoked = [];
      patch.rejected = false;
      shouldUpdate = true;
    } else if (normalizeRole(user.role) === 'accounts' || normalizeRole(user.role) === 'accountant') {
      patch.role = 'accounting';
      shouldUpdate = true;
    } else if (
      normalizeRole(user.role) === 'director' &&
      !isDirectorEmail(email) &&
      user.approved !== true
    ) {
      patch.role = 'pending';
      patch.approved = false;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      await updateDoc(docSnap.ref, patch);
      updated += 1;
    }
  }

  return { success: true, updated };
}

export async function approveUser(targetUid: string, role: string) {
  return withServerOrClientFallback(
    () => iamPost<{ success: boolean }>('/api/iam/approve-user', { targetUid, role }),
    () => clientApproveUser(targetUid, role)
  );
}

export async function rejectUser(targetUid: string) {
  return withServerOrClientFallback(
    () => iamPost<{ success: boolean }>('/api/iam/reject-user', { targetUid }),
    () => clientRejectUser(targetUid)
  );
}

export async function updateUserAccess(payload: {
  targetUid: string;
  role?: string;
  permissionsGranted?: ModulePermission[];
  permissionsRevoked?: ModulePermission[];
}) {
  return withServerOrClientFallback(
    () => iamPost<{ success: boolean }>('/api/iam/update-access', payload),
    () => clientUpdateUserAccess(payload)
  );
}

export async function migrateKnownUsers() {
  return withServerOrClientFallback(
    () => iamPost<{ success: boolean; updated: number }>('/api/iam/migrate-known-users', {}),
    () => clientMigrateKnownUsers()
  );
}
