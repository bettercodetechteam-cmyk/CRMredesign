export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed_pending_approval',
  'completed',
  'overdue',
  'on_hold',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TERMINAL_STATUSES: TaskStatus[] = ['completed', 'cancelled'];

export const ACTIVE_STATUSES: TaskStatus[] = [
  'pending',
  'in_progress',
  'completed_pending_approval',
  'overdue',
  'on_hold',
];

export const TASK_ACTIVITY_ACTIONS = [
  'task_created',
  'task_assigned',
  'progress_updated',
  'status_changed',
  'deadline_changed',
  'comment_added',
  'attachment_uploaded',
  'task_approved',
  'task_rejected',
  'task_reopened',
  'subtask_added',
  'subtask_updated',
  'subtask_deleted',
] as const;

export type TaskActivityAction = (typeof TASK_ACTIVITY_ACTIONS)[number];

export interface TaskAttachment {
  url: string;
  name: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  centreId: string;
  title: string;
  description?: string;
  assignedBy: string;
  assignedByName?: string;
  assignedTo: string[];
  assignedToEmails?: string[];
  assignedToNames?: string[];
  priority: TaskPriority;
  status: TaskStatus;
  startDate?: string;
  dueDate?: string;
  completionDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  progressPercent: number;
  parentTaskId?: string | null;
  attachmentUrls: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskSubtask {
  id: string;
  title: string;
  status: TaskStatus;
  progressPercent: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  parentCommentId?: string | null;
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
  editHistory?: { text: string; editedAt: string }[];
}

export interface TaskActivity {
  id: string;
  userId: string;
  userName: string;
  action: TaskActivityAction;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completedPendingApproval: number;
  onHold: number;
  cancelled: number;
}

export interface TaskFilters {
  search?: string;
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  assigneeId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

const EMPLOYEE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress'],
  in_progress: ['completed_pending_approval'],
  completed_pending_approval: [],
  completed: [],
  overdue: ['in_progress', 'completed_pending_approval'],
  on_hold: [],
  cancelled: [],
};

const DIRECTOR_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'on_hold', 'cancelled', 'overdue'],
  in_progress: ['completed_pending_approval', 'on_hold', 'cancelled', 'overdue', 'completed'],
  completed_pending_approval: ['completed', 'in_progress'],
  completed: ['in_progress'],
  overdue: ['in_progress', 'on_hold', 'cancelled', 'completed_pending_approval'],
  on_hold: ['in_progress', 'pending', 'cancelled'],
  cancelled: [],
};

export function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function computeOverdueStatus(
  status: TaskStatus,
  dueDate?: string | Date | null
): TaskStatus {
  if (!dueDate || isTerminalStatus(status) || status === 'on_hold') {
    return status;
  }
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) return status;
  const now = new Date();
  if (
    due < now &&
    ['pending', 'in_progress'].includes(status)
  ) {
    return 'overdue';
  }
  if (status === 'overdue' && due >= now) {
    return 'in_progress';
  }
  return status;
}

export function canTransitionStatus(
  from: TaskStatus,
  to: TaskStatus,
  isDirector: boolean
): boolean {
  if (from === to) return true;
  const map = isDirector ? DIRECTOR_TRANSITIONS : EMPLOYEE_TRANSITIONS;
  return map[from]?.includes(to) ?? false;
}

export function validateTaskDates(startDate?: string, dueDate?: string): string | null {
  if (!startDate || !dueDate) return null;
  const start = new Date(startDate);
  const due = new Date(dueDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return 'Invalid date format.';
  }
  if (start > due) {
    return 'Start date must be on or before due date.';
  }
  return null;
}

export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed_pending_approval: 'Marked Done · Awaiting Approval',
    completed: 'Completed',
    overdue: 'Overdue',
    on_hold: 'On Hold',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}

export function getPriorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  };
  return labels[priority] ?? priority;
}

export const KANBAN_COLUMNS: TaskStatus[] = [
  'pending',
  'in_progress',
  'completed_pending_approval',
  'completed',
  'overdue',
  'on_hold',
];
