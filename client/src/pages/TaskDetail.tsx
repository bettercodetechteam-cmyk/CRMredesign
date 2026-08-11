import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { taskService, taskQueryKeys } from '@/lib/taskService';
import { taskClientService } from '@/lib/taskClientService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  Upload,
  Paperclip,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Loading from '@/components/ui/loading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TaskStatusBadge, TaskPriorityBadge } from '@/components/tasks/TaskStatusBadge';
import { TaskProgressBar } from '@/components/tasks/TaskProgressBar';
import { TaskComments } from '@/components/tasks/TaskComments';
import { TaskActivityTimeline } from '@/components/tasks/TaskActivityTimeline';
import { TaskSubtasksList } from '@/components/tasks/TaskSubtasksList';
import { TaskConfirmDialog } from '@/components/tasks/TaskConfirmDialog';
import { uploadFileToStorage } from '@/lib/uploadService';

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { isDirector } = usePermissions();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [actualHours, setActualHours] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: taskQueryKeys.detail(taskId!),
    queryFn: () => taskService.getDetail(taskId!),
    enabled: !!taskId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!taskId) return;

    const unsubscribe = taskClientService.subscribeToTask(taskId, (task) => {
      if (!task) return;
      queryClient.setQueryData(taskQueryKeys.detail(taskId), (current: typeof data | undefined) =>
        current ? { ...current, task } : current
      );
    });

    return unsubscribe;
  }, [taskId, queryClient]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(taskId!) });
    queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
  };

  const updateMutation = useMutation({
    mutationFn: (updates: Parameters<typeof taskService.update>[1]) =>
      taskService.update(taskId!, updates),
    onSuccess: (updatedTask, updates) => {
      queryClient.setQueryData(taskQueryKeys.detail(taskId!), (current: typeof data | undefined) =>
        current ? { ...current, task: updatedTask } : current
      );
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      if (updates.status === 'in_progress') {
        toast({ title: 'Task started', description: 'You can now update progress on this task.' });
      }
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: () => taskService.approve(taskId!),
    onSuccess: () => { invalidate(); toast({ title: 'Task approved' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => taskService.reject(taskId!),
    onSuccess: () => { invalidate(); toast({ title: 'Task returned for revision' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const reopenMutation = useMutation({
    mutationFn: () => taskService.reopen(taskId!),
    onSuccess: () => { invalidate(); toast({ title: 'Task reopened' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => taskService.delete(taskId!),
    onSuccess: () => { toast({ title: 'Task deleted' }); navigate('/tasks'); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">{(error as Error)?.message || 'Task not found'}</p>
        <Button variant="link" onClick={() => navigate('/tasks')}>Back to tasks</Button>
      </div>
    );
  }

  const { task, subtasks, comments, activity } = data;
  const assigneeId = userProfile?.id || userProfile?.uid || '';
  const isAssignee = task.assignedTo.includes(assigneeId);
  const canUpdateProgress = isAssignee && !isDirector;

  const handleStartTask = () => updateMutation.mutate({ status: 'in_progress' });
  const handleMarkComplete = () => updateMutation.mutate({ status: 'completed_pending_approval', progressPercent: 100 });
  const handleSaveProgress = () => {
    updateMutation.mutate({
      progressPercent: progress || task.progressPercent,
      actualHours: actualHours ? Number(actualHours) : task.actualHours,
    });
    toast({ title: 'Progress saved' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFileToStorage(file, `tasks/${taskId}`, file.name);
      await taskService.addAttachment(taskId!, {
        url: result.url,
        name: file.name,
        uploadedBy: userProfile?.uid || '',
        uploadedAt: new Date().toISOString(),
        storageKey: result.key,
      });
      invalidate();
      toast({ title: 'File uploaded' });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return '—'; }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/tasks')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{task.title}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <TaskStatusBadge status={task.status} />
                <TaskPriorityBadge priority={task.priority} />
              </div>
            </div>
          </div>
          {isDirector && (
            <div className="flex flex-col xs:flex-row flex-wrap gap-2 sm:justify-end sm:shrink-0 pl-11 sm:pl-0">
              {task.status === 'completed_pending_approval' && (
                <>
                  <Button className="w-full xs:w-auto" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button className="w-full xs:w-auto" variant="outline" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </>
              )}
              {task.status === 'completed' && (
                <Button className="w-full xs:w-auto" variant="outline" onClick={() => reopenMutation.mutate()}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Reopen
                </Button>
              )}
              <Button className="w-full xs:w-auto" variant="destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
            </div>
          )}
        </div>
      </div>

      {task.status === 'completed_pending_approval' && (
        <Alert className="border-amber-300 bg-amber-50">
          <CheckCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">
            {isDirector ? 'Approval required' : 'Marked as done'}
          </AlertTitle>
          <AlertDescription className="text-amber-800">
            {isDirector
              ? 'The assignee marked this task complete. Review the work and approve or send it back for revision.'
              : 'You marked this task as done. Director approval is pending — you will be notified once it is approved.'}
          </AlertDescription>
          {isDirector && (
            <div className="flex flex-col xs:flex-row flex-wrap gap-2 mt-3">
              <Button size="sm" className="w-full xs:w-auto" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-1" /> Approve & Complete
              </Button>
              <Button
                size="sm"
                className="w-full xs:w-auto"
                variant="outline"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" /> Send Back for Revision
              </Button>
            </div>
          )}
        </Alert>
      )}

      {task.status === 'completed' && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-700" />
          <AlertTitle className="text-green-900">Completed</AlertTitle>
          <AlertDescription className="text-green-800">
            {isDirector
              ? 'This task has been approved and marked complete.'
              : 'Your task was approved by the director and is now complete.'}
            {task.completionDate && ` Completed on ${formatDate(task.completionDate)}.`}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
              <div className="mt-4">
                <TaskProgressBar value={task.progressPercent} />
              </div>
            </CardContent>
          </Card>

          {(isDirector || isAssignee) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subtasks</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskSubtasksList
                  subtasks={subtasks}
                  isDirector={isDirector}
                  parentProgress={task.progressPercent}
                  onAdd={(title) => taskService.addSubtask(taskId!, title).then(invalidate)}
                  onToggle={(subId, completed) =>
                    taskService
                      .updateSubtask(taskId!, subId, {
                        status: completed ? 'completed' : 'pending',
                        progressPercent: completed ? 100 : 0,
                      })
                      .then(invalidate)
                  }
                  onDelete={(subId) => taskService.deleteSubtask(taskId!, subId).then(invalidate)}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskComments
                comments={comments}
                currentUserId={userProfile?.uid}
                onAdd={(text, parentId) =>
                  taskService.addComment(taskId!, { text, parentCommentId: parentId }).then(invalidate)
                }
                onEdit={(commentId, text) =>
                  taskService.editComment(taskId!, commentId, text).then(invalidate)
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
          {isDirector && task.status === 'completed_pending_approval' && (
            <Card className="border-amber-300">
              <CardHeader>
                <CardTitle className="text-base">Director Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Employee marked this task done at {task.progressPercent}% progress.
                </p>
                <Button className="w-full" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve & Complete
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Send Back for Revision
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Assigned By" value={task.assignedByName || '—'} />
              <DetailRow label="Assignees" value={task.assignedToNames?.join(', ') || '—'} />
              <DetailRow label="Start Date" value={formatDate(task.startDate)} />
              <DetailRow label="Due Date" value={formatDate(task.dueDate)} />
              <DetailRow label="Completion" value={formatDate(task.completionDate)} />
              <DetailRow label="Estimated Hours" value={task.estimatedHours?.toString() || '—'} />
              <DetailRow label="Actual Hours" value={task.actualHours?.toString() || '—'} />
            </CardContent>
          </Card>

          {canUpdateProgress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {['pending', 'overdue'].includes(task.status) && (
                  <Button
                    className="w-full"
                    onClick={handleStartTask}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? 'Starting...' : 'Start Task'}
                  </Button>
                )}
                {task.status === 'in_progress' && (
                  <>
                    <div>
                      <Label>Progress: {progress || task.progressPercent}%</Label>
                      <Slider
                        value={[progress || task.progressPercent]}
                        onValueChange={([v]) => setProgress(v)}
                        max={100}
                        step={5}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="actualHours">Actual Hours</Label>
                      <Input
                        id="actualHours"
                        type="number"
                        min={0}
                        defaultValue={task.actualHours}
                        onChange={(e) => setActualHours(e.target.value)}
                      />
                    </div>
                    <Button className="w-full" variant="outline" onClick={handleSaveProgress}>
                      Save Progress
                    </Button>
                    <Button className="w-full text-sm sm:text-base" onClick={handleMarkComplete}>
                      <span className="sm:hidden">Mark Complete</span>
                      <span className="hidden sm:inline">Mark Complete (Pending Approval)</span>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
              <CardTitle className="text-base">Attachments</CardTitle>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </CardHeader>
            <CardContent>
              {task.attachmentUrls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments</p>
              ) : (
                <ul className="space-y-2">
                  {task.attachmentUrls.map((a, i) => (
                    <li key={i}>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Paperclip className="h-4 w-4" />
                        {a.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="timeline">
                <TabsList className="mb-4">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline">
                  <TaskActivityTimeline activity={activity} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Task"
        description="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col xs:flex-row xs:justify-between gap-0.5 xs:gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium xs:text-right break-words">{value}</span>
    </div>
  );
}
