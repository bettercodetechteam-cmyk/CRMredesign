/**
 * Local CRM workflow seed — courses, batches, leads, students, fees, receipts, tasks.
 * Idempotent. Safe to re-run.
 *
 *   npm run db:seed:workflow
 */
import 'dotenv/config';

import {
  BatchStatus,
  LeadSource,
  LeadStatus,
  PaymentMode,
  Prisma,
  PrismaClient,
  StudentStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const centre = await prisma.centre.upsert({
      where: { code: 'PUNE' },
      update: { name: 'Pune Centre', isActive: true, city: 'Pune', state: 'Maharashtra' },
      create: {
        code: 'PUNE',
        name: 'Pune Centre',
        city: 'Pune',
        state: 'Maharashtra',
        isActive: true,
      },
    });

    const director =
      (await prisma.user.findFirst({
        where: { role: UserRole.director, approved: true },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await prisma.user.findFirst({
        where: { approved: true },
        orderBy: { createdAt: 'asc' },
      }));

    if (!director) {
      throw new Error(
        'No approved user found. Sign in once (or run prisma:seed) so a director exists, then re-run this seed.',
      );
    }

    if (!director.centreId) {
      await prisma.user.update({
        where: { id: director.id },
        data: { centreId: centre.id },
      });
    }

    const courses = await Promise.all(
      [
        {
          code: 'WD',
          name: 'Web Development',
          rollPrefix: 'WD',
          durationMonths: 6,
          fees: 45000,
          category: 'Development',
        },
        {
          code: 'ANI',
          name: '2D / 3D Animation',
          rollPrefix: 'ANI',
          durationMonths: 12,
          fees: 85000,
          category: 'Animation',
        },
        {
          code: 'GD',
          name: 'Graphic Design',
          rollPrefix: 'GD',
          durationMonths: 6,
          fees: 38000,
          category: 'Design',
        },
        {
          code: 'VFX',
          name: 'VFX Compositing',
          rollPrefix: 'VFX',
          durationMonths: 8,
          fees: 72000,
          category: 'VFX',
        },
      ].map((course) =>
        prisma.course.upsert({
          where: { code: course.code },
          update: {
            name: course.name,
            rollPrefix: course.rollPrefix,
            durationMonths: course.durationMonths,
            fees: money(course.fees),
            category: course.category,
            isActive: true,
          },
          create: {
            ...course,
            fees: money(course.fees),
            isActive: true,
            description: `${course.name} — local test catalogue`,
          },
        }),
      ),
    );

    const byCode = Object.fromEntries(courses.map((course) => [course.code, course]));

    const batchSpecs = [
      {
        name: 'WD Morning Jul 2026',
        courseId: byCode.WD.id,
        timings: 'Mon–Fri 10:00–12:00',
        capacity: 25,
        status: BatchStatus.ongoing,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-12-31'),
      },
      {
        name: 'ANI Weekend Aug 2026',
        courseId: byCode.ANI.id,
        timings: 'Sat–Sun 11:00–15:00',
        capacity: 18,
        status: BatchStatus.upcoming,
        startDate: new Date('2026-08-02'),
        endDate: new Date('2027-07-31'),
      },
      {
        name: 'GD Evening Jul 2026',
        courseId: byCode.GD.id,
        timings: 'Mon–Fri 18:00–20:00',
        capacity: 20,
        status: BatchStatus.ongoing,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2027-01-15'),
      },
    ];

    const batches = [];
    for (const batch of batchSpecs) {
      const existing = await prisma.batch.findFirst({
        where: { centreId: centre.id, name: batch.name },
      });
      batches.push(
        existing
          ? await prisma.batch.update({
              where: { id: existing.id },
              data: {
                timings: batch.timings,
                capacity: batch.capacity,
                status: batch.status,
                startDate: batch.startDate,
                endDate: batch.endDate,
                courseId: batch.courseId,
              },
            })
          : await prisma.batch.create({
              data: {
                name: batch.name,
                courseId: batch.courseId,
                centreId: centre.id,
                timings: batch.timings,
                capacity: batch.capacity,
                status: batch.status,
                startDate: batch.startDate,
                endDate: batch.endDate,
              },
            }),
      );
    }

    const counsellor = await prisma.user.upsert({
      where: { email: 'counsellor.seed@zica.edu' },
      update: {
        firstName: 'Asha',
        lastName: 'Patil',
        role: UserRole.bdm,
        centreId: centre.id,
        approved: true,
        isActive: true,
      },
      create: {
        firebaseUid: 'seed-counsellor-asha',
        email: 'counsellor.seed@zica.edu',
        firstName: 'Asha',
        lastName: 'Patil',
        role: UserRole.bdm,
        centreId: centre.id,
        approved: true,
        isActive: true,
      },
    });

    const faculty = await prisma.user.upsert({
      where: { email: 'faculty.seed@zica.edu' },
      update: {
        firstName: 'Rahul',
        lastName: 'Deshmukh',
        role: UserRole.faculty,
        centreId: centre.id,
        approved: true,
        isActive: true,
      },
      create: {
        firebaseUid: 'seed-faculty-rahul',
        email: 'faculty.seed@zica.edu',
        firstName: 'Rahul',
        lastName: 'Deshmukh',
        role: UserRole.faculty,
        centreId: centre.id,
        approved: true,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'pending.seed@zica.edu' },
      update: {
        firstName: 'Neha',
        lastName: 'Kulkarni',
        role: UserRole.pending,
        centreId: centre.id,
        approved: false,
        isActive: true,
      },
      create: {
        firebaseUid: 'seed-pending-neha',
        email: 'pending.seed@zica.edu',
        firstName: 'Neha',
        lastName: 'Kulkarni',
        role: UserRole.pending,
        centreId: centre.id,
        approved: false,
        isActive: true,
      },
    });

    const leadSpecs = [
      {
        leadNo: 'LD-SEED-001',
        status: LeadStatus.new,
        source: LeadSource.walk_in,
        firstName: 'Rohan',
        lastName: 'Joshi',
        phone: '9876500001',
        email: 'rohan.joshi@example.com',
        courseId: byCode.WD.id,
        nextFollowUpAt: daysFromNow(1),
      },
      {
        leadNo: 'LD-SEED-002',
        status: LeadStatus.interested,
        source: LeadSource.online,
        firstName: 'Sneha',
        lastName: 'Iyer',
        phone: '9876500002',
        email: 'sneha.iyer@example.com',
        courseId: byCode.ANI.id,
        nextFollowUpAt: daysFromNow(-1),
      },
      {
        leadNo: 'LD-SEED-003',
        status: LeadStatus.visited,
        source: LeadSource.referral,
        firstName: 'Amit',
        lastName: 'Shah',
        phone: '9876500003',
        email: 'amit.shah@example.com',
        courseId: byCode.GD.id,
        nextFollowUpAt: daysFromNow(2),
      },
      {
        leadNo: 'LD-SEED-004',
        status: LeadStatus.contacted,
        source: LeadSource.social_media,
        firstName: 'Priya',
        lastName: 'Nair',
        phone: '9876500004',
        email: 'priya.nair@example.com',
        courseId: byCode.VFX.id,
        nextFollowUpAt: daysFromNow(0),
      },
      {
        leadNo: 'LD-SEED-101',
        status: LeadStatus.converted,
        source: LeadSource.walk_in,
        firstName: 'Karan',
        lastName: 'Mehta',
        phone: '9876500101',
        email: 'karan.mehta@example.com',
        courseId: byCode.WD.id,
      },
      {
        leadNo: 'LD-SEED-102',
        status: LeadStatus.converted,
        source: LeadSource.online,
        firstName: 'Ananya',
        lastName: 'Rao',
        phone: '9876500102',
        email: 'ananya.rao@example.com',
        courseId: byCode.ANI.id,
      },
      {
        leadNo: 'LD-SEED-103',
        status: LeadStatus.converted,
        source: LeadSource.referral,
        firstName: 'Vikram',
        lastName: 'Singh',
        phone: '9876500103',
        email: 'vikram.singh@example.com',
        courseId: byCode.GD.id,
      },
    ] as const;

    const leads = [];
    for (const spec of leadSpecs) {
      const lead = await prisma.lead.upsert({
        where: { leadNo: spec.leadNo },
        update: {
          status: spec.status,
          source: spec.source,
          firstName: spec.firstName,
          lastName: spec.lastName,
          phone: spec.phone,
          email: spec.email,
          courseInterestId: spec.courseId,
          assignedToId: counsellor.id,
          nextFollowUpAt: 'nextFollowUpAt' in spec ? spec.nextFollowUpAt : null,
        },
        create: {
          leadNo: spec.leadNo,
          centreId: centre.id,
          status: spec.status === LeadStatus.converted ? LeadStatus.interested : spec.status,
          source: spec.source,
          firstName: spec.firstName,
          lastName: spec.lastName,
          phone: spec.phone,
          email: spec.email,
          courseInterestId: spec.courseId,
          assignedToId: counsellor.id,
          createdById: director.id,
          notes: 'Seeded local test lead',
          nextFollowUpAt: 'nextFollowUpAt' in spec ? spec.nextFollowUpAt : null,
        },
      });
      leads.push(lead);
    }

    const convertedSpecs = [
      {
        leadNo: 'LD-SEED-101',
        rollNo: 'WD-2607-07-12-001',
        course: byCode.WD,
        batch: batches[0],
        parentName: 'Suresh Mehta',
        parentPhone: '9876511101',
        total: 45000,
        paid: 15000,
      },
      {
        leadNo: 'LD-SEED-102',
        rollNo: 'ANI-2607-07-06-001',
        course: byCode.ANI,
        batch: batches[1],
        parentName: 'Meera Rao',
        parentPhone: '9876511102',
        total: 85000,
        paid: 25000,
      },
      {
        leadNo: 'LD-SEED-103',
        rollNo: 'GD-2607-07-12-001',
        course: byCode.GD,
        batch: batches[2],
        parentName: 'Ravi Singh',
        parentPhone: '9876511103',
        total: 38000,
        paid: 38000,
      },
    ];

    const admissionDate = new Date('2026-07-15');
    const students = [];

    for (let index = 0; index < convertedSpecs.length; index += 1) {
      const spec = convertedSpecs[index];
      const lead = leads.find((item) => item.leadNo === spec.leadNo);
      if (!lead) continue;

      const parts = spec.rollNo.split('-');
      const rollYear = 2026;
      const rollMonth = 7;
      const durationStartMonth = Number(parts[2]);
      const durationEndMonth = Number(parts[3]);
      const rollSeq = Number(parts[4]);

      await prisma.rollNumberCounter.upsert({
        where: {
          courseId_rollYear_rollMonth_durationStartMonth_durationEndMonth: {
            courseId: spec.course.id,
            rollYear,
            rollMonth,
            durationStartMonth,
            durationEndMonth,
          },
        },
        update: { lastSeq: Math.max(rollSeq, 1) },
        create: {
          courseId: spec.course.id,
          rollYear,
          rollMonth,
          durationStartMonth,
          durationEndMonth,
          lastSeq: rollSeq,
        },
      });

      const student = await prisma.student.upsert({
        where: { rollNo: spec.rollNo },
        update: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          email: lead.email,
          parentName: spec.parentName,
          parentPhone: spec.parentPhone,
          batchId: spec.batch.id,
          status: StudentStatus.active,
          leadId: lead.id,
        },
        create: {
          rollNo: spec.rollNo,
          rollCourseId: spec.course.id,
          rollYear,
          rollMonth,
          durationStartMonth,
          durationEndMonth,
          rollSeq,
          centreId: centre.id,
          courseId: spec.course.id,
          batchId: spec.batch.id,
          leadId: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          email: lead.email,
          parentName: spec.parentName,
          parentPhone: spec.parentPhone,
          address: 'Pune, Maharashtra',
          admissionDate,
          status: StudentStatus.active,
          createdById: director.id,
        },
      });
      students.push({ student, spec });

      await prisma.lead.updateMany({
        where: { convertedStudentId: student.id, NOT: { id: lead.id } },
        data: { convertedStudentId: null },
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: LeadStatus.converted,
          convertedStudentId: student.id,
          convertedAt: admissionDate,
        },
      });
    }

    for (const { student, spec } of students) {
      const existingPlan = await prisma.studentFee.findFirst({
        where: { studentId: student.id, status: 'active' },
        include: { installments: true, payments: true },
      });
      if (existingPlan) continue;

      const third = Math.round((spec.total / 3) * 100) / 100;
      const remainder = Math.round((spec.total - third * 2) * 100) / 100;
      const plan = await prisma.studentFee.create({
        data: {
          studentId: student.id,
          centreId: centre.id,
          totalAmount: money(spec.total),
          notes: 'Seeded fee plan',
          createdById: director.id,
          installments: {
            create: [
              {
                sequence: 1,
                label: 'Admission',
                amountDue: money(third),
                dueDate: new Date('2026-07-15'),
                status: spec.paid >= third ? 'paid' : spec.paid > 0 ? 'partial' : 'pending',
                amountPaid: money(Math.min(spec.paid, third)),
              },
              {
                sequence: 2,
                label: 'Installment 2',
                amountDue: money(third),
                dueDate: new Date('2026-08-15'),
                status: spec.paid >= third * 2 ? 'paid' : spec.paid > third ? 'partial' : 'pending',
                amountPaid: money(Math.max(0, Math.min(third, spec.paid - third))),
              },
              {
                sequence: 3,
                label: 'Installment 3',
                amountDue: money(remainder),
                dueDate: new Date('2026-09-15'),
                status: spec.paid >= spec.total ? 'paid' : 'pending',
                amountPaid: money(Math.max(0, spec.paid - third * 2)),
              },
            ],
          },
        },
        include: { installments: { orderBy: { sequence: 'asc' } } },
      });

      if (spec.paid <= 0) continue;

      const paidAt = new Date('2026-07-16T10:00:00.000Z');
      const yearMonth = 202607;
      const counter = await prisma.receiptCounter.upsert({
        where: {
          centreId_yearMonth: { centreId: centre.id, yearMonth },
        },
        update: { lastSeq: { increment: 1 } },
        create: { centreId: centre.id, yearMonth, lastSeq: 1 },
      });
      const seq = counter.lastSeq;
      const receiptNo = `RCP-PUNE-2607-${String(seq).padStart(6, '0')}`;
      const installment = plan.installments[0];

      await prisma.feePayment.create({
        data: {
          studentFeeId: plan.id,
          installmentId: installment.id,
          studentId: student.id,
          centreId: centre.id,
          amount: money(spec.paid),
          paymentMode: PaymentMode.upi,
          paidAt,
          transactionRef: `SEED-UPI-${spec.rollNo}`,
          collectedById: director.id,
          notes: 'Seeded payment',
          receipt: {
            create: {
              receiptNo,
              centreId: centre.id,
              studentId: student.id,
              studentName: [student.firstName, student.lastName].filter(Boolean).join(' '),
              rollNo: student.rollNo,
              centreCode: 'PUNE',
              amount: money(spec.paid),
              paymentMode: PaymentMode.upi,
              paidAt,
              issuedById: director.id,
            },
          },
        },
      });
    }

    await prisma.lead.updateMany({
      where: { status: LeadStatus.converted, convertedStudentId: null },
      data: { status: LeadStatus.interested },
    });

    const existingTask = await prisma.task.findFirst({
      where: { title: 'Follow up hot animation leads' },
    });
    if (!existingTask) {
      await prisma.task.create({
        data: {
          centreId: centre.id,
          title: 'Follow up hot animation leads',
          description: 'Call Sneha Iyer and confirm weekend batch visit.',
          assignedById: director.id,
          priority: TaskPriority.high,
          status: TaskStatus.in_progress,
          dueDate: daysFromNow(2),
          progressPercent: 40,
          assignees: { create: [{ userId: counsellor.id }] },
          subtasks: {
            create: [
              { title: 'Call the lead', sortOrder: 1, status: TaskStatus.completed, progressPercent: 100 },
              { title: 'Share fee structure', sortOrder: 2, status: TaskStatus.pending },
            ],
          },
          activities: {
            create: {
              userId: director.id,
              action: 'task_created',
              metadata: { seed: true },
            },
          },
        },
      });
      await prisma.task.create({
        data: {
          centreId: centre.id,
          title: 'Prepare July receipt summary',
          description: 'Review seeded receipts and outstanding installments.',
          assignedById: director.id,
          priority: TaskPriority.medium,
          status: TaskStatus.pending,
          dueDate: daysFromNow(5),
          assignees: { create: [{ userId: faculty.id }] },
        },
      });
    }

    const [leadCount, studentCount, planCount, paymentCount, receiptCount, taskCount] =
      await Promise.all([
        prisma.lead.count(),
        prisma.student.count(),
        prisma.studentFee.count(),
        prisma.feePayment.count(),
        prisma.receipt.count(),
        prisma.task.count(),
      ]);

    console.log(
      JSON.stringify(
        {
          centre: centre.code,
          courses: courses.map((course) => course.code),
          batches: batches.map((batch) => batch.name),
          counts: {
            leads: leadCount,
            students: studentCount,
            feePlans: planCount,
            payments: paymentCount,
            receipts: receiptCount,
            tasks: taskCount,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
