import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageLoadingSignal } from '@/contexts/NavigationLoadingContext';
import { taskService, taskQueryKeys } from '@/lib/taskService';
import type { Task, TaskFilters } from '@shared/taskTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Loading from '@/components/ui/loading';
import { TaskDashboardStats } from '@/components/tasks/TaskDashboardStats';
import { TaskFiltersBar } from '@/components/tasks/TaskFilters';
import { TaskTableView } from '@/components/tasks/TaskTableView';
import { TaskKanbanView } from '@/components/tasks/TaskKanbanView';
import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { TaskEmptyState } from '@/components/tasks/TaskEmptyState';
import { TaskConfirmDialog } from '@/components/tasks/TaskConfirmDialog';
import { TaskSummaryCard } from '@/components/tasks/TaskSummaryCard';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Tasks() {
  const { isDirector } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TaskFilters>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: taskQueryKeys.list(filters),
    queryFn: () => taskService.list(filters),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: taskQueryKeys.stats,
    queryFn: () => taskService.getStats(),
    enabled: isDirector,
  });

  const { data: assignees = [], isLoading: assigneesLoading } = useQuery({
    queryKey: taskQueryKeys.assignees,
    queryFn: () => taskService.getAssignees(),
    enabled: isDirector,
  });

  usePageLoadingSignal(isLoading);

  const createMutation = useMutation({
    mutationFn: taskService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      setFormOpen(false);
      toast({ title: 'Task created successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof taskService.update>[1] }) =>
      taskService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      setFormOpen(false);
      setEditingTask(null);
      toast({ title: 'Task updated successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: taskService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      setDeleteTask(null);
      toast({ title: 'Task deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleFormSubmit = async (data: Parameters<typeof taskService.create>[0]) => {
    if (editingTask) {
      await updateMutation.mutateAsync({ id: editingTask.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const recentlyAssigned = useMemo(
    () => [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [tasks]
  );

  const overdueTasks = useMemo(() => tasks.filter((t) => t.status === 'overdue').slice(0, 5), [tasks]);

  const pendingApprovalTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'completed_pending_approval')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [tasks]
  );

  const recentlyCompleted = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'completed')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [tasks]
  );

  const myTasksByStatus = useMemo(() => ({
    pending: tasks.filter((t) => t.status === 'pending'),
    inProgress: tasks.filter((t) => ['in_progress', 'overdue'].includes(t.status)),
    awaitingApproval: tasks.filter((t) => t.status === 'completed_pending_approval'),
    completed: tasks.filter((t) => t.status === 'completed'),
  }), [tasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
            {isDirector ? 'Task Dashboard' : 'My Tasks'}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            {isDirector ? 'Manage and assign tasks across your team' : 'View and update your assigned tasks'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isDirector && (
            <Button className="flex-1 sm:flex-none" onClick={() => { setEditingTask(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          )}
        </div>
      </div>

      {isDirector && stats && (
        <TaskDashboardStats stats={stats} loading={statsLoading} />
      )}

      {!isDirector && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {[
            { label: 'Pending', count: myTasksByStatus.pending.length },
            { label: 'In Progress', count: myTasksByStatus.inProgress.length },
            { label: 'Awaiting Approval', count: myTasksByStatus.awaitingApproval.length, short: 'Awaiting' },
            { label: 'Completed', count: myTasksByStatus.completed.length },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 sm:p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold">{s.count}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-1">
                  <span className="sm:hidden">{s.short ?? s.label}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskFiltersBar
        filters={filters}
        onChange={setFilters}
        assignees={assignees}
        showAssigneeFilter={isDirector}
      />

      {isDirector && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <WidgetCard
            title="Pending Approval"
            tasks={pendingApprovalTasks}
            onNavigate={navigate}
            highlight="amber"
          />
          <WidgetCard title="Recently Assigned" tasks={recentlyAssigned} onNavigate={navigate} />
          <WidgetCard title="Overdue" tasks={overdueTasks} onNavigate={navigate} highlight="red" />
          <WidgetCard title="Recently Completed" tasks={recentlyCompleted} onNavigate={navigate} />
        </div>
      )}

      {!isDirector && tasks.length > 0 && (
        <div className="space-y-3 lg:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Your Assigned Tasks</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <TaskSummaryCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <TaskEmptyState
          title={isDirector ? 'No tasks yet' : 'No tasks assigned to you'}
          description={isDirector ? 'Create your first task to get started.' : 'You have no tasks matching your filters.'}
          actionLabel={isDirector ? 'Create Task' : undefined}
          onAction={isDirector ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <Tabs defaultValue="table" className={!isDirector ? 'hidden lg:block w-full' : 'w-full'}>
          <TabsList className="w-full sm:w-auto h-auto flex flex-wrap sm:flex-nowrap gap-1 p-1">
            <TabsTrigger value="table" className="flex-1 sm:flex-none text-xs sm:text-sm">Table</TabsTrigger>
            <TabsTrigger value="kanban" className="flex-1 sm:flex-none text-xs sm:text-sm">Kanban</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1 sm:flex-none text-xs sm:text-sm">Calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="table" className="mt-4">
            <TaskTableView
              tasks={tasks}
              isDirector={isDirector}
              onEdit={(t) => { setEditingTask(t); setFormOpen(true); }}
              onDelete={setDeleteTask}
            />
          </TabsContent>
          <TabsContent value="kanban" className="mt-4">
            <TaskKanbanView
              tasks={tasks}
              isDirector={isDirector}
              onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: taskQueryKeys.all })}
            />
          </TabsContent>
          <TabsContent value="calendar" className="mt-4">
            <TaskCalendarView tasks={tasks} />
          </TabsContent>
        </Tabs>
      )}

      {isDirector && (
        <TaskFormDialog
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingTask(null); }}
          task={editingTask}
          assignees={assignees}
          assigneesLoading={assigneesLoading}
          onSubmit={handleFormSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <TaskConfirmDialog
        open={!!deleteTask}
        onOpenChange={(o) => !o && setDeleteTask(null)}
        title="Delete Task"
        description={`Are you sure you want to delete "${deleteTask?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTask && deleteMutation.mutate(deleteTask.id)}
      />
    </div>
  );
}

function WidgetCard({
  title,
  tasks,
  onNavigate,
  highlight,
}: {
  title: string;
  tasks: Task[];
  onNavigate: (path: string) => void;
  highlight?: 'amber' | 'red';
}) {
  const borderClass =
    highlight === 'amber' ? 'border-amber-300 bg-amber-50/30' :
    highlight === 'red' ? 'border-red-200' :
    '';

  return (
    <Card className={borderClass}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onNavigate(`/tasks/${t.id}`)}
              className="w-full text-left p-2 rounded hover:bg-muted text-sm space-y-1"
            >
              <div className="flex justify-between items-center gap-2">
                <span className="truncate font-medium">{t.title}</span>
                <TaskStatusBadge status={t.status} />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                To: {t.assignedToNames?.join(', ') || '—'} · By: {t.assignedByName || '—'}
              </p>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
