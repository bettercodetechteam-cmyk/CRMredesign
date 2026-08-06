import type { TaskStatus, TaskPriority } from '@shared/taskTypes';
import { getStatusLabel, getPriorityLabel } from '@shared/taskTypes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles: Record<TaskStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed_pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  on_hold: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-slate-50 text-slate-600',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        statusStyles[status],
        'text-[10px] sm:text-xs whitespace-normal sm:whitespace-nowrap leading-tight max-w-full',
        className
      )}
    >
      {getStatusLabel(status)}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(priorityStyles[priority], className)}>
      {getPriorityLabel(priority)}
    </Badge>
  );
}
