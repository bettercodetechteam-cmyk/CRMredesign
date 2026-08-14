import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Lead,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { AuthUser } from '../auth/auth-user.types';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { ChangeLeadStatusDto, UpdateLeadDto } from './dto/update-lead.dto';

const leadInclude = {
  centre: { select: { id: true, code: true, name: true } },
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  },
  courseInterest: {
    select: { id: true, name: true, code: true, rollPrefix: true, durationMonths: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.LeadInclude;

export type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

export interface PaginatedLeads {
  items: LeadWithRelations[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthUser, dto: CreateLeadDto): Promise<LeadWithRelations> {
    const centreId = this.resolveWriteCentreId(actor, dto.centreId);
    const centre = await this.prisma.centre.findFirst({
      where: { id: centreId, isActive: true },
    });
    if (!centre) {
      throw new BadRequestException('Centre not found or inactive');
    }

    if (dto.assignedToId) {
      await this.assertUserInCentre(dto.assignedToId, centreId);
    }

    if (dto.courseInterestId) {
      await this.assertCourseExists(dto.courseInterestId);
    }

    const initialStatus = dto.status ?? LeadStatus.new;
    if (initialStatus === LeadStatus.converted) {
      throw new BadRequestException(
        'Cannot create a lead as converted. Use the convert flow after the lead exists.',
      );
    }
    if (initialStatus === LeadStatus.lost) {
      throw new BadRequestException('Cannot create a lead as lost');
    }

    const leadNo = await this.generateLeadNo(centre.code);
    const nextFollowUpAt = this.parseOptionalDate(dto.nextFollowUpAt, 'nextFollowUpAt');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            leadNo,
            centreId,
            assignedToId: dto.assignedToId ?? actor.id,
            status: initialStatus,
            source: dto.source,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName?.trim() || null,
            phone: dto.phone,
            email: dto.email?.trim().toLowerCase() || null,
            courseInterestId: dto.courseInterestId ?? null,
            notes: dto.notes?.trim() || null,
            nextFollowUpAt,
            createdById: actor.id,
          },
          include: leadInclude,
        });

        await tx.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            fromStatus: null,
            toStatus: initialStatus,
            changedById: actor.id,
            note: 'Lead created',
          },
        });

        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            actorId: actor.id,
            activityType: 'system',
            summary: 'Lead created',
          },
        });

        return lead;
      });
    } catch (error) {
      this.rethrowPrisma(error);
    }
  }

  async findAll(actor: AuthUser, query: ListLeadsQueryDto): Promise<PaginatedLeads> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildListWhere(actor, query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: [{ updatedAt: 'desc' }],
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

  async findOne(actor: AuthUser, id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        ...leadInclude,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 20,
          include: {
            changedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            actor: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    this.assertCanAccessCentre(actor, lead.centreId);
    return lead;
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateLeadDto,
  ): Promise<LeadWithRelations> {
    const existing = await this.requireLeadForActor(actor, id);

    if (dto.version !== undefined && dto.version !== existing.version) {
      throw new ConflictException(
        'Lead was updated by someone else. Refresh and try again.',
      );
    }

    if (dto.centreId && dto.centreId !== existing.centreId) {
      if (!actor.isDirector) {
        throw new ForbiddenException('Only directors can move a lead to another centre');
      }
    }

    const centreId = dto.centreId ?? existing.centreId;
    if (dto.assignedToId) {
      await this.assertUserInCentre(dto.assignedToId, centreId);
    }
    if (dto.courseInterestId) {
      await this.assertCourseExists(dto.courseInterestId);
    }

    const data: Prisma.LeadUpdateInput = {
      version: { increment: 1 },
    };

    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName?.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.lostReason !== undefined) data.lostReason = dto.lostReason.trim();
    if (dto.nextFollowUpAt !== undefined) {
      data.nextFollowUpAt = this.parseOptionalDate(dto.nextFollowUpAt, 'nextFollowUpAt');
    }
    if (dto.centreId !== undefined) {
      data.centre = { connect: { id: dto.centreId } };
    }
    if (dto.assignedToId !== undefined) {
      data.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }
    if (dto.courseInterestId !== undefined) {
      data.courseInterest = dto.courseInterestId
        ? { connect: { id: dto.courseInterestId } }
        : { disconnect: true };
    }

    try {
      const updated = await this.prisma.lead.update({
        where: { id },
        data,
        include: leadInclude,
      });

      await this.prisma.leadActivity.create({
        data: {
          leadId: id,
          actorId: actor.id,
          activityType: 'update',
          summary: 'Lead details updated',
        },
      });

      return updated;
    } catch (error) {
      this.rethrowPrisma(error);
    }
  }

  async remove(actor: AuthUser, id: string): Promise<{ success: boolean; id: string }> {
    const existing = await this.requireLeadForActor(actor, id);

    if (existing.status === LeadStatus.converted || existing.convertedStudentId) {
      throw new BadRequestException(
        'Cannot delete a converted lead. Remove or archive the student record instead.',
      );
    }

    await this.prisma.lead.delete({ where: { id } });
    return { success: true, id };
  }

  async changeStatus(
    actor: AuthUser,
    id: string,
    dto: ChangeLeadStatusDto,
  ): Promise<LeadWithRelations> {
    const existing = await this.requireLeadForActor(actor, id);

    if (dto.status === existing.status) {
      return this.prisma.lead.findUniqueOrThrow({
        where: { id },
        include: leadInclude,
      });
    }

    if (dto.status === LeadStatus.converted) {
      throw new BadRequestException(
        'Use the convert-to-student endpoint to mark a lead as converted (Phase 4).',
      );
    }

    if (dto.status === LeadStatus.lost && !dto.lostReason?.trim()) {
      throw new BadRequestException('lostReason is required when status is lost');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          status: dto.status,
          lostReason:
            dto.status === LeadStatus.lost ? dto.lostReason!.trim() : null,
          lastContactAt: new Date(),
          version: { increment: 1 },
        },
        include: leadInclude,
      });

      await tx.leadStatusHistory.create({
        data: {
          leadId: id,
          fromStatus: existing.status,
          toStatus: dto.status,
          changedById: actor.id,
          note: dto.note?.trim() || null,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          actorId: actor.id,
          activityType: 'status_change',
          summary: `Status ${existing.status} → ${dto.status}`,
          details: dto.note?.trim() || dto.lostReason?.trim() || null,
        },
      });

      return updated;
    });
  }

  async addActivity(
    actor: AuthUser,
    id: string,
    dto: CreateLeadActivityDto,
  ) {
    await this.requireLeadForActor(actor, id);

    const [activity] = await this.prisma.$transaction([
      this.prisma.leadActivity.create({
        data: {
          leadId: id,
          actorId: actor.id,
          activityType: dto.activityType.trim().toLowerCase(),
          summary: dto.summary.trim(),
          details: dto.details?.trim() || null,
        },
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.lead.update({
        where: { id },
        data: {
          lastContactAt: new Date(),
          version: { increment: 1 },
        },
      }),
    ]);

    return activity;
  }

  // --- scoping & helpers -------------------------------------------------

  private buildListWhere(
    actor: AuthUser,
    query: ListLeadsQueryDto,
  ): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};

    if (actor.isDirector) {
      if (query.centreId) {
        where.centreId = query.centreId;
      }
    } else {
      if (!actor.centreId) {
        throw new ForbiddenException('Your account has no centre assigned');
      }
      if (query.centreId && query.centreId !== actor.centreId) {
        throw new ForbiddenException('Cannot query leads outside your centre');
      }
      where.centreId = actor.centreId;
    }

    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.courseInterestId) where.courseInterestId = query.courseInterestId;

    if (query.mineOnly) {
      where.assignedToId = actor.id;
    } else if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }

    if (query.followUpBefore) {
      where.nextFollowUpAt = {
        lte: this.parseRequiredDate(query.followUpBefore, 'followUpBefore'),
      };
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) {
        where.createdAt.gte = this.parseRequiredDate(query.createdFrom, 'createdFrom');
      }
      if (query.createdTo) {
        where.createdAt.lte = this.parseRequiredDate(query.createdTo, 'createdTo');
      }
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { leadNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private resolveWriteCentreId(actor: AuthUser, requested?: string): string {
    if (actor.isDirector) {
      const centreId = requested ?? actor.centreId;
      if (!centreId) {
        throw new BadRequestException('centreId is required');
      }
      return centreId;
    }

    if (!actor.centreId) {
      throw new ForbiddenException('Your account has no centre assigned');
    }
    if (requested && requested !== actor.centreId) {
      throw new ForbiddenException('Cannot create leads for another centre');
    }
    return actor.centreId;
  }

  private assertCanAccessCentre(actor: AuthUser, centreId: string): void {
    if (actor.isDirector) return;
    if (!actor.centreId || actor.centreId !== centreId) {
      throw new ForbiddenException('Lead is outside your centre');
    }
  }

  private async requireLeadForActor(actor: AuthUser, id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    this.assertCanAccessCentre(actor, lead.centreId);
    return lead;
  }

  private async assertUserInCentre(userId: string, centreId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, approved: true },
    });
    if (!user) {
      throw new BadRequestException('Assignee not found or not active');
    }
    if (user.centreId && user.centreId !== centreId && user.role !== 'director') {
      throw new BadRequestException('Assignee does not belong to this centre');
    }
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, isActive: true },
    });
    if (!course) {
      throw new BadRequestException('Course not found or inactive');
    }
  }

  private async generateLeadNo(centreCode: string): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `LD-${centreCode.toUpperCase()}-${yy}${mm}-`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = randomBytes(2).toString('hex').toUpperCase();
      const leadNo = `${prefix}${suffix}`;
      const exists = await this.prisma.lead.findUnique({ where: { leadNo } });
      if (!exists) return leadNo;
    }

    throw new ConflictException('Could not allocate a unique lead number');
  }

  private parseOptionalDate(value: string | undefined, field: string): Date | null {
    if (value === undefined || value === null || value === '') return null;
    return this.parseRequiredDate(value, field);
  }

  private parseRequiredDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date`);
    }
    return date;
  }

  private rethrowPrisma(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const targetStr = (
        Array.isArray(target) ? target.join(' ') : String(target ?? '')
      ).toLowerCase();
      if (targetStr.includes('phone') || targetStr.includes('centre_id')) {
        throw new ConflictException(
          'A lead with this phone number already exists for this centre',
        );
      }
      if (targetStr.includes('lead_no')) {
        throw new ConflictException('Could not allocate a unique lead number. Please try again.');
      }
      throw new ConflictException(
        'This lead conflicts with an existing record. Check the phone number and try again.',
      );
    }
    throw error;
  }
}
