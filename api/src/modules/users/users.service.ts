import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.types';

import {
  ApproveUserDto,
  ListUsersQueryDto,
  UpdateUserAccessDto,
} from './dto/user-access.dto';

const DIRECTOR_EMAILS = new Set([
  'cmzicazima@gmail.com',
  'gauravkarewar724@gmail.com',
  'director@zica.edu',
]);

const ASSIGNABLE_ROLES = new Set<UserRole>([
  UserRole.centre_head,
  UserRole.bdm,
  UserRole.marketing,
  UserRole.digital_marketing,
  UserRole.faculty,
  UserRole.academic_head,
  UserRole.accounting,
  UserRole.designer,
  UserRole.employee,
  UserRole.admin,
  UserRole.accountant,
  UserRole.director,
]);

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListUsersQueryDto) {
    this.assertDirector(actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const where: Prisma.UserWhereInput = {};

    if (query.approved !== undefined) where.approved = query.approved;
    if (query.role) where.role = query.role;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { centre: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    return {
      items: items.map((user) => this.toStaffDto(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listAssignees(actor: AuthUser) {
    const where: Prisma.UserWhereInput = {
      approved: true,
      isActive: true,
      role: { not: UserRole.pending },
    };
    if (!actor.isDirector && actor.centreId) {
      where.centreId = actor.centreId;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        centreId: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      centreId: user.centreId,
    }));
  }

  async updateAccess(actor: AuthUser, id: string, dto: UpdateUserAccessDto) {
    this.assertDirector(actor);
    const target = await this.requireUser(id);
    const email = target.email.toLowerCase();

    if (dto.role !== undefined) {
      if (DIRECTOR_EMAILS.has(email) && dto.role !== UserRole.director) {
        throw new ForbiddenException('Cannot demote a protected director account');
      }
      if (target.id === actor.id && dto.role !== UserRole.director) {
        throw new ForbiddenException('Directors cannot remove their own director role');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.permissionsGranted !== undefined
          ? { permissionsGranted: dto.permissionsGranted }
          : {}),
        ...(dto.permissionsRevoked !== undefined
          ? { permissionsRevoked: dto.permissionsRevoked }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { centre: { select: { id: true, code: true, name: true } } },
    });

    return this.toStaffDto(updated);
  }

  async approve(actor: AuthUser, id: string, dto: ApproveUserDto) {
    this.assertDirector(actor);
    if (!ASSIGNABLE_ROLES.has(dto.role) || dto.role === UserRole.pending) {
      throw new BadRequestException('A valid role is required to approve a user');
    }

    const target = await this.requireUser(id);
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        approved: true,
        isActive: true,
        role: dto.role,
        permissionsGranted: [],
        permissionsRevoked: [],
      },
      include: { centre: { select: { id: true, code: true, name: true } } },
    });

    return this.toStaffDto(updated);
  }

  async reject(actor: AuthUser, id: string) {
    this.assertDirector(actor);
    const target = await this.requireUser(id);
    if (target.id === actor.id) {
      throw new ForbiddenException('You cannot reject your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        approved: false,
        isActive: false,
        role: UserRole.pending,
      },
      include: { centre: { select: { id: true, code: true, name: true } } },
    });

    return this.toStaffDto(updated);
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private assertDirector(actor: AuthUser) {
    if (!actor.isDirector) {
      throw new ForbiddenException('Only directors can manage user access');
    }
  }

  private toStaffDto(user: {
    id: string;
    firebaseUid: string;
    email: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    role: UserRole;
    centreId: string | null;
    approved: boolean;
    isActive: boolean;
    permissionsGranted: string[];
    permissionsRevoked: string[];
    createdAt: Date;
    updatedAt: Date;
    centre?: { id: string; code: string; name: string } | null;
  }) {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      centreId: user.centreId,
      centre: user.centre ?? null,
      approved: user.approved,
      isActive: user.isActive,
      permissionsGranted: user.permissionsGranted ?? [],
      permissionsRevoked: user.permissionsRevoked ?? [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
