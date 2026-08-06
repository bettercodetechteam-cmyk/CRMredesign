import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TaskProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function TaskProgressBar({ value, className, showLabel = true }: TaskProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{clamped}%</span>
        </div>
      )}
      <Progress value={clamped} className="h-2" />
    </div>
  );
}
