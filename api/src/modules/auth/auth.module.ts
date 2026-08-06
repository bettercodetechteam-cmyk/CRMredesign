import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminService } from './firebase-admin.service';

/**
 * Firebase ID-token verification + Postgres user lookup.
 * The global FirebaseAuthGuard is registered in AppModule so every route
 * is protected unless marked @Public().
 */
@Module({
  controllers: [AuthController],
  providers: [FirebaseAdminService, AuthService],
  exports: [FirebaseAdminService, AuthService],
})
export class AuthModule {}
