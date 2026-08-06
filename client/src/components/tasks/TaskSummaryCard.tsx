import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { Task } from '@shared/taskTypes';
import { getPriorityLabel, getStatusLabel } from '@shared/taskTypes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TaskStatusBadge, TaskPriorityBadge } from './TaskStatusBadge';
import { TaskProgressBar } from './TaskProgressBar';
import { Calendar, User, Users, Clock, Eye } from 'lucide-react';

interface TaskSummaryCardProps {
  task: Task;
  isDirector?: boolean;
}

function formatDate(d?: string) {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

export function TaskSummaryCard({ task, isDirector }: TaskSummaryCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="hover:shadow-md transition-shadow border shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
        </div>

        {task.status === 'completed_pending_approval' && (
          <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Marked as done — director approval is pending.
          </p>
        )}

        {task.status === 'completed' && (
          <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            Approved and completed.
          </p>
        )}

        <TaskProgressBar value={task.progressPercent} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium text-gray-700">Assigned by:</span>{' '}
              {task.assignedByName || '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">
              <span className="font-medium text-gray-700">Assigned to:</span>{' '}
              {task.assignedToNames?.join(', ') || task.assignedToEmails?.join(', ') || '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium text-gray-700">Due:</span> {formatDate(task.dueDate)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium text-gray-700">Est. hours:</span>{' '}
              {task.estimatedHours ?? '—'}
            </span>
          </div>
        </div>

        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground min-w-0">
            {getStatusLabel(task.status)} · {getPriorityLabel(task.priority)}
            {task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ''}
          </p>
          <Button size="sm" variant="outline" className="w-full xs:w-auto shrink-0" onClick={() => navigate(`/tasks/${task.id}`)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
