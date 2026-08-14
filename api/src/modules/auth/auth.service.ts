import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { AuthUser } from './auth-user.types';
import { FirebaseAdminService } from './firebase-admin.service';

const DIRECTOR_EMAILS = new Set([
  'cmzicazima@gmail.com',
  'gauravkarewar724@gmail.com',
  'director@zica.edu',
]);

@Injectable()
export class AuthService {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verify Firebase ID token, then load the matching Postgres staff row.
   * Roles / centre / approval live in Postgres — Firebase is identity only.
   */
  async authenticateWithIdToken(idToken: string): Promise<AuthUser> {
    return this.resolveUserFromIdToken(idToken, { requireApproved: true });
  }

  async resolveUserFromIdToken(
    idToken: string,
    options?: { requireApproved?: boolean },
  ): Promise<AuthUser> {
    let firebaseUid: string;

    try {
      const decoded = await this.firebaseAdmin.verifyIdToken(idToken);
      firebaseUid = decoded.uid;
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new ForbiddenException(
        'User profile not found in CRM database. Ask a director to provision your account.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    if (options?.requireApproved !== false && !user.approved) {
      throw new ForbiddenException('Account not approved');
    }

    const email = user.email.toLowerCase();
    const isDirector =
      user.role === UserRole.director || DIRECTOR_EMAILS.has(email);

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      centreId: user.centreId,
      approved: user.approved,
      isActive: user.isActive,
      isDirector,
      permissionsGranted: user.permissionsGranted ?? [],
      permissionsRevoked: user.permissionsRevoked ?? [],
    };
  }
}
