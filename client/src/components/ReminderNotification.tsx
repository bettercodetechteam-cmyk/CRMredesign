import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Phone,
  Users,
  RefreshCw,
  GraduationCap,
  Building,
  Target,
  Zap,
  Activity,
  Plus,
  Filter,
  Search,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Clock3,
  CheckSquare,
  XCircle,
  AlertTriangle,
  Info,
  X,
  User,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { reminderService, Reminder, ActiveNotification } from '@/lib/reminderService';
import { format, isToday, isTomorrow, isPast, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ReminderNotificationProps {
  onReminderClick?: (reminder: Reminder) => void;
  onReminderEdit?: (reminder: Reminder) => void;
  onReminderDelete?: (reminderId: string) => void;
  onCreateReminder?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const priorityColors = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-red-100 text-red-800 border-red-200"
};

const statusColors = {
  pending: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  call_made: "bg-purple-100 text-purple-800 border-purple-200",
  meeting_scheduled: "bg-indigo-100 text-indigo-800 border-indigo-200",
  followup_scheduled: "bg-orange-100 text-orange-800 border-orange-200",
  admission_processed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rescheduled: "bg-amber-100 text-amber-800 border-amber-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
};

const typeIcons = {
  call: Phone,
  meeting: Users,
  followup: RefreshCw,
  admission: GraduationCap,
  visit: Building,
  other: Bell
};

export default function ReminderNotification({
  onReminderClick,
  onReminderEdit,
  onReminderDelete,
  onCreateReminder,
  isOpen = false,
  onClose
}: ReminderNotificationProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<ActiveNotification[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Subscribe to reminder notifications
  useEffect(() => {
    if (!userProfile?.centreId) return;

    reminderService.init(userProfile.centreId);
    
    const unsubscribe = reminderService.subscribe((activeNotifications) => {
      setNotifications(activeNotifications);
    });

    return () => unsubscribe();
  }, [userProfile?.centreId]);

  // Handle reminder actions
  const handleMarkAsCompleted = async (reminderId: string) => {
    try {
      await reminderService.updateReminderStatus(reminderId, 'completed');
      toast({
        title: "Success",
        description: "Reminder marked as completed!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update reminder status",
        variant: "destructive",
      });
    }
  };

  const handleSnooze = async (reminderId: string, minutes: number) => {
    try {
      await reminderService.snoozeReminder(reminderId, minutes);
      toast({
        title: "Success",
        description: `Reminder snoozed for ${minutes} minutes`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to snooze reminder",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = (reminderId: string) => {
    // Dispatch custom event for dismissal
    window.dispatchEvent(new CustomEvent('reminderDismissed', {
      detail: { reminderId }
    }));
    
    // Remove from local state
    setNotifications(prev => prev.filter(n => n.reminder.id !== reminderId));
  };

  // Filter notifications based on search
  const filteredNotifications = notifications.filter(notification => 
    notification.reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.reminder.leadName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group notifications by type
  const urgentNotifications = filteredNotifications.filter(n => n.type === 'overdue');
  const dueNotifications = filteredNotifications.filter(n => n.type === 'due');
  const upcomingNotifications = filteredNotifications.filter(n => n.type === 'upcoming');

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                {notifications.length > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </div>
                )}
              </div>
              <div>
                <CardTitle className="text-lg text-gray-900">Reminders</CardTitle>
                <p className="text-sm text-gray-600">
                  {notifications.length > 0 ? `${notifications.length} active` : 'No active reminders'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                {isExpanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search reminders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Notifications List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">
                    {searchTerm ? 'No reminders match your search' : 'No active reminders'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Urgent/Overdue Notifications */}
                  {urgentNotifications.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-semibold text-red-700">Urgent</span>
                      </div>
                      {urgentNotifications.map((notification) => {
                        const reminder = notification.reminder;
                        const TypeIcon = typeIcons[reminder.type];
                        
                        return (
                          <div
                            key={reminder.id}
                            className="group relative overflow-hidden rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-red-100 shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-red-200/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-lg bg-red-100">
                                    <TypeIcon className="w-4 h-4 text-red-600" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                      {reminder.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className={priorityColors[reminder.priority]}>
                                        {reminder.priority}
                                      </Badge>
                                      <Badge className="bg-red-600 text-white animate-pulse">
                                        Overdue
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <span className="font-medium text-gray-700">{reminder.leadName}</span>
                                  {reminder.leadPhone && (
                                    <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                                      <Phone className="w-2 h-2 text-green-600" />
                                    </div>
                                  )}
                                  {reminder.leadPhone && (
                                    <span className="text-gray-600">{reminder.leadPhone}</span>
                                  )}
                                </div>
                                
                                {reminder.description && (
                                  <p className="text-xs text-gray-600 bg-white/50 rounded-lg p-2">
                                    {reminder.description}
                                  </p>
                                )}
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs">
                                    <Clock className="w-3 h-3 text-red-600" />
                                    <span className="font-medium text-red-700">
                                      {Math.abs(notification.minutesDiff)} minutes overdue
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleMarkAsCompleted(reminder.id)}
                                      className="bg-green-600 hover:bg-green-700 h-7 px-2 text-xs"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Done
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSnooze(reminder.id, 30)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <Clock className="w-3 h-3 mr-1" />
                                      30m
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDismiss(reminder.id)}
                                      className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Due Today Notifications */}
                  {dueNotifications.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-orange-700">Due Today</span>
                      </div>
                      {dueNotifications.map((notification) => {
                        const reminder = notification.reminder;
                        const TypeIcon = typeIcons[reminder.type];
                        
                        return (
                          <div
                            key={reminder.id}
                            className="group relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-orange-200/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-lg bg-orange-100">
                                    <TypeIcon className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                      {reminder.title}
                                    </h4>
                                    <Badge className={priorityColors[reminder.priority]}>
                                      {reminder.priority}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <span className="font-medium text-gray-700">{reminder.leadName}</span>
                                  {reminder.leadPhone && (
                                    <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                                      <Phone className="w-2 h-2 text-green-600" />
                                    </div>
                                  )}
                                  {reminder.leadPhone && (
                                    <span className="text-gray-600">{reminder.leadPhone}</span>
                                  )}
                                </div>
                                
                                {reminder.description && (
                                  <p className="text-xs text-gray-600 bg-white/50 rounded-lg p-2">
                                    {reminder.description}
                                  </p>
                                )}
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs">
                                    <Clock className="w-3 h-3 text-orange-600" />
                                    <span className="font-medium text-orange-700">
                                      Due in {notification.minutesDiff} minutes
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleMarkAsCompleted(reminder.id)}
                                      className="bg-green-600 hover:bg-green-700 h-7 px-2 text-xs"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Done
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSnooze(reminder.id, 60)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <Clock className="w-3 h-3 mr-1" />
                                      1h
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDismiss(reminder.id)}
                                      className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Upcoming Notifications */}
                  {upcomingNotifications.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-blue-700">Upcoming</span>
                      </div>
                      {upcomingNotifications.slice(0, 2).map((notification) => {
                        const reminder = notification.reminder;
                        const TypeIcon = typeIcons[reminder.type];
                        
                        return (
                          <div
                            key={reminder.id}
                            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all duration-300 hover:shadow-lg"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-lg bg-blue-100">
                                    <TypeIcon className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                      {reminder.title}
                                    </h4>
                                    <Badge className={priorityColors[reminder.priority]}>
                                      {reminder.priority}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <span className="font-medium text-gray-700">{reminder.leadName}</span>
                                  {reminder.leadPhone && (
                                    <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                                      <Phone className="w-2 h-2 text-green-600" />
                                    </div>
                                  )}
                                  {reminder.leadPhone && (
                                    <span className="text-gray-600">{reminder.leadPhone}</span>
                                  )}
                                </div>
                                
                                {reminder.description && (
                                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                                    {reminder.description}
                                  </p>
                                )}
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs">
                                    <Clock className="w-3 h-3 text-blue-600" />
                                    <span className="font-medium text-blue-700">
                                      Due in {Math.floor(notification.minutesDiff / 60)} hours
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleMarkAsCompleted(reminder.id)}
                                      className="bg-green-600 hover:bg-green-700 h-7 px-2 text-xs"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Done
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSnooze(reminder.id, 120)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <Clock className="w-3 h-3 mr-1" />
                                      2h
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDismiss(reminder.id)}
                                      className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {upcomingNotifications.length > 2 && (
                        <div className="text-center py-3">
                          <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                            <TrendingUp className="w-3 h-3" />
                            +{upcomingNotifications.length - 2} more upcoming
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Actions */}
            {filteredNotifications.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {urgentNotifications.length > 0 && (
                      <span className="text-red-600 font-medium">
                        {urgentNotifications.length} urgent
                      </span>
                    )}
                    {urgentNotifications.length > 0 && dueNotifications.length > 0 && (
                      <span className="mx-1">•</span>
                    )}
                    {dueNotifications.length > 0 && (
                      <span className="text-orange-600 font-medium">
                        {dueNotifications.length} due today
                      </span>
                    )}
                  </div>
                  {onCreateReminder && (
                    <Button
                      size="sm"
                      onClick={onCreateReminder}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      New
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
} 