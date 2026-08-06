import { auth, db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { taskClientService } from '@/lib/taskClientService';
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

async function getAuthHeaders(): Promise<HeadersInit> {
  if (!auth?.currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await auth.currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function taskFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(await getAuthHeaders()),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || `Request failed (${response.status})`) as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }
  return data as T;
}

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom);
  if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function getAssigneesFromFirestore(): Promise<TaskAssignee[]> {
  if (!db) throw new Error('Database not available.');
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      const role = String(data.role ?? '').trim().toLowerCase();
      if (role === 'pending' || data.approved !== true) return null;
      return {
        id: docSnap.id,
        email: (data.email as string) || '',
        firstName: data.firstName as string | undefined,
        lastName: data.lastName as string | undefined,
        role: (data.role as string) || role,
        centreId: data.centreId as string | undefined,
      };
    })
    .filter((user): user is TaskAssignee => user !== null)
    .sort((a, b) => {
      const nameA = [a.firstName, a.lastName, a.email].filter(Boolean).join(' ');
      const nameB = [b.firstName, b.lastName, b.email].filter(Boolean).join(' ');
      return nameA.localeCompare(nameB);
    });
}

function shouldUseClientFallback(error: unknown): boolean {
  const err = error as Error & { status?: number };
  return (
    err.status === 503 ||
    err.message?.includes('unavailable') ||
    err.message?.includes('Firebase Admin') ||
    err.message?.includes('Service unavailable')
  );
}

const CLIENT_TASKS_KEY = 'crm_tasks_use_client';

function isClientTasksPreferred(): boolean {
  try {
    return sessionStorage.getItem(CLIENT_TASKS_KEY) === '1';
  } catch {
    return false;
  }
}

function markClientTasksPreferred(): void {
  try {
    sessionStorage.setItem(CLIENT_TASKS_KEY, '1');
  } catch {
    // ignore storage errors
  }
}

async function withServerOrClientFallback<T>(
  serverCall: () => Promise<T>,
  clientCall: () => Promise<T>
): Promise<T> {
  if (isClientTasksPreferred()) {
    return clientCall();
  }
  try {
    return await serverCall();
  } catch (error: unknown) {
    if (!shouldUseClientFallback(error)) {
      throw error;
    }
    markClientTasksPreferred();
    return clientCall();
  }
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
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: Task[] }>(
          `/api/tasks${buildQuery(filters)}`
        );
        return res.data;
      },
      () => taskClientService.list(filters)
    );
  },

  async getStats(): Promise<TaskStats> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: TaskStats }>('/api/tasks/stats');
        return res.data;
      },
      () => taskClientService.getStats()
    );
  },

  async getDetail(taskId: string): Promise<TaskDetail> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: TaskDetail }>(`/api/tasks/${taskId}`);
        return res.data;
      },
      () => taskClientService.getDetail(taskId)
    );
  },

  async getAssignees(): Promise<TaskAssignee[]> {
    try {
      const res = await taskFetch<{ success: boolean; data: TaskAssignee[] }>('/api/tasks/assignees');
      if (res.data?.length) return res.data;
      return getAssigneesFromFirestore();
    } catch (error: unknown) {
      if (shouldUseClientFallback(error)) {
        return getAssigneesFromFirestore();
      }
      throw error;
    }
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
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: Task }>('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        return res.data;
      },
      () => taskClientService.create(input)
    );
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
    }>
  ): Promise<Task> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: Task }>(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        return res.data;
      },
      () => taskClientService.update(taskId, updates)
    );
  },

  async delete(taskId: string): Promise<void> {
    return withServerOrClientFallback(
      async () => {
        await taskFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      },
      () => taskClientService.delete(taskId)
    );
  },

  async approve(taskId: string): Promise<Task> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: Task }>(`/api/tasks/${taskId}/approve`, {
          method: 'POST',
        });
        return res.data;
      },
      () => taskClientService.approve(taskId)
    );
  },

  async reject(taskId: string): Promise<Task> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: Task }>(`/api/tasks/${taskId}/reject`, {
          method: 'POST',
        });
        return res.data;
      },
      () => taskClientService.reject(taskId)
    );
  },

  async reopen(taskId: string): Promise<Task> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: Task }>(`/api/tasks/${taskId}/reopen`, {
          method: 'POST',
        });
        return res.data;
      },
      () => taskClientService.reopen(taskId)
    );
  },

  async addSubtask(taskId: string, title: string): Promise<TaskSubtask> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: TaskSubtask }>(
          `/api/tasks/${taskId}/subtasks`,
          { method: 'POST', body: JSON.stringify({ title }) }
        );
        return res.data;
      },
      () => taskClientService.addSubtask(taskId, title)
    );
  },

  async updateSubtask(
    taskId: string,
    subId: string,
    updates: Partial<{ title: string; status: TaskStatus; progressPercent: number }>
  ): Promise<TaskSubtask> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: TaskSubtask }>(
          `/api/tasks/${taskId}/subtasks/${subId}`,
          { method: 'PUT', body: JSON.stringify(updates) }
        );
        return res.data;
      },
      () => taskClientService.updateSubtask(taskId, subId, updates)
    );
  },

  async deleteSubtask(taskId: string, subId: string): Promise<void> {
    return withServerOrClientFallback(
      async () => {
        await taskFetch(`/api/tasks/${taskId}/subtasks/${subId}`, { method: 'DELETE' });
      },
      () => taskClientService.deleteSubtask(taskId, subId)
    );
  },

  async addComment(
    taskId: string,
    input: { text: string; parentCommentId?: string; attachments?: TaskAttachment[] }
  ): Promise<TaskComment> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: TaskComment }>(
          `/api/tasks/${taskId}/comments`,
          { method: 'POST', body: JSON.stringify(input) }
        );
        return res.data;
      },
      () => taskClientService.addComment(taskId, input)
    );
  },

  async editComment(taskId: string, commentId: string, text: string): Promise<TaskComment> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: TaskComment }>(
          `/api/tasks/${taskId}/comments/${commentId}`,
          { method: 'PUT', body: JSON.stringify({ text }) }
        );
        return res.data;
      },
      () => taskClientService.editComment(taskId, commentId, text)
    );
  },

  async addAttachment(taskId: string, attachment: TaskAttachment): Promise<Task> {
    return withServerOrClientFallback(
      async () => {
        const res = await taskFetch<{ success: boolean; data: Task }>(
          `/api/tasks/${taskId}/attachments`,
          { method: 'POST', body: JSON.stringify(attachment) }
        );
        return res.data;
      },
      () => taskClientService.addAttachment(taskId, attachment)
    );
  },
};
