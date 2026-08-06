/**
 * Phase 7 verification: dashboard overview against seeded data.
 * Run: npx ts-node --transpile-only scripts/verify-dashboard.ts
 */
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AuthUser } from '../src/modules/auth/auth-user.types';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const dashboard = app.get(DashboardService);

  const centre = await prisma.centre.findUniqueOrThrow({ where: { code: 'PUNE' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { role: UserRole.director, centreId: centre.id },
  });

  const actor: AuthUser = {
    id: staff.id,
    firebaseUid: staff.firebaseUid,
    email: staff.email,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    centreId: staff.centreId,
    approved: true,
    isActive: true,
    isDirector: true,
  };

  const overview = await dashboard.getOverview(actor, {
    centreId: centre.id,
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-12-31T23:59:59.999Z',
  });

  console.log(JSON.stringify(overview, null, 2));
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
