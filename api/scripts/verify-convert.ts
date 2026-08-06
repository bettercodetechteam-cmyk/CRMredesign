/**
 * One-off Phase 4 verification (no HTTP / Firebase).
 * Run: npx ts-node --transpile-only scripts/verify-convert.ts
 */
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { LeadSource, LeadStatus, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AuthUser } from '../src/modules/auth/auth-user.types';
import { StudentsService } from '../src/modules/students/students.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const students = app.get(StudentsService);

  const centre = await prisma.centre.upsert({
    where: { code: 'PUNE' },
    update: {},
    create: {
      code: 'PUNE',
      name: 'Pune Centre',
      city: 'Pune',
      isActive: true,
    },
  });

  const course = await prisma.course.upsert({
    where: { code: 'WD' },
    update: {},
    create: {
      code: 'WD',
      name: 'Web Development',
      rollPrefix: 'WD',
      durationMonths: 6,
      isActive: true,
    },
  });

  const staff = await prisma.user.upsert({
    where: { firebaseUid: 'verify-convert-uid' },
    update: {
      centreId: centre.id,
      approved: true,
      isActive: true,
      role: UserRole.director,
    },
    create: {
      firebaseUid: 'verify-convert-uid',
      email: 'verify-convert@example.com',
      firstName: 'Verify',
      lastName: 'Bot',
      role: UserRole.director,
      centreId: centre.id,
      approved: true,
      isActive: true,
    },
  });

  const lead = await prisma.lead.create({
    data: {
      leadNo: `LD-PUNE-TEST-${Date.now().toString(36).toUpperCase()}`,
      centreId: centre.id,
      assignedToId: staff.id,
      createdById: staff.id,
      status: LeadStatus.interested,
      source: LeadSource.walk_in,
      firstName: 'Aarav',
      lastName: 'Patil',
      phone: `9${String(Date.now()).slice(-9)}`,
      courseInterestId: course.id,
    },
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

  const result = await students.convertFromLead(actor, lead.id, {
    admissionDate: '2026-07-15',
  });

  console.log(
    JSON.stringify(
      {
        rollNo: result.rollNo,
        studentId: result.student.id,
        leadStatus: LeadStatus.converted,
        expectedShape: 'WD-2607-07-12-###',
      },
      null,
      2,
    ),
  );

  const secondLead = await prisma.lead.create({
    data: {
      leadNo: `LD-PUNE-TEST-${Date.now().toString(36).toUpperCase()}B`,
      centreId: centre.id,
      assignedToId: staff.id,
      createdById: staff.id,
      status: LeadStatus.interested,
      source: LeadSource.online,
      firstName: 'Diya',
      lastName: 'Kulkarni',
      phone: `8${String(Date.now()).slice(-9)}`,
      courseInterestId: course.id,
    },
  });

  const second = await students.convertFromLead(actor, secondLead.id, {
    admissionDate: '2026-07-15',
  });

  console.log(
    JSON.stringify(
      {
        secondRollNo: second.rollNo,
        note: 'seq should increment within same bucket',
      },
      null,
      2,
    ),
  );

  await app.close();
}

main().catch(async (error: unknown) => {
  console.error(error);
  process.exit(1);
});
