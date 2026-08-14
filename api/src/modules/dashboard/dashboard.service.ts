import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  FeePlanStatus,
  InstallmentStatus,
  LeadStatus,
  PaymentStatus,
  StudentStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.types';

import { DashboardQueryDto } from './dto/dashboard-query.dto';

export interface DashboardOverview {
  range: { from: string; to: string; centreId: string | null };
  leads: {
    totalInRange: number;
    funnel: Array<{ status: LeadStatus; count: number }>;
    followUpsDue: number;
    conversionRatePercent: number;
  };
  conversions: {
    convertedInRange: number;
    byStaff: Array<{
      userId: string;
      name: string;
      email: string;
      convertedCount: number;
    }>;
    byCourse: Array<{
      courseId: string;
      courseName: string;
      courseCode: string;
      convertedCount: number;
    }>;
  };
  students: {
    totalActive: number;
    admittedInRange: number;
  };
  fees: {
    collectedInRange: number;
    paymentsInRange: number;
    activePlans: number;
    outstandingInstallments: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    actor: AuthUser,
    query: DashboardQueryDto,
  ): Promise<DashboardOverview> {
    const centreId = this.resolveCentreScope(actor, query.centreId);
    const { from, to } = this.resolveRange(query);

    const centreFilter = centreId ? { centreId } : {};

    const [
      funnelRaw,
      totalInRange,
      followUpsDue,
      convertedInRange,
      convertedLeads,
      totalActiveStudents,
      admittedInRange,
      paymentAgg,
      activePlans,
      outstandingInstallments,
    ] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: centreFilter,
        _count: { _all: true },
      }),
      this.prisma.lead.count({
        where: { ...centreFilter, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.lead.count({
        where: {
          ...centreFilter,
          status: { notIn: [LeadStatus.converted, LeadStatus.lost] },
          nextFollowUpAt: { lte: to },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...centreFilter,
          status: LeadStatus.converted,
          convertedAt: { gte: from, lte: to },
        },
      }),
      this.prisma.lead.findMany({
        where: {
          ...centreFilter,
          status: LeadStatus.converted,
          convertedAt: { gte: from, lte: to },
        },
        select: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          courseInterest: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      this.prisma.student.count({
        where: { ...centreFilter, status: StudentStatus.active },
      }),
      this.prisma.student.count({
        where: { ...centreFilter, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.feePayment.aggregate({
        where: {
          ...centreFilter,
          status: PaymentStatus.recorded,
          paidAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.studentFee.count({
        where: { ...centreFilter, status: FeePlanStatus.active },
      }),
      this.prisma.feeInstallment.count({
        where: {
          status: {
            in: [
              InstallmentStatus.pending,
              InstallmentStatus.partial,
              InstallmentStatus.overdue,
            ],
          },
          studentFee: {
            ...centreFilter,
            status: FeePlanStatus.active,
          },
        },
      }),
    ]);

    const conversionRatePercent =
      totalInRange === 0
        ? 0
        : Number(((convertedInRange / totalInRange) * 100).toFixed(2));

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        centreId,
      },
      leads: {
        totalInRange,
        funnel: this.normalizeFunnel(funnelRaw),
        followUpsDue,
        conversionRatePercent,
      },
      conversions: {
        convertedInRange,
        byStaff: this.aggregateByStaff(convertedLeads),
        byCourse: this.aggregateByCourse(convertedLeads),
      },
      students: {
        totalActive: totalActiveStudents,
        admittedInRange,
      },
      fees: {
        collectedInRange: Number(paymentAgg._sum.amount ?? 0),
        paymentsInRange: paymentAgg._count._all,
        activePlans,
        outstandingInstallments,
      },
    };
  }

  async getLive(actor: AuthUser, query: DashboardQueryDto) {
    const overview = await this.getOverview(actor, query);
    const centreId = overview.range.centreId;
    const centreFilter = centreId ? { centreId } : {};
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalLeads,
      todayLeadCount,
      todayLeadRows,
      hotLeadCount,
      hotLeadRows,
      followUpRows,
      recentStudents,
      recentPayments,
      allTimeRevenue,
    ] = await Promise.all([
      this.prisma.lead.count({ where: centreFilter }),
      this.prisma.lead.count({
        where: { ...centreFilter, createdAt: { gte: startOfToday } },
      }),
      this.prisma.lead.findMany({
        where: { ...centreFilter, createdAt: { gte: startOfToday } },
        include: {
          courseInterest: { select: { name: true, code: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.lead.count({
        where: { ...centreFilter, status: LeadStatus.interested },
      }),
      this.prisma.lead.findMany({
        where: { ...centreFilter, status: LeadStatus.interested },
        include: {
          courseInterest: { select: { name: true, code: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.lead.findMany({
        where: {
          ...centreFilter,
          status: { notIn: [LeadStatus.converted, LeadStatus.lost] },
          nextFollowUpAt: { lte: new Date() },
        },
        include: {
          courseInterest: { select: { name: true, code: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
        },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 12,
      }),
      this.prisma.student.findMany({
        where: centreFilter,
        include: { course: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.feePayment.findMany({
        where: { ...centreFilter, status: PaymentStatus.recorded },
        include: {
          student: { select: { firstName: true, lastName: true, rollNo: true } },
          receipt: { select: { receiptNo: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: 8,
      }),
      this.prisma.feePayment.aggregate({
        where: { ...centreFilter, status: PaymentStatus.recorded },
        _sum: { amount: true },
      }),
    ]);

    const mapLead = (lead: (typeof todayLeadRows)[number]) => ({
      id: lead.id,
      leadNo: lead.leadNo,
      leadName: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
      contact: lead.phone,
      emailId: lead.email,
      status: lead.status,
      source: lead.source,
      course: lead.courseInterest?.name ?? lead.courseInterest?.code ?? '',
      counselorName: lead.assignedTo
        ? [lead.assignedTo.firstName, lead.assignedTo.lastName].filter(Boolean).join(' ')
        : '',
      createdAt: lead.createdAt.toISOString(),
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    });

    return {
      generatedAt: new Date().toISOString(),
      overview,
      snapshot: {
        totalLeads,
        totalStudents: overview.students.totalActive,
        totalRevenue: Number(allTimeRevenue._sum.amount ?? 0),
        conversionRate: overview.leads.conversionRatePercent,
        todayLeads: todayLeadCount,
        pendingFollowUps: overview.leads.followUpsDue,
        hotLeads: hotLeadCount,
        recentConversions: overview.conversions.convertedInRange,
        collectedInRange: overview.fees.collectedInRange,
        outstandingInstallments: overview.fees.outstandingInstallments,
      },
      todayLeads: todayLeadRows.map(mapLead),
      hotLeads: hotLeadRows.map(mapLead),
      followUpsDue: followUpRows.map(mapLead),
      recentStudents: recentStudents.map((student) => ({
        id: student.id,
        name: [student.firstName, student.lastName].filter(Boolean).join(' '),
        rollNo: student.rollNo,
        course: student.course.name,
        admissionDate: student.admissionDate.toISOString(),
        status: student.status,
      })),
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paidAt: payment.paidAt.toISOString(),
        studentName: [payment.student.firstName, payment.student.lastName]
          .filter(Boolean)
          .join(' '),
        rollNo: payment.student.rollNo,
        receiptNo: payment.receipt?.receiptNo ?? null,
      })),
    };
  }

  private resolveCentreScope(
    actor: AuthUser,
    requested?: string,
  ): string | null {
    if (actor.isDirector) {
      return requested ?? null;
    }
    if (!actor.centreId) {
      throw new ForbiddenException('Your account has no centre assigned');
    }
    if (requested && requested !== actor.centreId) {
      throw new ForbiddenException('Cannot view another centre dashboard');
    }
    return actor.centreId;
  }

  private resolveRange(query: DashboardQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from/to must be valid ISO datetimes');
    }
    if (from > to) {
      throw new BadRequestException('from must be before to');
    }

    return { from, to };
  }

  private normalizeFunnel(
    rows: Array<{ status: LeadStatus; _count: { _all: number } }>,
  ): Array<{ status: LeadStatus; count: number }> {
    const counts = new Map(rows.map((row) => [row.status, row._count._all]));
    return Object.values(LeadStatus).map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    }));
  }

  private aggregateByStaff(
    leads: Array<{
      assignedTo: {
        id: string;
        firstName: string;
        lastName: string | null;
        email: string;
      } | null;
    }>,
  ) {
    const map = new Map<
      string,
      { userId: string; name: string; email: string; convertedCount: number }
    >();

    for (const lead of leads) {
      if (!lead.assignedTo) continue;
      const key = lead.assignedTo.id;
      const existing = map.get(key);
      if (existing) {
        existing.convertedCount += 1;
      } else {
        map.set(key, {
          userId: lead.assignedTo.id,
          name: [lead.assignedTo.firstName, lead.assignedTo.lastName]
            .filter(Boolean)
            .join(' '),
          email: lead.assignedTo.email,
          convertedCount: 1,
        });
      }
    }

    return [...map.values()].sort(
      (a, b) => b.convertedCount - a.convertedCount,
    );
  }

  private aggregateByCourse(
    leads: Array<{
      courseInterest: { id: string; name: string; code: string } | null;
    }>,
  ) {
    const map = new Map<
      string,
      {
        courseId: string;
        courseName: string;
        courseCode: string;
        convertedCount: number;
      }
    >();

    for (const lead of leads) {
      if (!lead.courseInterest) continue;
      const key = lead.courseInterest.id;
      const existing = map.get(key);
      if (existing) {
        existing.convertedCount += 1;
      } else {
        map.set(key, {
          courseId: lead.courseInterest.id,
          courseName: lead.courseInterest.name,
          courseCode: lead.courseInterest.code,
          convertedCount: 1,
        });
      }
    }

    return [...map.values()].sort(
      (a, b) => b.convertedCount - a.convertedCount,
    );
  }
}
