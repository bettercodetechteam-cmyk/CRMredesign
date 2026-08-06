import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { Task } from '@shared/taskTypes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { TaskStatusBadge, TaskPriorityBadge } from './TaskStatusBadge';
import { TaskProgressBar } from './TaskProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Pencil, Trash2 } from 'lucide-react';

interface TaskTableViewProps {
  tasks: Task[];
  isDirector?: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

function formatDate(d?: string) {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

function TaskMobileCard({
  task,
  isDirector,
  onEdit,
  onDelete,
}: {
  task: Task;
  isDirector?: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}) {
  const navigate = useNavigate();

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-3">
        <button
          type="button"
          className="w-full text-left"
          onClick={() => navigate(`/tasks/${task.id}`)}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 line-clamp-2">{task.title}</h3>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
            </div>
          </div>
        </button>

        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-gray-700">{isDirector ? 'To:' : 'By:'}</span>{' '}
            {isDirector
              ? task.assignedToNames?.join(', ') || '—'
              : task.assignedByName || '—'}
          </p>
          {isDirector && (
            <p>
              <span className="font-medium text-gray-700">By:</span> {task.assignedByName || '—'}
            </p>
          )}
          <p>
            <span className="font-medium text-gray-700">Due:</span> {formatDate(task.dueDate)}
          </p>
        </div>

        <TaskProgressBar value={task.progressPercent} />

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 min-w-[100px]" onClick={() => navigate(`/tasks/${task.id}`)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {isDirector && onEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isDirector && onDelete && (
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => onDelete(task)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskTableView({ tasks, isDirector, onEdit, onDelete }: TaskTableViewProps) {
  const navigate = useNavigate();
  const { sortedData, sortConfig, requestSort } = useTableSort(tasks, { key: 'dueDate', direction: null });

  return (
    <>
      {/* Mobile / tablet card list */}
      <div className="grid gap-3 md:hidden">
        {sortedData.map((task) => (
          <TaskMobileCard
            key={task.id}
            task={task}
            isDirector={isDirector}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead<Task> sortKey="title" sortConfig={sortConfig} requestSort={requestSort}>
                Title
              </SortableTableHead>
              <SortableTableHead<Task> sortKey="status" sortConfig={sortConfig} requestSort={requestSort}>
                Status
              </SortableTableHead>
              <SortableTableHead<Task> sortKey="priority" sortConfig={sortConfig} requestSort={requestSort}>
                Priority
              </SortableTableHead>
              <TableHead>{isDirector ? 'Assigned To' : 'Assigned By'}</TableHead>
              {isDirector && <TableHead>Assigned By</TableHead>}
              <SortableTableHead<Task> sortKey="dueDate" sortConfig={sortConfig} requestSort={requestSort}>
                Due Date
              </SortableTableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((task) => (
              <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell
                  className="font-medium max-w-[200px] truncate"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  {task.title}
                </TableCell>
                <TableCell onClick={() => navigate(`/tasks/${task.id}`)}>
                  <TaskStatusBadge status={task.status} />
                </TableCell>
                <TableCell onClick={() => navigate(`/tasks/${task.id}`)}>
                  <TaskPriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                  {isDirector
                    ? task.assignedToNames?.join(', ') || task.assignedToEmails?.join(', ') || '—'
                    : task.assignedByName || '—'}
                </TableCell>
                {isDirector && (
                  <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                    {task.assignedByName || '—'}
                  </TableCell>
                )}
                <TableCell onClick={() => navigate(`/tasks/${task.id}`)}>
                  {formatDate(task.dueDate)}
                </TableCell>
                <TableCell className="min-w-[120px]" onClick={() => navigate(`/tasks/${task.id}`)}>
                  <TaskProgressBar value={task.progressPercent} showLabel={false} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/tasks/${task.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isDirector && onEdit && (
                      <Button variant="ghost" size="icon" onClick={() => onEdit(task)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {isDirector && onDelete && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(task)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
