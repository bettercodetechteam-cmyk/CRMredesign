import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { reminderService, Reminder } from '@/lib/reminderService';
import { 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Bell,
  PhoneCall,
  MessageSquare,
  Video,
  Users,
  Plus,
  Edit,
  Trash2,
  Clock,
  User,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CalendarViewProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ isOpen = true, onClose }) => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userProfile?.centreId) return;

    // Initialize reminder service
    reminderService.init(userProfile.centreId);
    fetchReminders();
  }, [userProfile?.centreId]);

  const fetchReminders = async () => {
    if (!userProfile?.centreId) return;

    setLoading(true);
    try {
      const remindersRef = collection(db, 'reminders');
      const q = query(remindersRef, where('centreId', '==', userProfile.centreId));
      const querySnapshot = await getDocs(q);
      
      const remindersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];

      setReminders(remindersData);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reminders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRemindersForDate = (date: Date) => {
    return reminders.filter(reminder => {
      const reminderDate = reminder.dueDate.toDate ? reminder.dueDate.toDate() : new Date(reminder.dueDate);
      return isSameDay(reminderDate, date);
    });
  };

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    
    return eachDayOfInterval({ start, end });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="w-3 h-3" />;
      case 'meeting': return <Video className="w-3 h-3" />;
      case 'followup': return <MessageSquare className="w-3 h-3" />;
      case 'admission': return <Users className="w-3 h-3" />;
      default: return <Bell className="w-3 h-3" />;
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dayReminders = getRemindersForDate(date);
    if (dayReminders.length > 0) {
      setSelectedReminder(dayReminders[0]);
      setIsReminderDialogOpen(true);
    }
  };

  const handleReminderClick = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setIsReminderDialogOpen(true);
  };

  const handleStatusChange = async (reminderId: string, newStatus: string) => {
    try {
      await reminderService.updateReminderStatus(reminderId, newStatus);
      fetchReminders();
      toast({
        title: "Success",
        description: "Reminder status updated",
      });
    } catch (error) {
      console.error('Error updating reminder status:', error);
      toast({
        title: "Error",
        description: "Failed to update reminder status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await reminderService.deleteReminder(reminderId);
      fetchReminders();
      setIsReminderDialogOpen(false);
      toast({
        title: "Success",
        description: "Reminder deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: "Error",
        description: "Failed to delete reminder",
        variant: "destructive",
      });
    }
  };

  const formatTime = (dueDate: any) => {
    if (!dueDate) return '';
    const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
    return format(date, 'HH:mm');
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendar View</h2>
          <p className="text-gray-600">View and manage reminders by date</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-6">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {getCalendarDays().map((day, index) => {
              const dayReminders = getRemindersForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[120px] p-2 border border-gray-200 cursor-pointer transition-colors",
                    !isCurrentMonth && "bg-gray-50 text-gray-400",
                    isCurrentDay && "bg-blue-50 border-blue-300",
                    isSelected && "bg-blue-100 border-blue-400",
                    "hover:bg-gray-50"
                  )}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  
                  {/* Reminders for this day */}
                  <div className="space-y-1">
                    {dayReminders.slice(0, 3).map((reminder) => (
                      <div
                        key={reminder.id}
                        className={cn(
                          "flex items-center gap-1 p-1 rounded text-xs cursor-pointer",
                          "hover:bg-white hover:shadow-sm transition-all",
                          reminder.priority === 'high' && "bg-red-50 border-l-2 border-red-500",
                          reminder.priority === 'medium' && "bg-yellow-50 border-l-2 border-yellow-500",
                          reminder.priority === 'low' && "bg-green-50 border-l-2 border-green-500"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReminderClick(reminder);
                        }}
                      >
                        <div className={cn("w-2 h-2 rounded-full", getPriorityColor(reminder.priority || 'medium'))} />
                        {getTypeIcon(reminder.type || 'other')}
                        <span className="truncate text-gray-700">
                          {reminder.title.length > 15 ? reminder.title.substring(0, 15) + '...' : reminder.title}
                        </span>
                      </div>
                    ))}
                    
                    {dayReminders.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{dayReminders.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm">Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm">Low Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reminder Detail Dialog */}
      <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedReminder && getTypeIcon(selectedReminder.type || 'other')}
              Reminder Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedReminder && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedReminder.title}</h3>
                <p className="text-gray-600">{selectedReminder.description}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">
                    {format(selectedReminder.dueDate.toDate ? selectedReminder.dueDate.toDate() : new Date(selectedReminder.dueDate), 'PPP')} at {formatTime(selectedReminder.dueDate)}
                  </span>
                </div>
                
                {selectedReminder.leadName && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{selectedReminder.leadName}</span>
                  </div>
                )}
                
                {selectedReminder.assignedTo && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Assigned to: {selectedReminder.assignedTo}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={cn(
                  selectedReminder.priority === 'high' && "bg-red-100 text-red-800",
                  selectedReminder.priority === 'medium' && "bg-yellow-100 text-yellow-800",
                  selectedReminder.priority === 'low' && "bg-green-100 text-green-800"
                )}>
                  {selectedReminder.priority || 'medium'} priority
                </Badge>
                <Badge className={cn(
                  selectedReminder.status === 'completed' && "bg-green-100 text-green-800",
                  selectedReminder.status === 'pending' && "bg-blue-100 text-blue-800",
                  selectedReminder.status === 'snoozed' && "bg-orange-100 text-orange-800"
                )}>
                  {selectedReminder.status}
                </Badge>
              </div>
              
              {selectedReminder.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700 italic">"{selectedReminder.notes}"</p>
                </div>
              )}
              
              <div className="flex items-center gap-2 pt-4 border-t">
                {selectedReminder.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange(selectedReminder.id, 'completed')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Mark Complete
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange(selectedReminder.id, 'snoozed')}
                >
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Snooze
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteReminder(selectedReminder.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
