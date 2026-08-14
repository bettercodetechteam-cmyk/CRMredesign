import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.types';

@Injectable()
export class CrmRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async listFeeRecords(actor: AuthUser, centreId?: string) {
    const resolvedCentreId = this.resolveCentreId(actor, centreId);
    const rows = await this.prisma.crmFeeRecord.findMany({
      where: { centreId: resolvedCentreId },
      orderBy: [{ srNo: 'asc' }, { updatedAt: 'desc' }],
    });
    return rows.map((row) => this.mergeFeeRow(row));
  }

  async getFeeRecord(actor: AuthUser, id: string) {
    const row = await this.requireFeeRecord(actor, id);
    return this.mergeFeeRow(row);
  }

  async createFeeRecord(actor: AuthUser, payload: Record<string, unknown>) {
    const centreId = this.resolveCentreId(
      actor,
      String(payload.centreId ?? actor.centreId ?? ''),
    );
    const data = this.stripSystemFields(payload);
    const studentId = payload.studentId ? String(payload.studentId) : null;
    const contactNumber = payload.contactNumber
      ? String(payload.contactNumber).replace(/\D/g, '').slice(-10)
      : null;
    const srNo =
      payload.srNo !== undefined && payload.srNo !== null
        ? Number(payload.srNo)
        : null;

    const row = await this.prisma.crmFeeRecord.create({
      data: {
        centreId,
        studentId,
        contactNumber,
        srNo: Number.isFinite(srNo) ? srNo : null,
        data: data as Prisma.InputJsonValue,
      },
    });
    return this.mergeFeeRow(row);
  }

  async updateFeeRecord(
    actor: AuthUser,
    id: string,
    payload: Record<string, unknown>,
  ) {
    const existing = await this.requireFeeRecord(actor, id);
    const merged = {
      ...(existing.data as Record<string, unknown>),
      ...this.stripSystemFields(payload),
      updatedAt: new Date().toISOString(),
    };

    const row = await this.prisma.crmFeeRecord.update({
      where: { id },
      data: {
        studentId: payload.studentId
          ? String(payload.studentId)
          : existing.studentId,
        contactNumber: payload.contactNumber
          ? String(payload.contactNumber).replace(/\D/g, '').slice(-10)
          : existing.contactNumber,
        srNo:
          payload.srNo !== undefined
            ? Number(payload.srNo)
            : existing.srNo,
        data: merged as Prisma.InputJsonValue,
      },
    });
    return this.mergeFeeRow(row);
  }

  async deleteFeeRecord(actor: AuthUser, id: string) {
    await this.requireFeeRecord(actor, id);
    await this.prisma.crmFeeRecord.delete({ where: { id } });
    return { id, deleted: true };
  }

  async listGstRecords(actor: AuthUser, centreId?: string) {
    const resolvedCentreId = this.resolveCentreId(actor, centreId);
    const rows = await this.prisma.crmGstRecord.findMany({
      where: { centreId: resolvedCentreId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.mergeGstRow(row));
  }

  async createGstRecord(actor: AuthUser, payload: Record<string, unknown>) {
    const centreId = this.resolveCentreId(
      actor,
      String(payload.centreId ?? actor.centreId ?? ''),
    );
    const data = this.stripSystemFields(payload);
    const studentId = payload.studentId ? String(payload.studentId) : null;

    const row = await this.prisma.crmGstRecord.create({
      data: {
        centreId,
        studentId,
        data: data as Prisma.InputJsonValue,
      },
    });
    return this.mergeGstRow(row);
  }

  async updateGstRecord(
    actor: AuthUser,
    id: string,
    payload: Record<string, unknown>,
  ) {
    const existing = await this.requireGstRecord(actor, id);
    const merged = {
      ...(existing.data as Record<string, unknown>),
      ...this.stripSystemFields(payload),
      updatedAt: new Date().toISOString(),
    };

    const row = await this.prisma.crmGstRecord.update({
      where: { id },
      data: {
        studentId: payload.studentId
          ? String(payload.studentId)
          : existing.studentId,
        data: merged as Prisma.InputJsonValue,
      },
    });
    return this.mergeGstRow(row);
  }

  async deleteGstRecord(actor: AuthUser, id: string) {
    await this.requireGstRecord(actor, id);
    await this.prisma.crmGstRecord.delete({ where: { id } });
    return { id, deleted: true };
  }

  async listCustomCourses(actor: AuthUser, centreId?: string) {
    const resolvedCentreId = this.resolveCentreId(actor, centreId);
    return this.prisma.crmCustomCourse.findMany({
      where: {
        OR: [{ centreId: resolvedCentreId }, { centreId: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCustomCourse(
    actor: AuthUser,
    courseName: string,
    centreId?: string,
  ) {
    const resolvedCentreId = this.resolveCentreId(
      actor,
      centreId ?? actor.centreId ?? '',
    );
    const name = courseName.trim();
    if (!name) {
      throw new BadRequestException('courseName is required');
    }
    return this.prisma.crmCustomCourse.create({
      data: { courseName: name, centreId: resolvedCentreId },
    });
  }

  private mergeFeeRow(row: {
    id: string;
    centreId: string;
    studentId: string | null;
    srNo: number | null;
    contactNumber: string | null;
    data: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      ...data,
      id: row.id,
      centreId: row.centreId,
      studentId: row.studentId ?? data.studentId,
      srNo: row.srNo ?? data.srNo,
      contactNumber: row.contactNumber ?? data.contactNumber,
      createdAt: data.createdAt ?? row.createdAt,
      updatedAt: data.updatedAt ?? row.updatedAt,
    };
  }

  private mergeGstRow(row: {
    id: string;
    centreId: string;
    studentId: string | null;
    data: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      ...data,
      id: row.id,
      centreId: row.centreId,
      studentId: row.studentId ?? data.studentId,
      createdAt: data.createdAt ?? row.createdAt,
      updatedAt: data.updatedAt ?? row.updatedAt,
    };
  }

  private stripSystemFields(payload: Record<string, unknown>) {
    const { id: _id, ...rest } = payload;
    return rest;
  }

  private async requireFeeRecord(actor: AuthUser, id: string) {
    const row = await this.prisma.crmFeeRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Fee record not found');
    this.assertCanAccessCentre(actor, row.centreId);
    return row;
  }

  private async requireGstRecord(actor: AuthUser, id: string) {
    const row = await this.prisma.crmGstRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('GST record not found');
    this.assertCanAccessCentre(actor, row.centreId);
    return row;
  }

  private resolveCentreId(actor: AuthUser, centreId?: string): string {
    if (actor.isDirector) {
      if (centreId && /^[0-9a-f-]{36}$/i.test(centreId)) return centreId;
      if (actor.centreId) return actor.centreId;
      throw new BadRequestException('centreId is required');
    }
    if (!actor.centreId) {
      throw new ForbiddenException('Your account has no centre assigned');
    }
    if (centreId && centreId !== actor.centreId) {
      throw new ForbiddenException('Cannot access records outside your centre');
    }
    return actor.centreId;
  }

  private assertCanAccessCentre(actor: AuthUser, centreId: string): void {
    if (actor.isDirector) return;
    if (!actor.centreId || actor.centreId !== centreId) {
      throw new ForbiddenException('Record is outside your centre');
    }
  }
}
