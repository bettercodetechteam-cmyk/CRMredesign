import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskEmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function TaskEmptyState({
  title = 'No tasks found',
  description = 'There are no tasks matching your filters.',
  actionLabel,
  onAction,
}: TaskEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
