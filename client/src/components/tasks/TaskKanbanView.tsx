import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { Task, TaskStatus } from '@shared/taskTypes';
import { KANBAN_COLUMNS, getStatusLabel } from '@shared/taskTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskPriorityBadge } from './TaskStatusBadge';
import { TaskProgressBar } from './TaskProgressBar';
import { taskService } from '@/lib/taskService';
import { useToast } from '@/hooks/use-toast';

interface TaskKanbanViewProps {
  tasks: Task[];
  isDirector?: boolean;
  onTaskUpdated?: () => void;
}

export function TaskKanbanView({ tasks, isDirector, onTaskUpdated }: TaskKanbanViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const columns = KANBAN_COLUMNS.filter((col) =>
    isDirector ? true : !['on_hold', 'cancelled'].includes(col)
  );

  const handleDrop = async (taskId: string, newStatus: TaskStatus) => {
    if (!isDirector) return;
    try {
      await taskService.update(taskId, { status: newStatus });
      onTaskUpdated?.();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Could not update status',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1">
      {columns.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="flex-shrink-0 w-[min(85vw,280px)] sm:w-72 snap-start"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData('taskId');
              if (taskId) handleDrop(taskId, status);
            }}
          >
            <Card className="h-full">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium flex justify-between">
                  {getStatusLabel(status)}
                  <span className="text-muted-foreground">{columnTasks.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2 min-h-[200px]">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable={isDirector}
                    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="p-3 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <TaskPriorityBadge priority={task.priority} />
                    </div>
                    {task.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Due {format(new Date(task.dueDate), 'dd MMM')}
                      </p>
                    )}
                    <div className="mt-2">
                      <TaskProgressBar value={task.progressPercent} showLabel={false} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
