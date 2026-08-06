import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeePlanStatus,
  InstallmentStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.types';

import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import {
  ListFeePlansQueryDto,
  ListReceiptsQueryDto,
} from './dto/list-fees-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ReceiptNumberService } from './receipt-number.service';

const planInclude = {
  student: {
    select: {
      id: true,
      rollNo: true,
      firstName: true,
      lastName: true,
      phone: true,
      centreId: true,
    },
  },
  centre: { select: { id: true, code: true, name: true } },
  installments: { orderBy: { sequence: 'asc' as const } },
  payments: {
    where: { status: PaymentStatus.recorded },
    orderBy: { paidAt: 'desc' as const },
    include: { receipt: true },
  },
} satisfies Prisma.StudentFeeInclude;

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptNumbers: ReceiptNumberService,
  ) {}

  async createPlan(actor: AuthUser, dto: CreateFeePlanDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.assertCanAccessCentre(actor, student.centreId);

    const installmentTotal = dto.installments.reduce(
      (sum, item) => sum + item.amountDue,
      0,
    );
    if (Math.abs(installmentTotal - dto.totalAmount) > 0.009) {
      throw new BadRequestException(
        `Installment amounts (${installmentTotal}) must equal totalAmount (${dto.totalAmount})`,
      );
    }

    const sequences = dto.installments.map((item) => item.sequence);
    if (new Set(sequences).size !== sequences.length) {
      throw new BadRequestException('Installment sequence numbers must be unique');
    }

    return this.prisma.studentFee.create({
      data: {
        studentId: student.id,
        centreId: student.centreId,
        totalAmount: money(dto.totalAmount),
        notes: dto.notes?.trim() || null,
        createdById: actor.id,
        status: FeePlanStatus.active,
        installments: {
          create: dto.installments.map((item) => ({
            sequence: item.sequence,
            label: item.label.trim(),
            amountDue: money(item.amountDue),
            dueDate: item.dueDate ? this.parseDate(item.dueDate, 'dueDate') : null,
            status: InstallmentStatus.pending,
          })),
        },
      },
      include: planInclude,
    });
  }

  async listPlans(actor: AuthUser, query: ListFeePlansQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.StudentFeeWhereInput = {};

    if (actor.isDirector) {
      if (query.centreId) where.centreId = query.centreId;
    } else {
      if (!actor.centreId) {
        throw new ForbiddenException('Your account has no centre assigned');
      }
      where.centreId = actor.centreId;
    }

    if (query.studentId) where.studentId = query.studentId;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.studentFee.count({ where }),
      this.prisma.studentFee.findMany({
        where,
        include: planInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getPlan(actor: AuthUser, id: string) {
    const plan = await this.prisma.studentFee.findUnique({
      where: { id },
      include: planInclude,
    });
    if (!plan) {
      throw new NotFoundException('Fee plan not found');
    }
    this.assertCanAccessCentre(actor, plan.centreId);
    return plan;
  }

  async recordPayment(actor: AuthUser, dto: RecordPaymentDto) {
    const plan = await this.prisma.studentFee.findUnique({
      where: { id: dto.studentFeeId },
      include: {
        student: true,
        centre: true,
        installments: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!plan) {
      throw new NotFoundException('Fee plan not found');
    }
    this.assertCanAccessCentre(actor, plan.centreId);

    if (plan.status === FeePlanStatus.cancelled) {
      throw new BadRequestException('Cannot record payment on a cancelled fee plan');
    }

    let installment = null as (typeof plan.installments)[number] | null;
    if (dto.installmentId) {
      installment =
        plan.installments.find((item) => item.id === dto.installmentId) ?? null;
      if (!installment) {
        throw new BadRequestException('Installment does not belong to this fee plan');
      }
    }

    const amount = money(dto.amount);
    if (installment) {
      const remaining = new Prisma.Decimal(installment.amountDue).minus(
        installment.amountPaid,
      );
      if (amount.greaterThan(remaining)) {
        throw new BadRequestException(
          `Payment exceeds installment remaining balance (${remaining.toFixed(2)})`,
        );
      }
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('paidAt must be a valid ISO datetime');
    }

    const studentName = [plan.student.firstName, plan.student.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.feePayment.create({
        data: {
          studentFeeId: plan.id,
          installmentId: installment?.id ?? null,
          studentId: plan.studentId,
          centreId: plan.centreId,
          amount,
          paymentMode: dto.paymentMode,
          paidAt,
          transactionRef: dto.transactionRef?.trim() || null,
          notes: dto.notes?.trim() || null,
          collectedById: actor.id,
          status: PaymentStatus.recorded,
        },
      });

      if (installment) {
        const nextPaid = new Prisma.Decimal(installment.amountPaid).plus(amount);
        const due = new Prisma.Decimal(installment.amountDue);
        let status: InstallmentStatus = InstallmentStatus.partial;
        if (nextPaid.greaterThanOrEqualTo(due)) {
          status = InstallmentStatus.paid;
        } else if (nextPaid.lessThanOrEqualTo(0)) {
          status = InstallmentStatus.pending;
        }

        await tx.feeInstallment.update({
          where: { id: installment.id },
          data: {
            amountPaid: nextPaid,
            status,
          },
        });
      }

      const allInstallments = await tx.feeInstallment.findMany({
        where: { studentFeeId: plan.id },
      });
      const allPaid = allInstallments.every(
        (item) => item.status === InstallmentStatus.paid || item.status === InstallmentStatus.waived,
      );
      if (allPaid) {
        await tx.studentFee.update({
          where: { id: plan.id },
          data: { status: FeePlanStatus.completed },
        });
      }

      const allocated = await this.receiptNumbers.allocate(tx, {
        centreId: plan.centreId,
        centreCode: plan.centre.code,
        paidAt,
      });

      const receipt = await tx.receipt.create({
        data: {
          receiptNo: allocated.receiptNo,
          paymentId: payment.id,
          centreId: plan.centreId,
          studentId: plan.studentId,
          studentName,
          rollNo: plan.student.rollNo,
          centreCode: plan.centre.code,
          amount,
          paymentMode: dto.paymentMode,
          paidAt,
          issuedById: actor.id,
        },
      });

      return {
        payment,
        receipt,
      };
    });
  }

  async listReceipts(actor: AuthUser, query: ListReceiptsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReceiptWhereInput = {};

    if (actor.isDirector) {
      if (query.centreId) where.centreId = query.centreId;
    } else {
      if (!actor.centreId) {
        throw new ForbiddenException('Your account has no centre assigned');
      }
      where.centreId = actor.centreId;
    }

    if (query.studentId) where.studentId = query.studentId;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.receipt.count({ where }),
      this.prisma.receipt.findMany({
        where,
        include: {
          payment: {
            select: {
              id: true,
              transactionRef: true,
              installmentId: true,
              status: true,
            },
          },
          student: {
            select: { id: true, rollNo: true, firstName: true, lastName: true },
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getReceipt(actor: AuthUser, id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: true,
        student: {
          select: { id: true, rollNo: true, firstName: true, lastName: true, phone: true },
        },
        centre: { select: { id: true, code: true, name: true } },
      },
    });
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    this.assertCanAccessCentre(actor, receipt.centreId);
    return receipt;
  }

  async getReceiptByNumber(actor: AuthUser, receiptNo: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { receiptNo: receiptNo.trim().toUpperCase() },
      include: {
        payment: true,
        student: {
          select: { id: true, rollNo: true, firstName: true, lastName: true, phone: true },
        },
        centre: { select: { id: true, code: true, name: true } },
      },
    });
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    this.assertCanAccessCentre(actor, receipt.centreId);
    return receipt;
  }

  private assertCanAccessCentre(actor: AuthUser, centreId: string): void {
    if (actor.isDirector) return;
    if (!actor.centreId || actor.centreId !== centreId) {
      throw new ForbiddenException('Record is outside your centre');
    }
  }

  private parseDate(value: string, field: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${field} is not a valid calendar date`);
    }
    return date;
  }
}
