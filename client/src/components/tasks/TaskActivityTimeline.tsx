import { format } from 'date-fns';
import type { TaskActivity } from '@shared/taskTypes';
import { getStatusLabel } from '@shared/taskTypes';

const actionLabels: Record<string, string> = {
  task_created: 'Task created',
  task_assigned: 'Task assigned',
  progress_updated: 'Progress updated',
  status_changed: 'Status changed',
  deadline_changed: 'Deadline changed',
  comment_added: 'Comment added',
  attachment_uploaded: 'Attachment uploaded',
  task_approved: 'Task approved',
  task_rejected: 'Task rejected',
  task_reopened: 'Task reopened',
  subtask_added: 'Subtask added',
  subtask_updated: 'Subtask updated',
  subtask_deleted: 'Subtask deleted',
};

function formatActivityMessage(activity: TaskActivity): string {
  const meta = activity.metadata || {};
  switch (activity.action) {
    case 'status_changed':
      return `Changed status from ${getStatusLabel(meta.from as any)} to ${getStatusLabel(meta.to as any)}`;
    case 'progress_updated':
      return `Updated progress to ${meta.progress}%`;
    case 'deadline_changed':
      return 'Updated task deadline';
    case 'task_assigned':
      return 'Assigned task to team members';
    default:
      return actionLabels[activity.action] || activity.action;
  }
}

interface TaskActivityTimelineProps {
  activity: TaskActivity[];
}

export function TaskActivityTimeline({ activity }: TaskActivityTimelineProps) {
  if (!activity.length) {
    return <p className="text-sm text-muted-foreground py-4">No activity yet.</p>;
  }

  return (
    <div className="space-y-4">
      {activity.map((item) => (
        <div key={item.id} className="flex gap-2 sm:gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm break-words">
              <span className="font-medium">{item.userName}</span>
              {' — '}
              {formatActivityMessage(item)}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.timestamp ? format(new Date(item.timestamp), 'dd MMM yyyy HH:mm') : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
