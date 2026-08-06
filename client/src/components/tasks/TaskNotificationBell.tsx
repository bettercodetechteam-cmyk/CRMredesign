import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Bell, CheckSquare, Calendar, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { notificationService, type Notification } from '@/lib/notificationService';
import { TaskPriorityBadge, TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import type { TaskPriority, TaskStatus } from '@shared/taskTypes';

function formatDate(d?: string) {
  if (!d) return null;
  try {
    return format(new Date(d), 'dd MMM yyyy');
  } catch {
    return null;
  }
}

function TaskNotificationItem({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const navigate = useNavigate();
  const meta = notification.metadata ?? {};
  const taskId = meta.taskId as string | undefined;
  const dueDate = formatDate(meta.dueDate as string | undefined);

  const handleOpen = async () => {
    if (!notification.isRead) {
      await notificationService.markAsRead(notification.id);
    }
    onOpen();
    if (taskId) {
      navigate(`/tasks/${taskId}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
        notification.isRead ? 'bg-white' : 'bg-blue-50/60 border-blue-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {(meta.taskTitle as string) || notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
        </div>
        {!notification.isRead && (
          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1" />
        )}
      </div>

      <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
        {meta.assignedByName && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span>
              <span className="font-medium text-gray-700">Assigned by:</span> {meta.assignedByName}
            </span>
          </div>
        )}
        {Array.isArray(meta.assignedToNames) && meta.assignedToNames.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="truncate">
              <span className="font-medium text-gray-700">Assigned to:</span>{' '}
              {(meta.assignedToNames as string[]).join(', ')}
            </span>
          </div>
        )}
        {dueDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              <span className="font-medium text-gray-700">Due:</span> {dueDate}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {meta.taskStatus && (
          <TaskStatusBadge status={meta.taskStatus as TaskStatus} className="text-[10px] px-1.5 py-0" />
        )}
        {meta.priority && (
          <TaskPriorityBadge priority={meta.priority as TaskPriority} className="text-[10px] px-1.5 py-0" />
        )}
        <Badge variant="outline" className="text-[10px]">
          {notification.title}
        </Badge>
      </div>
    </button>
  );
}

export function TaskNotificationBell() {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userProfile?.uid) return;

    notificationService.init(userProfile.centreId || 'default', userProfile.uid);
    const unsubscribe = notificationService.subscribe((items) => {
      setNotifications(items);
    });

    return unsubscribe;
  }, [userProfile?.uid, userProfile?.centreId]);

  const taskNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.type === 'task')
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        }),
    [notifications]
  );

  const unreadCount = taskNotifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    await Promise.all(
      taskNotifications.filter((n) => !n.isRead).map((n) => notificationService.markAsRead(n.id))
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Task notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,95vw)] p-0">
        <div className="border-b px-3 sm:px-4 py-3 bg-blue-50/70 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-blue-900">Notifications</p>
            <p className="text-xs text-blue-700/80">
              {unreadCount > 0 ? `${unreadCount} unread task notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="tasks" className="flex-1 gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              Tasks ({taskNotifications.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tasks" className="m-0">
            <div className="max-h-[420px] overflow-auto p-2 space-y-2">
              {taskNotifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No task notifications yet.
                </div>
              ) : (
                taskNotifications.map((notification) => (
                  <TaskNotificationItem
                    key={notification.id}
                    notification={notification}
                    onOpen={() => setOpen(false)}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
