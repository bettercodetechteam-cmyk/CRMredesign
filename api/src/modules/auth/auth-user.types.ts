import { UserRole } from '@prisma/client';

/**
 * Authenticated staff principal attached to the request after Firebase + Postgres lookup.
 * `id` is the Postgres users.id (UUID), not the Firebase uid.
 */
export interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: UserRole;
  centreId: string | null;
  approved: boolean;
  isActive: boolean;
  isDirector: boolean;
}
