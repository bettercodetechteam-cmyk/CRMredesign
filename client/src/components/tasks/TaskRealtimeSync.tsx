import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { taskQueryKeys } from '@/lib/taskService';
import { taskClientService } from '@/lib/taskClientService';
import { notificationService, type Notification } from '@/lib/notificationService';
import { celebrateTaskApproval } from '@/lib/taskCelebration';
import type { Task, TaskFilters, TaskStats } from '@shared/taskTypes';

function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  let result = [...tasks];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
    );
  }
  if (filters.status && filters.status !== 'all') {
    result = result.filter((t) => t.status === filters.status);
  }
  if (filters.priority && filters.priority !== 'all') {
    result = result.filter((t) => t.priority === filters.priority);
  }
  if (filters.assigneeId) {
    result = result.filter((t) => t.assignedTo.includes(filters.assigneeId!));
  }
  if (filters.dueDateFrom) {
    const from = new Date(filters.dueDateFrom);
    result = result.filter((t) => t.dueDate && new Date(t.dueDate) >= from);
  }
  if (filters.dueDateTo) {
    const to = new Date(filters.dueDateTo);
    result = result.filter((t) => t.dueDate && new Date(t.dueDate) <= to);
  }
  return result;
}

function computeStats(tasks: Task[]): TaskStats {
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => t.status === 'overdue').length,
    completedPendingApproval: tasks.filter((t) => t.status === 'completed_pending_approval').length,
    onHold: tasks.filter((t) => t.status === 'on_hold').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  };
}

function shouldCelebrateApproval(
  prevStatus: string | undefined,
  nextStatus: string,
  isDirector: boolean
): boolean {
  if (isDirector) return false;
  if (nextStatus !== 'completed') return false;
  return prevStatus === 'completed_pending_approval' || prevStatus === 'in_progress' || prevStatus === 'overdue';
}

function isTaskApprovedNotification(notification: Notification): boolean {
  if (notification.type !== 'task') return false;
  const event = notification.metadata?.event;
  return event === 'task_approved' || notification.title === 'Task approved';
}

/**
 * Keeps task React Query caches in sync with Firestore and celebrates employee approvals.
 */
export function TaskRealtimeSync() {
  const { userProfile } = useAuth();
  const { isDirector } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusByTaskIdRef = useRef<Map<string, string>>(new Map());
  const celebratedNotificationIdsRef = useRef<Set<string>>(new Set());
  const celebratedTaskIdsRef = useRef<Set<string>>(new Set());
  const tasksSeededRef = useRef(false);
  const notificationsSeededRef = useRef(false);

  const userId = userProfile?.id || userProfile?.uid;
  const centreId = userProfile?.centreId || 'default';

  useEffect(() => {
    if (!userId) return;

    notificationService.init(centreId, userId);

    const handleApprovalCelebration = (taskId: string, taskTitle?: string) => {
      if (celebratedTaskIdsRef.current.has(taskId)) return;
      celebratedTaskIdsRef.current.add(taskId);
      celebrateTaskApproval(taskTitle);
      toast({
        title: 'Task approved!',
        description: taskTitle ? `"${taskTitle}" has been marked complete.` : 'Your task is now complete.',
      });
    };

    const syncTasksToCache = (tasks: Task[]) => {
      const seeding = !tasksSeededRef.current;

      for (const task of tasks) {
        const prev = statusByTaskIdRef.current.get(task.id);
        if (!seeding && shouldCelebrateApproval(prev, task.status, isDirector)) {
          handleApprovalCelebration(task.id, task.title);
        }
        statusByTaskIdRef.current.set(task.id, task.status);
      }
      tasksSeededRef.current = true;

      queryClient.setQueriesData<Task[]>(
        { queryKey: ['tasks', 'list'] },
        (_old, { queryKey }) => {
          const filters = (queryKey[2] ?? {}) as TaskFilters;
          return applyFilters(tasks, filters).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
      );

      queryClient.setQueryData(taskQueryKeys.stats, computeStats(tasks));

      for (const task of tasks) {
        queryClient.setQueryData(
          taskQueryKeys.detail(task.id),
          (current: { task: Task } | undefined) =>
            current ? { ...current, task } : current
        );
      }
    };

    const unsubscribeTasks = taskClientService.subscribeToTasks(
      { userId, isDirector, centreId },
      syncTasksToCache
    );

    const unsubscribeNotifications = notificationService.subscribe((notifications) => {
      if (isDirector) return;

      const isFirstBatch = !notificationsSeededRef.current;

      for (const notification of notifications) {
        if (!isTaskApprovedNotification(notification)) continue;
        if (celebratedNotificationIdsRef.current.has(notification.id)) continue;

        celebratedNotificationIdsRef.current.add(notification.id);

        if (isFirstBatch) continue;

        const taskId = notification.metadata?.taskId as string | undefined;
        const taskTitle = notification.metadata?.taskTitle as string | undefined;

        if (taskId) {
          handleApprovalCelebration(taskId, taskTitle || notification.message);
        } else {
          celebrateTaskApproval(taskTitle);
          toast({
            title: 'Task approved!',
            description: notification.message,
          });
        }

        void notificationService.markAsRead(notification.id);
      }

      notificationsSeededRef.current = true;
    });

    return () => {
      unsubscribeTasks();
      unsubscribeNotifications();
    };
  }, [userId, centreId, isDirector, queryClient, toast]);

  return null;
}
