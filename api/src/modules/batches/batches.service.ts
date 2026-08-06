import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.types';

import { CreateBatchDto, UpdateBatchDto } from './dto/create-batch.dto';
import { ListBatchesQueryDto } from './dto/list-batches-query.dto';

const batchInclude = {
  centre: { select: { id: true, code: true, name: true } },
  course: {
    select: { id: true, name: true, code: true, rollPrefix: true, durationMonths: true },
  },
  _count: { select: { students: true } },
} satisfies Prisma.BatchInclude;

export type BatchWithRelations = Prisma.BatchGetPayload<{
  include: typeof batchInclude;
}>;

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthUser, dto: CreateBatchDto): Promise<BatchWithRelations> {
    const centreId = this.resolveWriteCentreId(actor, dto.centreId);

    const centre = await this.prisma.centre.findFirst({
      where: { id: centreId, isActive: true },
    });
    if (!centre) {
      throw new BadRequestException('Centre not found or inactive');
    }

    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, isActive: true },
    });
    if (!course) {
      throw new BadRequestException('Course not found or inactive');
    }

    const startDate = this.parseOptionalDate(dto.startDate, 'startDate');
    const endDate = this.parseOptionalDate(dto.endDate, 'endDate');
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return this.prisma.batch.create({
      data: {
        name: dto.name.trim(),
        courseId: course.id,
        centreId,
        startDate,
        endDate,
        timings: dto.timings?.trim() || null,
        capacity: dto.capacity ?? 0,
        status: dto.status ?? BatchStatus.upcoming,
      },
      include: batchInclude,
    });
  }

  async findAll(actor: AuthUser, query: ListBatchesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildListWhere(actor, query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.batch.count({ where }),
      this.prisma.batch.findMany({
        where,
        include: batchInclude,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
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

  async findOne(actor: AuthUser, id: string): Promise<BatchWithRelations> {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: batchInclude,
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    this.assertCanAccessCentre(actor, batch.centreId);
    return batch;
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateBatchDto,
  ): Promise<BatchWithRelations> {
    const existing = await this.requireBatchForActor(actor, id);

    const startDate =
      dto.startDate === undefined
        ? undefined
        : this.parseOptionalDate(dto.startDate ?? undefined, 'startDate');
    const endDate =
      dto.endDate === undefined
        ? undefined
        : this.parseOptionalDate(dto.endDate ?? undefined, 'endDate');

    const nextStart = startDate === undefined ? existing.startDate : startDate;
    const nextEnd = endDate === undefined ? existing.endDate : endDate;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const data: Prisma.BatchUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.startDate !== undefined) data.startDate = startDate;
    if (dto.endDate !== undefined) data.endDate = endDate;
    if (dto.timings !== undefined) data.timings = dto.timings?.trim() || null;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.batch.update({
      where: { id },
      data,
      include: batchInclude,
    });
  }

  private buildListWhere(
    actor: AuthUser,
    query: ListBatchesQueryDto,
  ): Prisma.BatchWhereInput {
    const where: Prisma.BatchWhereInput = {};

    if (actor.isDirector) {
      if (query.centreId) where.centreId = query.centreId;
    } else {
      if (!actor.centreId) {
        throw new ForbiddenException('Your account has no centre assigned');
      }
      if (query.centreId && query.centreId !== actor.centreId) {
        throw new ForbiddenException('Cannot query batches outside your centre');
      }
      where.centreId = actor.centreId;
    }

    if (query.courseId) where.courseId = query.courseId;
    if (query.status) where.status = query.status;

    const search = query.search?.trim();
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
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
      throw new ForbiddenException('Cannot create batches for another centre');
    }
    return actor.centreId;
  }

  private assertCanAccessCentre(actor: AuthUser, centreId: string): void {
    if (actor.isDirector) return;
    if (!actor.centreId || actor.centreId !== centreId) {
      throw new ForbiddenException('Batch is outside your centre');
    }
  }

  private async requireBatchForActor(actor: AuthUser, id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    this.assertCanAccessCentre(actor, batch.centreId);
    return batch;
  }

  private parseOptionalDate(
    value: string | undefined,
    field: string,
  ): Date | null {
    if (value === undefined || value === null || value === '') return null;
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
