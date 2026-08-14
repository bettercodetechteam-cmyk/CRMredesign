import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.types';

import {
  CreateCommentDto,
  CreateSubtaskDto,
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateCommentDto,
  UpdateSubtaskDto,
  UpdateTaskDto,
} from './dto/task.dto';

const TERMINAL: TaskStatus[] = [TaskStatus.completed, TaskStatus.cancelled];

const EMPLOYEE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.pending]: [TaskStatus.in_progress],
  [TaskStatus.in_progress]: [TaskStatus.completed_pending_approval],
  [TaskStatus.completed_pending_approval]: [],
  [TaskStatus.completed]: [],
  [TaskStatus.overdue]: [TaskStatus.in_progress, TaskStatus.completed_pending_approval],
  [TaskStatus.on_hold]: [],
  [TaskStatus.cancelled]: [],
};

const DIRECTOR_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.pending]: [
    TaskStatus.in_progress,
    TaskStatus.on_hold,
    TaskStatus.cancelled,
    TaskStatus.overdue,
  ],
  [TaskStatus.in_progress]: [
    TaskStatus.completed_pending_approval,
    TaskStatus.on_hold,
    TaskStatus.cancelled,
    TaskStatus.overdue,
    TaskStatus.completed,
  ],
  [TaskStatus.completed_pending_approval]: [TaskStatus.completed, TaskStatus.in_progress],
  [TaskStatus.completed]: [TaskStatus.in_progress],
  [TaskStatus.overdue]: [
    TaskStatus.in_progress,
    TaskStatus.on_hold,
    TaskStatus.cancelled,
    TaskStatus.completed_pending_approval,
  ],
  [TaskStatus.on_hold]: [TaskStatus.in_progress, TaskStatus.pending, TaskStatus.cancelled],
  [TaskStatus.cancelled]: [],
};

const taskInclude = {
  assignedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  assignees: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, query: ListTasksQueryDto) {
    const where = this.buildWhere(actor, query);
    const items = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return items.map((task) => this.toTaskDto(this.applyOverdue(task)));
  }

  async stats(actor: AuthUser) {
    const where = this.buildWhere(actor, {});
    const rows = await this.prisma.task.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const counts = new Map(rows.map((row) => [row.status, row._count._all]));
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    return {
      total,
      pending: counts.get(TaskStatus.pending) ?? 0,
      inProgress: counts.get(TaskStatus.in_progress) ?? 0,
      completed: counts.get(TaskStatus.completed) ?? 0,
      overdue: counts.get(TaskStatus.overdue) ?? 0,
      completedPendingApproval: counts.get(TaskStatus.completed_pending_approval) ?? 0,
      onHold: counts.get(TaskStatus.on_hold) ?? 0,
      cancelled: counts.get(TaskStatus.cancelled) ?? 0,
    };
  }

  async getDetail(actor: AuthUser, id: string) {
    const task = await this.requireTask(id);
    this.assertCanView(actor, task);
    const [subtasks, comments, activities] = await Promise.all([
      this.prisma.taskSubtask.findMany({
        where: { taskId: id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.taskComment.findMany({
        where: { taskId: id },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.taskActivity.findMany({
        where: { taskId: id },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      task: this.toTaskDto(this.applyOverdue(task)),
      subtasks: subtasks.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        progressPercent: item.progressPercent,
        order: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      comments: comments.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: this.displayName(item.user),
        text: item.text,
        parentCommentId: item.parentCommentId,
        attachments: item.attachments,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        editHistory: item.editHistory,
      })),
      activity: activities.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: this.displayName(item.user),
        action: item.action,
        metadata: item.metadata,
        timestamp: item.createdAt.toISOString(),
      })),
    };
  }

  async create(actor: AuthUser, dto: CreateTaskDto) {
    this.assertDirector(actor);
    if (!actor.centreId) {
      throw new BadRequestException('Your account has no centre assigned');
    }
    this.assertValidDates(dto.startDate, dto.dueDate);
    await this.assertUsersExist(dto.assignedTo);

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          centreId: actor.centreId as string,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          assignedById: actor.id,
          priority: dto.priority ?? TaskPriority.medium,
          status: TaskStatus.pending,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          estimatedHours: dto.estimatedHours ?? null,
          assignees: {
            create: dto.assignedTo.map((userId) => ({ userId })),
          },
        },
        include: taskInclude,
      });
      await this.log(tx, task.id, actor.id, 'task_created', { title: task.title });
      await this.log(tx, task.id, actor.id, 'task_assigned', { assignedTo: dto.assignedTo });
      return task;
    });

    return this.toTaskDto(created);
  }

  async update(actor: AuthUser, id: string, dto: UpdateTaskDto) {
    const existing = await this.requireTask(id);
    this.assertCanView(actor, existing);

    if (dto.status && dto.status !== existing.status) {
      this.assertTransition(existing.status, dto.status, actor.isDirector);
    }
    if (dto.assignedTo && !actor.isDirector) {
      throw new ForbiddenException('Only directors can reassign tasks');
    }
    if ((dto.title || dto.description || dto.priority || dto.dueDate) && !actor.isDirector) {
      if (dto.title || dto.description || dto.priority || dto.startDate || dto.dueDate) {
        const onlyProgress =
          dto.title === undefined &&
          dto.description === undefined &&
          dto.priority === undefined &&
          dto.startDate === undefined &&
          dto.dueDate === undefined;
        if (!onlyProgress && !dto.status && dto.progressPercent === undefined) {
          throw new ForbiddenException('Only directors can edit task details');
        }
      }
    }

    this.assertValidDates(dto.startDate ?? existing.startDate?.toISOString(), dto.dueDate ?? existing.dueDate?.toISOString());

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.assignedTo) {
        await this.assertUsersExist(dto.assignedTo);
        await tx.taskAssignee.deleteMany({ where: { taskId: id } });
        await tx.taskAssignee.createMany({
          data: dto.assignedTo.map((userId) => ({ taskId: id, userId })),
        });
        await this.log(tx, id, actor.id, 'task_assigned', { assignedTo: dto.assignedTo });
      }

      const data: Prisma.TaskUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title.trim();
      if (dto.description !== undefined) data.description = dto.description.trim() || null;
      if (dto.priority !== undefined) data.priority = dto.priority;
      if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === TaskStatus.completed) data.completionDate = new Date();
      }
      if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
      if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
      if (dto.estimatedHours !== undefined) data.estimatedHours = dto.estimatedHours;
      if (dto.actualHours !== undefined) data.actualHours = dto.actualHours;
      if (dto.progressPercent !== undefined) data.progressPercent = dto.progressPercent;
      if (dto.attachmentUrls !== undefined) {
        data.attachmentUrls = dto.attachmentUrls as Prisma.InputJsonValue;
      }

      const task = await tx.task.update({
        where: { id },
        data,
        include: taskInclude,
      });

      if (dto.status && dto.status !== existing.status) {
        await this.log(tx, id, actor.id, 'status_changed', {
          from: existing.status,
          to: dto.status,
        });
      }
      if (dto.progressPercent !== undefined) {
        await this.log(tx, id, actor.id, 'progress_updated', {
          progressPercent: dto.progressPercent,
        });
      }
      return task;
    });

    return this.toTaskDto(this.applyOverdue(updated));
  }

  async remove(actor: AuthUser, id: string) {
    this.assertDirector(actor);
    await this.requireTask(id);
    await this.prisma.task.delete({ where: { id } });
    return { deleted: true };
  }

  async approve(actor: AuthUser, id: string) {
    this.assertDirector(actor);
    return this.update(actor, id, { status: TaskStatus.completed });
  }

  async reject(actor: AuthUser, id: string) {
    this.assertDirector(actor);
    const updated = await this.update(actor, id, { status: TaskStatus.in_progress });
    await this.prisma.taskActivity.create({
      data: { taskId: id, userId: actor.id, action: 'task_rejected', metadata: {} },
    });
    return updated;
  }

  async reopen(actor: AuthUser, id: string) {
    this.assertDirector(actor);
    return this.update(actor, id, { status: TaskStatus.in_progress });
  }

  async addSubtask(actor: AuthUser, taskId: string, dto: CreateSubtaskDto) {
    this.assertDirector(actor);
    await this.requireTask(taskId);
    const count = await this.prisma.taskSubtask.count({ where: { taskId } });
    const subtask = await this.prisma.taskSubtask.create({
      data: {
        taskId,
        title: dto.title.trim(),
        sortOrder: count + 1,
      },
    });
    await this.prisma.taskActivity.create({
      data: { taskId, userId: actor.id, action: 'subtask_added', metadata: { title: dto.title } },
    });
    return {
      id: subtask.id,
      title: subtask.title,
      status: subtask.status,
      progressPercent: subtask.progressPercent,
      order: subtask.sortOrder,
      createdAt: subtask.createdAt.toISOString(),
      updatedAt: subtask.updatedAt.toISOString(),
    };
  }

  async updateSubtask(actor: AuthUser, taskId: string, subId: string, dto: UpdateSubtaskDto) {
    this.assertDirector(actor);
    const subtask = await this.prisma.taskSubtask.findFirst({ where: { id: subId, taskId } });
    if (!subtask) throw new NotFoundException('Subtask not found');
    const updated = await this.prisma.taskSubtask.update({
      where: { id: subId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.progressPercent !== undefined ? { progressPercent: dto.progressPercent } : {}),
      },
    });
    return {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      progressPercent: updated.progressPercent,
      order: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteSubtask(actor: AuthUser, taskId: string, subId: string) {
    this.assertDirector(actor);
    const subtask = await this.prisma.taskSubtask.findFirst({ where: { id: subId, taskId } });
    if (!subtask) throw new NotFoundException('Subtask not found');
    await this.prisma.taskSubtask.delete({ where: { id: subId } });
    return { deleted: true };
  }

  async addComment(actor: AuthUser, taskId: string, dto: CreateCommentDto) {
    const task = await this.requireTask(taskId);
    this.assertCanView(actor, task);
    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId: actor.id,
        text: dto.text.trim(),
        parentCommentId: dto.parentCommentId ?? null,
      },
    });
    await this.prisma.taskActivity.create({
      data: { taskId, userId: actor.id, action: 'comment_added' },
    });
    return {
      id: comment.id,
      userId: comment.userId,
      userName: this.displayName(actor),
      text: comment.text,
      parentCommentId: comment.parentCommentId,
      attachments: [],
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  async editComment(actor: AuthUser, taskId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.taskComment.findFirst({ where: { id: commentId, taskId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== actor.id && !actor.isDirector) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    const history = Array.isArray(comment.editHistory) ? comment.editHistory : [];
    const updated = await this.prisma.taskComment.update({
      where: { id: commentId },
      data: {
        text: dto.text.trim(),
        editHistory: [...history, { text: comment.text, editedAt: new Date().toISOString() }],
      },
    });
    return {
      id: updated.id,
      userId: updated.userId,
      userName: this.displayName(actor),
      text: updated.text,
      parentCommentId: updated.parentCommentId,
      attachments: updated.attachments,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      editHistory: updated.editHistory,
    };
  }

  private buildWhere(actor: AuthUser, query: ListTasksQueryDto): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {};
    if (actor.isDirector) {
      if (actor.centreId) where.centreId = actor.centreId;
    } else {
      where.assignees = { some: { userId: actor.id } };
    }
    if (query.search?.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assignees = { some: { userId: query.assigneeId } };
    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {
        ...(query.dueDateFrom ? { gte: new Date(query.dueDateFrom) } : {}),
        ...(query.dueDateTo ? { lte: new Date(query.dueDateTo) } : {}),
      };
    }
    return where;
  }

  private async requireTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private assertCanView(
    actor: AuthUser,
    task: { assignedById: string; assignees: Array<{ userId: string }> },
  ) {
    if (actor.isDirector) return;
    const assigned = task.assignees.some((row) => row.userId === actor.id);
    if (!assigned && task.assignedById !== actor.id) {
      throw new ForbiddenException('You cannot view this task');
    }
  }

  private assertDirector(actor: AuthUser) {
    if (!actor.isDirector) {
      throw new ForbiddenException('Only directors can perform this action');
    }
  }

  private assertTransition(from: TaskStatus, to: TaskStatus, isDirector: boolean) {
    if (from === to) return;
    const allowed = (isDirector ? DIRECTOR_TRANSITIONS : EMPLOYEE_TRANSITIONS)[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Cannot change status from ${from} to ${to}`);
    }
  }

  private assertValidDates(startDate?: string | null, dueDate?: string | null) {
    if (!startDate || !dueDate) return;
    if (new Date(startDate) > new Date(dueDate)) {
      throw new BadRequestException('Start date must be on or before due date');
    }
  }

  private async assertUsersExist(ids: string[]) {
    const count = await this.prisma.user.count({ where: { id: { in: ids } } });
    if (count !== ids.length) {
      throw new BadRequestException('One or more assignees were not found');
    }
  }

  private applyOverdue<T extends { status: TaskStatus; dueDate: Date | null }>(task: T): T {
    if (
      task.dueDate &&
      !TERMINAL.includes(task.status) &&
      task.status !== TaskStatus.on_hold &&
      task.dueDate < new Date() &&
      (task.status === TaskStatus.pending || task.status === TaskStatus.in_progress)
    ) {
      return { ...task, status: TaskStatus.overdue };
    }
    return task;
  }

  private async log(
    tx: Prisma.TransactionClient,
    taskId: string,
    userId: string,
    action: string,
    metadata: Record<string, unknown> = {},
  ) {
    await tx.taskActivity.create({
      data: { taskId, userId, action, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  private displayName(user: { firstName?: string | null; lastName?: string | null; email?: string }) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.email || 'User';
  }

  private toTaskDto(task: Prisma.TaskGetPayload<{ include: typeof taskInclude }>) {
    return {
      id: task.id,
      centreId: task.centreId,
      title: task.title,
      description: task.description ?? undefined,
      assignedBy: task.assignedById,
      assignedByName: this.displayName(task.assignedBy),
      assignedTo: task.assignees.map((row) => row.userId),
      assignedToEmails: task.assignees.map((row) => row.user.email),
      assignedToNames: task.assignees.map((row) => this.displayName(row.user)),
      priority: task.priority,
      status: task.status,
      startDate: task.startDate?.toISOString(),
      dueDate: task.dueDate?.toISOString(),
      completionDate: task.completionDate?.toISOString(),
      estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : undefined,
      actualHours: task.actualHours ? Number(task.actualHours) : undefined,
      progressPercent: task.progressPercent,
      parentTaskId: task.parentTaskId,
      attachmentUrls: task.attachmentUrls,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
