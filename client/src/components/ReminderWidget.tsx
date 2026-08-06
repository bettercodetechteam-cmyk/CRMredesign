import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Phone,
  Users,
  RefreshCw,
  GraduationCap,
  Building,
  X,
  User,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { reminderService, Reminder, ActiveNotification } from '@/lib/reminderService';
import { useToast } from '@/hooks/use-toast';

interface ReminderWidgetProps {
  className?: string;
  showCreateButton?: boolean;
  onCreateReminder?: () => void;
  maxDisplay?: number;
}

const priorityColors = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-red-100 text-red-800 border-red-200"
};

const typeIcons = {
  call: Phone,
  meeting: Users,
  followup: RefreshCw,
  admission: GraduationCap,
  visit: Building,
  other: Bell
};

export default function ReminderWidget({
  className = "",
  showCreateButton = false,
  onCreateReminder,
  maxDisplay = 3
}: ReminderWidgetProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<ActiveNotification[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleSnooze = async (reminderId: string, minutes: number) => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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

  // Group notifications by priority
  const urgentNotifications = notifications.filter(n => n.type === 'overdue' || n.reminder.priority === 'high');
  const regularNotifications = notifications.filter(n => n.type !== 'overdue' && n.reminder.priority !== 'high');

  // Get notifications to display
  const displayNotifications = isExpanded 
    ? notifications 
    : [...urgentNotifications, ...regularNotifications].slice(0, maxDisplay);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Card className={`border-0 shadow-sm bg-white/95 backdrop-blur-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                <Bell className="w-4 h-4 text-white" />
              </div>
              {urgentNotifications.length > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                  {urgentNotifications.length}
                </div>
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Active Reminders</CardTitle>
              <p className="text-sm text-gray-600">
                {urgentNotifications.length > 0 ? `${urgentNotifications.length} urgent` : `${notifications.length} active`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {showCreateButton && onCreateReminder && (
              <Button
                size="sm"
                onClick={onCreateReminder}
                className="h-6 px-2 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Plus className="w-3 h-3 mr-1" />
                New
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {displayNotifications.map((notification) => {
            const reminder = notification.reminder;
            const TypeIcon = typeIcons[reminder.type];
            const isOverdue = notification.type === 'overdue';
            const isUrgent = isOverdue || reminder.priority === 'high';
            
            return (
              <div
                key={reminder.id}
                className={`group relative overflow-hidden rounded-lg border transition-all duration-200 hover:shadow-sm ${
                  isOverdue
                    ? 'border-red-200 bg-gradient-to-r from-red-50 to-red-100'
                    : isUrgent
                    ? 'border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${
                        isOverdue ? 'bg-red-100' : isUrgent ? 'bg-orange-100' : 'bg-blue-100'
                      }`}>
                        <TypeIcon className={`w-3 h-3 ${
                          isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm truncate max-w-[200px]">
                          {reminder.title}
                        </h4>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge className={`text-xs ${priorityColors[reminder.priority]}`}>
                            {reminder.priority}
                          </Badge>
                          {isOverdue && (
                            <Badge className="bg-red-600 text-white text-xs animate-pulse">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-2 h-2 text-blue-600" />
                      </div>
                      <span className="text-gray-700 font-medium">{reminder.leadName}</span>
                      {reminder.leadPhone && (
                        <div className="w-3 h-3 bg-green-100 rounded-full flex items-center justify-center">
                          <Phone className="w-1.5 h-1.5 text-green-600" />
                        </div>
                      )}
                      {reminder.leadPhone && (
                        <span className="text-gray-600 text-xs">{reminder.leadPhone}</span>
                      )}
                    </div>
                    
                    {reminder.description && (
                      <p className="text-xs text-gray-600 bg-white/70 rounded p-2 line-clamp-2">
                        {reminder.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className={`w-3 h-3 ${
                          isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-600'
                        }`} />
                        <span className={`font-medium ${
                          isOverdue ? 'text-red-700' : isUrgent ? 'text-orange-700' : 'text-blue-700'
                        }`}>
                          {isOverdue 
                            ? `${Math.abs(notification.minutesDiff)}m overdue`
                            : notification.minutesDiff < 60
                            ? `${notification.minutesDiff}m`
                            : `${Math.floor(notification.minutesDiff / 60)}h`
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsCompleted(reminder.id)}
                          disabled={isLoading}
                          className="h-5 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-2.5 h-2.5 mr-1" />
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSnooze(reminder.id, 30)}
                          disabled={isLoading}
                          className="h-5 px-2 text-xs"
                        >
                          <Clock className="w-2.5 h-2.5 mr-1" />
                          30m
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismiss(reminder.id)}
                          className="h-5 w-5 p-0 text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show more/less indicator */}
        {notifications.length > maxDisplay && (
          <div className="text-center pt-2">
            <div className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-1">
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Showing all {notifications.length} reminders
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  +{notifications.length - maxDisplay} more reminders
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer summary */}
        {notifications.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div>
                {urgentNotifications.length > 0 && (
                  <span className="text-red-600 font-medium">
                    {urgentNotifications.length} urgent
                  </span>
                )}
                {urgentNotifications.length > 0 && regularNotifications.length > 0 && (
                  <span className="mx-1">•</span>
                )}
                {regularNotifications.length > 0 && (
                  <span className="text-blue-600 font-medium">
                    {regularNotifications.length} regular
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900"
              >
                {isExpanded ? 'Show Less' : 'Show More'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
