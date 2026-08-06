import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  Phone,
  Users,
  RefreshCw,
  GraduationCap,
  Building,
  Plus,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { reminderService, Reminder } from '@/lib/reminderService';
import { useToast } from '@/hooks/use-toast';

interface ReminderIntegrationProps {
  leadId?: string;
  leadPhone?: string;
  leadName?: string;
  onCreateReminder?: () => void;
  onEditReminder?: (reminder: Reminder) => void;
  onDeleteReminder?: (reminderId: string) => void;
  className?: string;
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

export default function ReminderIntegration({
  leadId,
  leadPhone,
  leadName,
  onCreateReminder,
  onEditReminder,
  onDeleteReminder,
  className = ""
}: ReminderIntegrationProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const centreId = userProfile?.centreId;
    if (!centreId || !leadPhone) return;

    const handleReminderDataUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.centreId && detail.centreId !== centreId) return;
      if (!Array.isArray(detail?.reminders)) return;

      const filteredReminders = detail.reminders
        .filter((reminder: Reminder) => reminder.leadPhone === leadPhone)
        .map((reminder: Reminder) => ({ ...reminder, id: reminder.id }));

      filteredReminders.sort((a, b) => {
        const aDate = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate as unknown as string || 0);
        const bDate = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate as unknown as string || 0);
        return aDate.getTime() - bDate.getTime();
      });

      setReminders(filteredReminders);
    };

    window.addEventListener('reminderDataUpdated', handleReminderDataUpdated);
    return () => window.removeEventListener('reminderDataUpdated', handleReminderDataUpdated);
  }, [userProfile?.centreId, leadPhone]);

  // Handle reminder actions
  const handleMarkAsCompleted = async (reminderId: string) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const handleSnooze = async (reminderId: string, minutes: number) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  // Group reminders by status
  const pendingReminders = reminders.filter(r => r.status === 'pending');
  const completedReminders = reminders.filter(r => r.status === 'completed');
  const overdueReminders = pendingReminders.filter(r => r.dueDate.toDate() < new Date());

  if (!leadPhone) {
    return null;
  }

  return (
    <Card className={`border-0 shadow-sm bg-white/50 backdrop-blur-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Lead Reminders</CardTitle>
              <p className="text-sm text-gray-600">
                {reminders.length > 0 ? `${reminders.length} total reminders` : 'No reminders set'}
              </p>
            </div>
          </div>
          {onCreateReminder && (
            <Button
              size="sm"
              onClick={onCreateReminder}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {reminders.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders set</h3>
            <p className="text-gray-600 mb-4">Create a reminder to track follow-ups for this lead</p>
            {onCreateReminder && (
              <Button onClick={onCreateReminder}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Reminder
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overdue Reminders */}
            {overdueReminders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-red-700">Overdue</span>
                </div>
                {overdueReminders.map((reminder) => {
                  const TypeIcon = typeIcons[reminder.type];
                  return (
                    <div
                      key={reminder.id}
                      className="group relative overflow-hidden rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-red-100 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-red-100">
                              <TypeIcon className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 text-sm">
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
                        
                        {reminder.description && (
                          <p className="text-sm text-gray-600 bg-white/70 rounded p-2 mb-3">
                            {reminder.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-red-600" />
                            <span className="text-red-700 font-medium">
                              {Math.abs(Math.floor((reminder.dueDate.toDate().getTime() - new Date().getTime()) / (1000 * 60)))} minutes overdue
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsCompleted(reminder.id)}
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Done
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSnooze(reminder.id, 30)}
                              disabled={loading}
                            >
                              <Clock className="w-4 h-4 mr-1" />
                              30m
                            </Button>
                            {onEditReminder && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onEditReminder(reminder)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {onDeleteReminder && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onDeleteReminder(reminder.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending Reminders */}
            {pendingReminders.filter(r => r.dueDate.toDate() >= new Date()).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-semibold text-blue-700">Upcoming</span>
                </div>
                {pendingReminders
                  .filter(r => r.dueDate.toDate() >= new Date())
                  .map((reminder) => {
                    const TypeIcon = typeIcons[reminder.type];
                    const minutesUntilDue = Math.floor((reminder.dueDate.toDate().getTime() - new Date().getTime()) / (1000 * 60));
                    return (
                      <div
                        key={reminder.id}
                        className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-sm"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-blue-100">
                                <TypeIcon className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900 text-sm">
                                  {reminder.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className={priorityColors[reminder.priority]}>
                                    {reminder.priority}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {reminder.description && (
                            <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 mb-3">
                              {reminder.description}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-blue-600" />
                              <span className="text-blue-700 font-medium">
                                {minutesUntilDue < 60 
                                  ? `Due in ${minutesUntilDue} minutes`
                                  : `Due in ${Math.floor(minutesUntilDue / 60)} hours`
                                }
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleMarkAsCompleted(reminder.id)}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Done
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSnooze(reminder.id, 60)}
                                disabled={loading}
                              >
                                <Clock className="w-4 h-4 mr-1" />
                                1h
                              </Button>
                              {onEditReminder && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onEditReminder(reminder)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {onDeleteReminder && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onDeleteReminder(reminder.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Completed Reminders */}
            {completedReminders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-semibold text-green-700">Completed</span>
                </div>
                {completedReminders.slice(0, 3).map((reminder) => {
                  const TypeIcon = typeIcons[reminder.type];
                  return (
                    <div
                      key={reminder.id}
                      className="group relative overflow-hidden rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-green-100"
                    >
                      <div className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-green-100">
                            <TypeIcon className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {reminder.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className="bg-green-600 text-white">
                                Completed
                              </Badge>
                              <span className="text-xs text-gray-600">
                                {reminder.dueDate.toDate().toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {completedReminders.length > 3 && (
                  <div className="text-center py-2">
                    <span className="text-xs text-gray-500">
                      +{completedReminders.length - 3} more completed reminders
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
