/**
 * Phase 5 verification: create batch → assign to existing student.
 * Run: npx ts-node --transpile-only scripts/verify-batches.ts
 */
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { BatchStatus, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AuthUser } from '../src/modules/auth/auth-user.types';
import { BatchesService } from '../src/modules/batches/batches.service';
import { StudentsService } from '../src/modules/students/students.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const batches = app.get(BatchesService);
  const students = app.get(StudentsService);

  const centre = await prisma.centre.findUniqueOrThrow({ where: { code: 'PUNE' } });
  const course = await prisma.course.findUniqueOrThrow({ where: { code: 'WD' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { role: UserRole.director, centreId: centre.id },
  });
  const student = await prisma.student.findFirstOrThrow({
    where: { centreId: centre.id, courseId: course.id },
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

  const batch = await batches.create(actor, {
    name: 'WD Morning Jul 2026',
    courseId: course.id,
    centreId: centre.id,
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    timings: 'Mon–Fri 10:00–12:00',
    capacity: 30,
    status: BatchStatus.ongoing,
  });

  const assigned = await students.assignBatch(actor, student.id, {
    batchId: batch.id,
  });

  const updated = await students.update(actor, student.id, {
    parentName: 'Parent Verify',
  });

  const statusChanged = await students.changeStatus(actor, student.id, {
    status: 'active',
  });

  console.log(
    JSON.stringify(
      {
        batchId: batch.id,
        batchStudents: batch._count.students,
        assignedBatchId: assigned.batchId,
        parentName: updated.parentName,
        status: statusChanged.status,
      },
      null,
      2,
    ),
  );

  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
