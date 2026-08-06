import type { TaskPriority, TaskStatus } from '@shared/taskTypes';

export type TaskNotificationEvent =
  | 'task_assigned'
  | 'deadline_changed'
  | 'director_comment'
  | 'task_approved'
  | 'task_rejected'
  | 'progress_updated'
  | 'employee_comment'
  | 'task_complete_pending'
  | 'deadline_missed';

const eventTitles: Record<TaskNotificationEvent, string> = {
  task_assigned: 'New task assigned',
  deadline_changed: 'Task deadline changed',
  director_comment: 'Director commented on task',
  task_approved: 'Task approved',
  task_rejected: 'Task returned for revision',
  progress_updated: 'Task progress updated',
  employee_comment: 'New comment on task',
  task_complete_pending: 'Task pending approval',
  deadline_missed: 'Task deadline missed',
};

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export async function createTaskNotification(params: {
  userId: string;
  centreId: string;
  taskId: string;
  event: TaskNotificationEvent;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  taskTitle?: string;
  assignedByName?: string;
  assignedToNames?: string[];
  dueDate?: string;
  taskPriority?: TaskPriority;
  taskStatus?: TaskStatus;
}): Promise<void> {
  const { db } = await import('@/lib/firebase');
  const { collection, addDoc, Timestamp } = await import('firebase/firestore');
  if (!db) return;

  const metadata = omitUndefined({
    taskId: params.taskId,
    event: params.event,
    taskTitle: params.taskTitle,
    assignedByName: params.assignedByName,
    assignedToNames: params.assignedToNames,
    dueDate: params.dueDate,
    priority: params.taskPriority,
    taskStatus: params.taskStatus,
  });

  await addDoc(collection(db, 'notifications'), {
    userId: params.userId,
    centreId: params.centreId,
    type: 'task',
    title: eventTitles[params.event],
    message: params.message,
    isRead: false,
    priority: params.priority ?? 'medium',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    metadata,
  });
}
