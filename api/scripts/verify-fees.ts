/**
 * Phase 6 verification: fee plan → payment → receipt number.
 * Run: npx ts-node --transpile-only scripts/verify-fees.ts
 */
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { PaymentMode, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AuthUser } from '../src/modules/auth/auth-user.types';
import { FeesService } from '../src/modules/fees/fees.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const fees = app.get(FeesService);

  const centre = await prisma.centre.findUniqueOrThrow({ where: { code: 'PUNE' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { role: UserRole.director, centreId: centre.id },
  });
  const student = await prisma.student.findFirstOrThrow({
    where: { centreId: centre.id },
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

  const plan = await fees.createPlan(actor, {
    studentId: student.id,
    totalAmount: 45000,
    notes: 'WD full fees',
    installments: [
      {
        sequence: 1,
        label: 'Admission',
        amountDue: 15000,
        dueDate: '2026-07-15',
      },
      {
        sequence: 2,
        label: 'Installment 2',
        amountDue: 15000,
        dueDate: '2026-08-15',
      },
      {
        sequence: 3,
        label: 'Installment 3',
        amountDue: 15000,
        dueDate: '2026-09-15',
      },
    ],
  });

  const firstInstallment = plan.installments[0]!;
  const paid = await fees.recordPayment(actor, {
    studentFeeId: plan.id,
    installmentId: firstInstallment.id,
    amount: 15000,
    paymentMode: PaymentMode.upi,
    paidAt: '2026-07-15T10:00:00.000Z',
    transactionRef: 'UPI-TEST-001',
  });

  const second = await fees.recordPayment(actor, {
    studentFeeId: plan.id,
    installmentId: plan.installments[1]!.id,
    amount: 15000,
    paymentMode: PaymentMode.cash,
    paidAt: '2026-07-15T11:00:00.000Z',
  });

  console.log(
    JSON.stringify(
      {
        planId: plan.id,
        receipt1: paid.receipt.receiptNo,
        receipt2: second.receipt.receiptNo,
        expectedShape: 'RCP-PUNE-2607-######',
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
