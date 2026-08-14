import { nestApi } from '@/lib/nestApi';
import type {
  Task,
  TaskComment,
  TaskFilters,
  TaskStats,
  TaskSubtask,
} from '@shared/taskTypes';

export interface NestTaskAssignee {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string | null;
  role: string;
  centreId?: string | null;
}

function taskParams(filters: TaskFilters = {}): Record<string, unknown> {
  return {
    search: filters.search,
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    priority: filters.priority && filters.priority !== 'all' ? filters.priority : undefined,
    assigneeId: filters.assigneeId,
    dueDateFrom: filters.dueDateFrom,
    dueDateTo: filters.dueDateTo,
  };
}

export const nestTasksApi = {
  list: (filters: TaskFilters = {}) => nestApi.get<Task[]>('/tasks', taskParams(filters)),
  stats: () => nestApi.get<TaskStats>('/tasks/stats'),
  assignees: () => nestApi.get<NestTaskAssignee[]>('/tasks/assignees'),
  getDetail: (id: string) => nestApi.get<unknown>(`/tasks/${id}`),
  create: (body: Record<string, unknown>) => nestApi.post<Task>('/tasks', body),
  update: (id: string, body: Record<string, unknown>) => nestApi.patch<Task>(`/tasks/${id}`, body),
  remove: (id: string) => nestApi.delete<{ deleted: boolean }>(`/tasks/${id}`),
  approve: (id: string) => nestApi.post<Task>(`/tasks/${id}/approve`),
  reject: (id: string) => nestApi.post<Task>(`/tasks/${id}/reject`),
  reopen: (id: string) => nestApi.post<Task>(`/tasks/${id}/reopen`),
  addSubtask: (id: string, title: string) =>
    nestApi.post<TaskSubtask>(`/tasks/${id}/subtasks`, { title }),
  updateSubtask: (id: string, subId: string, body: Record<string, unknown>) =>
    nestApi.patch<TaskSubtask>(`/tasks/${id}/subtasks/${subId}`, body),
  deleteSubtask: (id: string, subId: string) =>
    nestApi.delete<{ deleted: boolean }>(`/tasks/${id}/subtasks/${subId}`),
  addComment: (id: string, body: Record<string, unknown>) =>
    nestApi.post<TaskComment>(`/tasks/${id}/comments`, body),
  editComment: (id: string, commentId: string, text: string) =>
    nestApi.patch<TaskComment>(`/tasks/${id}/comments/${commentId}`, { text }),
};
