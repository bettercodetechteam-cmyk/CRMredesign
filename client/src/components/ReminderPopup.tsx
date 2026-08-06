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
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { reminderService, Reminder, ActiveNotification } from '@/lib/reminderService';
import { useToast } from '@/hooks/use-toast';

interface ReminderPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onReminderClick?: (reminder: Reminder) => void;
  onCreateReminder?: () => void;
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

export default function ReminderPopup({
  isOpen,
  onClose,
  onReminderClick,
  onCreateReminder
}: ReminderPopupProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<ActiveNotification[]>([]);

  // Subscribe to reminder notifications
  useEffect(() => {
    if (!userProfile?.centreId || !isOpen) return;

    reminderService.init(userProfile.centreId);
    
    const unsubscribe = reminderService.subscribe((activeNotifications) => {
      setNotifications(activeNotifications);
    });

    return () => unsubscribe();
  }, [userProfile?.centreId, isOpen]);

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

  // Group notifications by priority
  const urgentNotifications = notifications.filter(n => n.type === 'overdue' || n.reminder.priority === 'high');
  const regularNotifications = notifications.filter(n => n.type !== 'overdue' && n.reminder.priority !== 'high');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-white">Active Reminders</CardTitle>
                <p className="text-blue-100 text-sm">
                  {notifications.length > 0 ? `${notifications.length} active reminders` : 'No active reminders'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active reminders</h3>
              <p className="text-gray-600 mb-4">You're all caught up!</p>
              {onCreateReminder && (
                <Button onClick={onCreateReminder}>
                  Create Reminder
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Urgent Notifications */}
              {urgentNotifications.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-red-700">Urgent Reminders</span>
                  </div>
                  {urgentNotifications.map((notification) => {
                    const reminder = notification.reminder;
                    const TypeIcon = typeIcons[reminder.type];
                    const isOverdue = notification.type === 'overdue';
                    
                    return (
                      <div
                        key={reminder.id}
                        className={`group relative overflow-hidden rounded-xl border shadow-lg hover:shadow-xl transition-all duration-300 ${
                          isOverdue
                            ? 'border-red-200 bg-gradient-to-r from-red-50 to-red-100'
                            : 'border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-3 rounded-lg ${
                                isOverdue ? 'bg-red-100' : 'bg-orange-100'
                              }`}>
                                <TypeIcon className={`w-5 h-5 ${
                                  isOverdue ? 'text-red-600' : 'text-orange-600'
                                }`} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 text-lg">
                                  {reminder.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className={priorityColors[reminder.priority]}>
                                    {reminder.priority}
                                  </Badge>
                                  {isOverdue && (
                                    <Badge className="bg-red-600 text-white animate-pulse">
                                      Overdue
                                    </Badge>
                                  )}
                                  <Badge className="bg-blue-100 text-blue-800">
                                    {reminder.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <span className="font-medium text-gray-700">{reminder.leadName}</span>
                              {reminder.leadPhone && (
                                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                  <Phone className="w-3 h-3 text-green-600" />
                                </div>
                              )}
                              {reminder.leadPhone && (
                                <span className="text-gray-600">{reminder.leadPhone}</span>
                              )}
                            </div>
                            
                            {reminder.description && (
                              <p className="text-sm text-gray-600 bg-white/70 rounded-lg p-3">
                                {reminder.description}
                              </p>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className={`w-4 h-4 ${
                                  isOverdue ? 'text-red-600' : 'text-orange-600'
                                }`} />
                                <span className={`font-medium ${
                                  isOverdue ? 'text-red-700' : 'text-orange-700'
                                }`}>
                                  {isOverdue 
                                    ? `${Math.abs(notification.minutesDiff)} minutes overdue`
                                    : `Due in ${notification.minutesDiff} minutes`
                                  }
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkAsCompleted(reminder.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSnooze(reminder.id, 30)}
                                >
                                  <Clock className="w-4 h-4 mr-2" />
                                  Snooze 30m
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDismiss(reminder.id)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <X className="w-4 h-4" />
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

              {/* Regular Notifications */}
              {regularNotifications.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-blue-700">Other Reminders</span>
                  </div>
                  {regularNotifications.map((notification) => {
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
                            <div className="flex items-center gap-3">
                              <div className="p-3 rounded-lg bg-blue-100">
                                <TypeIcon className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 text-lg">
                                  {reminder.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className={priorityColors[reminder.priority]}>
                                    {reminder.priority}
                                  </Badge>
                                  <Badge className="bg-blue-100 text-blue-800">
                                    {reminder.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <span className="font-medium text-gray-700">{reminder.leadName}</span>
                              {reminder.leadPhone && (
                                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                  <Phone className="w-3 h-3 text-green-600" />
                                </div>
                              )}
                              {reminder.leadPhone && (
                                <span className="text-gray-600">{reminder.leadPhone}</span>
                              )}
                            </div>
                            
                            {reminder.description && (
                              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                                {reminder.description}
                              </p>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-blue-700">
                                  Due in {Math.floor(notification.minutesDiff / 60)} hours
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkAsCompleted(reminder.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSnooze(reminder.id, 60)}
                                >
                                  <Clock className="w-4 h-4 mr-2" />
                                  Snooze 1h
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDismiss(reminder.id)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <X className="w-4 h-4" />
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
            </div>
          )}
        </CardContent>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {urgentNotifications.length > 0 && (
                  <span className="text-red-600 font-medium">
                    {urgentNotifications.length} urgent
                  </span>
                )}
                {urgentNotifications.length > 0 && regularNotifications.length > 0 && (
                  <span className="mx-2">•</span>
                )}
                {regularNotifications.length > 0 && (
                  <span className="text-blue-600 font-medium">
                    {regularNotifications.length} regular
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onCreateReminder && (
                  <Button
                    variant="outline"
                    onClick={onCreateReminder}
                  >
                    Create New
                  </Button>
                )}
                <Button onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
