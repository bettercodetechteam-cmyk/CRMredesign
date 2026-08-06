import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma, StudentStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.types';

import { ConvertLeadDto } from './dto/convert-lead.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import {
  AssignBatchDto,
  ChangeStudentStatusDto,
  UpdateStudentDto,
} from './dto/update-student.dto';
import { RollNumberService } from './roll-number.service';

const studentInclude = {
  centre: { select: { id: true, code: true, name: true } },
  course: {
    select: {
      id: true,
      name: true,
      code: true,
      rollPrefix: true,
      durationMonths: true,
    },
  },
  batch: { select: { id: true, name: true, status: true } },
  lead: { select: { id: true, leadNo: true, status: true } },
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.StudentInclude;

export type StudentWithRelations = Prisma.StudentGetPayload<{
  include: typeof studentInclude;
}>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rollNumbers: RollNumberService,
  ) {}

  /**
   * Atomic lead → student conversion:
   * allocate roll no → create student → mark lead converted → history/activity.
   */
  async convertFromLead(
    actor: AuthUser,
    leadId: string,
    dto: ConvertLeadDto,
  ): Promise<{ student: StudentWithRelations; leadId: string; rollNo: string }> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    this.assertCanAccessCentre(actor, lead.centreId);

    if (lead.status === LeadStatus.converted || lead.convertedStudentId) {
      throw new ConflictException('Lead is already converted');
    }
    if (lead.status === LeadStatus.lost) {
      throw new BadRequestException('Cannot convert a lost lead');
    }

    const existingStudent = await this.prisma.student.findUnique({
      where: { leadId },
    });
    if (existingStudent) {
      throw new ConflictException('A student already exists for this lead');
    }

    const courseId = dto.courseId ?? lead.courseInterestId;
    if (!courseId) {
      throw new BadRequestException(
        'courseId is required (lead has no courseInterestId)',
      );
    }

    const course = await this.prisma.course.findFirst({
      where: { id: courseId, isActive: true },
    });
    if (!course) {
      throw new BadRequestException('Course not found or inactive');
    }

    if (dto.batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: dto.batchId },
      });
      if (!batch) {
        throw new BadRequestException('Batch not found');
      }
      if (batch.centreId !== lead.centreId) {
        throw new BadRequestException('Batch belongs to a different centre');
      }
      if (batch.courseId !== courseId) {
        throw new BadRequestException('Batch does not match the selected course');
      }
    }

    const admissionDate = this.parseAdmissionDate(dto.admissionDate);
    const firstName = (dto.firstName ?? lead.firstName).trim();
    const lastName = (dto.lastName ?? lead.lastName)?.trim() || null;
    const phone = dto.phone ?? lead.phone;
    const email = (dto.email ?? lead.email)?.trim().toLowerCase() || null;

    if (firstName.length < 2) {
      throw new BadRequestException('firstName must be at least 2 characters');
    }
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      throw new BadRequestException('phone must be a valid 10-digit Indian mobile');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const roll = await this.rollNumbers.allocate(tx, {
          courseId: course.id,
          rollPrefix: course.rollPrefix,
          durationMonths: course.durationMonths,
          admissionDate,
        });

        const student = await tx.student.create({
          data: {
            rollNo: roll.rollNo,
            rollCourseId: course.id,
            rollYear: roll.rollYear,
            rollMonth: roll.rollMonth,
            durationStartMonth: roll.durationStartMonth,
            durationEndMonth: roll.durationEndMonth,
            rollSeq: roll.rollSeq,
            centreId: lead.centreId,
            courseId: course.id,
            batchId: dto.batchId ?? null,
            leadId: lead.id,
            firstName,
            lastName,
            phone,
            email,
            parentName: dto.parentName?.trim() || null,
            parentPhone: dto.parentPhone ?? null,
            address: dto.address?.trim() || null,
            admissionDate,
            status: StudentStatus.active,
            createdById: actor.id,
          },
          include: studentInclude,
        });

        await tx.lead.update({
          where: { id: lead.id },
          data: {
            status: LeadStatus.converted,
            convertedStudentId: student.id,
            convertedAt: new Date(),
            courseInterestId: lead.courseInterestId ?? course.id,
            version: { increment: 1 },
          },
        });

        await tx.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            fromStatus: lead.status,
            toStatus: LeadStatus.converted,
            changedById: actor.id,
            note: `Converted to student ${student.rollNo}`,
          },
        });

        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            actorId: actor.id,
            activityType: 'conversion',
            summary: `Converted to student ${student.rollNo}`,
            details: `Student id ${student.id}`,
          },
        });

        return student;
      });

      return {
        student: result,
        leadId: lead.id,
        rollNo: result.rollNo,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Could not convert lead due to a unique constraint conflict',
        );
      }
      throw error;
    }
  }

  async findAll(actor: AuthUser, query: ListStudentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildListWhere(actor, query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: [{ createdAt: 'desc' }],
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

  async findOne(actor: AuthUser, id: string): Promise<StudentWithRelations> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.assertCanAccessCentre(actor, student.centreId);
    return student;
  }

  async findByRollNo(
    actor: AuthUser,
    rollNo: string,
  ): Promise<StudentWithRelations> {
    const student = await this.prisma.student.findUnique({
      where: { rollNo: rollNo.trim().toUpperCase() },
      include: studentInclude,
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.assertCanAccessCentre(actor, student.centreId);
    return student;
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateStudentDto,
  ): Promise<StudentWithRelations> {
    await this.requireStudentForActor(actor, id);
    const data: Prisma.StudentUpdateInput = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName?.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) {
      data.email = dto.email?.trim().toLowerCase() || null;
    }
    if (dto.parentName !== undefined) {
      data.parentName = dto.parentName?.trim() || null;
    }
    if (dto.parentPhone !== undefined) {
      data.parentPhone = dto.parentPhone || null;
    }
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;

    return this.prisma.student.update({
      where: { id },
      data,
      include: studentInclude,
    });
  }

  async changeStatus(
    actor: AuthUser,
    id: string,
    dto: ChangeStudentStatusDto,
  ): Promise<StudentWithRelations> {
    await this.requireStudentForActor(actor, id);
    return this.prisma.student.update({
      where: { id },
      data: { status: dto.status },
      include: studentInclude,
    });
  }

  async assignBatch(
    actor: AuthUser,
    id: string,
    dto: AssignBatchDto,
  ): Promise<StudentWithRelations> {
    const student = await this.requireStudentForActor(actor, id);

    if (dto.batchId === null) {
      return this.prisma.student.update({
        where: { id },
        data: { batch: { disconnect: true } },
        include: studentInclude,
      });
    }

    const batch = await this.prisma.batch.findUnique({
      where: { id: dto.batchId },
    });
    if (!batch) {
      throw new BadRequestException('Batch not found');
    }
    if (batch.centreId !== student.centreId) {
      throw new BadRequestException('Batch belongs to a different centre');
    }
    if (batch.courseId !== student.courseId) {
      throw new BadRequestException('Batch does not match the student course');
    }

    if (batch.capacity > 0) {
      const enrolled = await this.prisma.student.count({
        where: {
          batchId: batch.id,
          status: StudentStatus.active,
          NOT: { id: student.id },
        },
      });
      if (enrolled >= batch.capacity) {
        throw new ConflictException('Batch is at full capacity');
      }
    }

    return this.prisma.student.update({
      where: { id },
      data: { batch: { connect: { id: batch.id } } },
      include: studentInclude,
    });
  }

  private async requireStudentForActor(actor: AuthUser, id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.assertCanAccessCentre(actor, student.centreId);
    return student;
  }

  private buildListWhere(
    actor: AuthUser,
    query: ListStudentsQueryDto,
  ): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};

    if (actor.isDirector) {
      if (query.centreId) where.centreId = query.centreId;
    } else {
      if (!actor.centreId) {
        throw new ForbiddenException('Your account has no centre assigned');
      }
      if (query.centreId && query.centreId !== actor.centreId) {
        throw new ForbiddenException('Cannot query students outside your centre');
      }
      where.centreId = actor.centreId;
    }

    if (query.courseId) where.courseId = query.courseId;
    if (query.batchId) where.batchId = query.batchId;
    if (query.status) where.status = query.status;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { rollNo: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private assertCanAccessCentre(actor: AuthUser, centreId: string): void {
    if (actor.isDirector) return;
    if (!actor.centreId || actor.centreId !== centreId) {
      throw new ForbiddenException('Record is outside your centre');
    }
  }

  private parseAdmissionDate(value?: string): Date {
    if (!value) {
      const now = new Date();
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) {
      throw new BadRequestException('admissionDate must be YYYY-MM-DD');
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
      throw new BadRequestException('admissionDate is not a valid calendar date');
    }

    return date;
  }
}
