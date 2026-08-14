import { nestTasksApi } from '@/services/nest/tasksApi';
import type {
  Task,
  TaskSubtask,
  TaskComment,
  TaskActivity,
  TaskStats,
  TaskFilters,
  TaskAttachment,
  TaskPriority,
  TaskStatus,
} from '@shared/taskTypes';

export interface TaskAssignee {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  centreId?: string;
}

export interface TaskDetail {
  task: Task;
  subtasks: TaskSubtask[];
  comments: TaskComment[];
  activity: TaskActivity[];
}

export const taskQueryKeys = {
  all: ['tasks'] as const,
  list: (filters: TaskFilters) => ['tasks', 'list', filters] as const,
  stats: ['tasks', 'stats'] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  assignees: ['tasks', 'assignees'] as const,
};

export const taskService = {
  async list(filters: TaskFilters = {}): Promise<Task[]> {
    return nestTasksApi.list(filters);
  },

  async getStats(): Promise<TaskStats> {
    return nestTasksApi.stats();
  },

  async getDetail(taskId: string): Promise<TaskDetail> {
    return nestTasksApi.getDetail(taskId) as Promise<TaskDetail>;
  },

  async getAssignees(): Promise<TaskAssignee[]> {
    const rows = await nestTasksApi.assignees();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.firstName ?? undefined,
      lastName: row.lastName ?? undefined,
      role: row.role,
      centreId: row.centreId ?? undefined,
    }));
  },

  async create(input: {
    title: string;
    description?: string;
    assignedTo: string[];
    priority?: TaskPriority;
    startDate?: string;
    dueDate?: string;
    estimatedHours?: number;
  }): Promise<Task> {
    return nestTasksApi.create(input);
  },

  async update(
    taskId: string,
    updates: Partial<{
      title: string;
      description: string;
      assignedTo: string[];
      priority: TaskPriority;
      status: TaskStatus;
      startDate: string;
      dueDate: string;
      estimatedHours: number;
      actualHours: number;
      progressPercent: number;
    }>,
  ): Promise<Task> {
    return nestTasksApi.update(taskId, updates);
  },

  async delete(taskId: string): Promise<void> {
    await nestTasksApi.remove(taskId);
  },

  async approve(taskId: string): Promise<Task> {
    return nestTasksApi.approve(taskId);
  },

  async reject(taskId: string): Promise<Task> {
    return nestTasksApi.reject(taskId);
  },

  async reopen(taskId: string): Promise<Task> {
    return nestTasksApi.reopen(taskId);
  },

  async addSubtask(taskId: string, title: string): Promise<TaskSubtask> {
    return nestTasksApi.addSubtask(taskId, title);
  },

  async updateSubtask(
    taskId: string,
    subId: string,
    updates: Partial<{ title: string; status: TaskStatus; progressPercent: number }>,
  ): Promise<TaskSubtask> {
    return nestTasksApi.updateSubtask(taskId, subId, updates);
  },

  async deleteSubtask(taskId: string, subId: string): Promise<void> {
    await nestTasksApi.deleteSubtask(taskId, subId);
  },

  async addComment(
    taskId: string,
    input: { text: string; parentCommentId?: string; attachments?: TaskAttachment[] },
  ): Promise<TaskComment> {
    return nestTasksApi.addComment(taskId, input);
  },

  async editComment(taskId: string, commentId: string, text: string): Promise<TaskComment> {
    return nestTasksApi.editComment(taskId, commentId, text);
  },

  async addAttachment(taskId: string, attachment: TaskAttachment): Promise<Task> {
    const detail = await nestTasksApi.getDetail(taskId) as TaskDetail;
    const urls = [...(detail.task.attachmentUrls ?? []), attachment];
    return nestTasksApi.update(taskId, { attachmentUrls: urls } as Record<string, unknown>);
  },
};
