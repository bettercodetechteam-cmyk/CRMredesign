import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import {
  CreateCourseDto,
  ListCoursesQueryDto,
  UpdateCourseDto,
} from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto) {
    try {
      return await this.prisma.course.create({
        data: {
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          rollPrefix: dto.rollPrefix.trim().toUpperCase(),
          durationMonths: dto.durationMonths,
          description: dto.description?.trim() || null,
          fees: dto.fees === undefined ? null : new Prisma.Decimal(dto.fees),
          category: dto.category?.trim() || null,
          isActive: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Course code already exists');
      }
      throw error;
    }
  }

  async findAll(query: ListCoursesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.CourseWhereInput = {};

    if (query.activeOnly !== false) {
      where.isActive = true;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { rollPrefix: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy: [{ name: 'asc' }],
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

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.findOne(id);

    const data: Prisma.CourseUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.rollPrefix !== undefined) {
      data.rollPrefix = dto.rollPrefix.trim().toUpperCase();
    }
    if (dto.durationMonths !== undefined) data.durationMonths = dto.durationMonths;
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.fees !== undefined) {
      data.fees = dto.fees === null ? null : new Prisma.Decimal(dto.fees);
    }
    if (dto.category !== undefined) {
      data.category = dto.category?.trim() || null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.course.update({ where: { id }, data });
  }
}
