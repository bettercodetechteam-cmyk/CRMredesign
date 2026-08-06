import { useState } from 'react';
import type { TaskSubtask } from '@shared/taskTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { TaskProgressBar } from './TaskProgressBar';

interface TaskSubtasksListProps {
  subtasks: TaskSubtask[];
  isDirector?: boolean;
  parentProgress: number;
  onAdd: (title: string) => Promise<void>;
  onToggle: (subId: string, completed: boolean) => Promise<void>;
  onDelete: (subId: string) => Promise<void>;
}

export function TaskSubtasksList({
  subtasks,
  isDirector,
  parentProgress,
  onAdd,
  onToggle,
  onDelete,
}: TaskSubtasksListProps) {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <TaskProgressBar value={parentProgress} />
      {isDirector && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="New subtask title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1"
          />
          <Button
            className="w-full sm:w-auto shrink-0"
            disabled={!newTitle.trim() || adding}
            onClick={async () => {
              setAdding(true);
              try {
                await onAdd(newTitle);
                setNewTitle('');
              } finally {
                setAdding(false);
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {subtasks.map((sub) => (
          <div key={sub.id} className="flex items-center gap-3 p-2 border rounded-md">
            <Checkbox
              checked={sub.status === 'completed'}
              disabled={!isDirector}
              onCheckedChange={(checked) => onToggle(sub.id, !!checked)}
            />
            <span className={`flex-1 text-sm ${sub.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
              {sub.title}
            </span>
            {isDirector && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(sub.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        ))}
        {subtasks.length === 0 && (
          <p className="text-sm text-muted-foreground">No subtasks yet.</p>
        )}
      </div>
    </div>
  );
}
