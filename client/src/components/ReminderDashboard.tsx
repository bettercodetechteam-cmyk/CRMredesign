import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Info
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { reminderService, Reminder, ReminderStats } from '@/lib/reminderService';
import { format, isToday, isTomorrow, isPast, addDays, startOfWeek, endOfWeek } from 'date-fns';

interface ReminderDashboardProps {
  onReminderClick?: (reminder: Reminder) => void;
  onReminderEdit?: (reminder: Reminder) => void;
  onReminderDelete?: (reminderId: string) => void;
  onCreateReminder?: () => void;
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

export default function ReminderDashboard({
  onReminderClick,
  onReminderEdit,
  onReminderDelete,
  onCreateReminder
}: ReminderDashboardProps) {
  const { userProfile } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'today' | 'upcoming' | 'overdue'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Reminders from single global listener (enhancedReminderService → reminderDataUpdated)
  useEffect(() => {
    const centreId = userProfile?.centreId;
    if (!centreId) return;

    const applyReminders = (remindersData: unknown[]) => {
      const processedReminders = remindersData.map((reminder: any) => {
        const data = reminder;
        const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate || Date.now()));
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt || Date.now()));
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt || Date.now()));
        return { id: reminder.id, ...data, dueDate, createdAt, updatedAt } as Reminder;
      });

      processedReminders.sort((a, b) => {
        const aDate = a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate || 0);
        const bDate = b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate || 0);
        return aDate.getTime() - bDate.getTime();
      });

      setReminders(processedReminders);
      setStats(calculateStats(processedReminders));
    };

    const handleReminderDataUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.centreId && detail.centreId !== centreId) return;
      if (Array.isArray(detail?.reminders)) {
        applyReminders(detail.reminders);
      }
    };

    window.addEventListener('reminderDataUpdated', handleReminderDataUpdated);
    return () => window.removeEventListener('reminderDataUpdated', handleReminderDataUpdated);
  }, [userProfile?.centreId]);

  // Calculate statistics
  const calculateStats = (remindersData: Reminder[]): ReminderStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);

    // Helper function to convert dueDate to Date (handles both Timestamp and Date)
    const getDueDate = (r: Reminder): Date => {
      if (r.dueDate instanceof Date) {
        return r.dueDate;
      }
      if (r.dueDate && typeof r.dueDate === 'object' && 'toDate' in r.dueDate) {
        return (r.dueDate as any).toDate();
      }
      return new Date(r.dueDate as any);
    };

    return {
      total: remindersData.length,
      pending: remindersData.filter(r => r.status === 'pending').length,
      completed: remindersData.filter(r => r.status === 'completed').length,
      overdue: remindersData.filter(r => r.status === 'pending' && getDueDate(r) < now).length,
      today: remindersData.filter(r => {
        const dueDate = getDueDate(r);
        return dueDate >= today && dueDate < tomorrow;
      }).length,
      tomorrow: remindersData.filter(r => {
        const dueDate = getDueDate(r);
        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
        return dueDate >= tomorrow && dueDate < dayAfterTomorrow;
      }).length,
      thisWeek: remindersData.filter(r => {
        const dueDate = getDueDate(r);
        return dueDate >= weekStart && dueDate <= weekEnd;
      }).length,
      byPriority: {
        low: remindersData.filter(r => r.priority === 'low').length,
        medium: remindersData.filter(r => r.priority === 'high').length,
        high: remindersData.filter(r => r.priority === 'high').length
      },
      byType: remindersData.reduce((acc, r) => {
        acc[r.type || 'other'] = (acc[r.type || 'other'] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number }),
      byStatus: remindersData.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number })
    };
  };

  // Filtered reminders based on active tab and filters
  const filteredReminders = useMemo(() => {
    let filtered = reminders.filter(reminder => {
      const matchesSearch = searchTerm === '' || 
        reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reminder.leadName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPriority = priorityFilter === 'all' || reminder.priority === priorityFilter;
      const matchesType = typeFilter === 'all' || reminder.type === typeFilter;
      
      return matchesSearch && matchesPriority && matchesType;
    });

    // Apply tab-specific filtering
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (activeTab) {
      case 'today':
        filtered = filtered.filter(r => {
          const dueDate = r.dueDate.toDate();
          return dueDate >= today && dueDate < tomorrow;
        });
        break;
      case 'upcoming':
        filtered = filtered.filter(r => {
          const dueDate = r.dueDate.toDate();
          return dueDate >= tomorrow;
        });
        break;
      case 'overdue':
        filtered = filtered.filter(r => {
          const dueDate = r.dueDate.toDate();
          return dueDate < now && r.status === 'pending';
        });
        break;
    }

    return filtered;
  }, [reminders, activeTab, searchTerm, priorityFilter, typeFilter]);

  // Get completion percentage
  const completionPercentage = stats ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Get overdue percentage
  const overduePercentage = stats ? Math.round((stats.overdue / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reminder Dashboard</h2>
          <p className="text-gray-600 mt-1">Track and manage all your reminders</p>
        </div>
        {onCreateReminder && (
          <Button 
            onClick={onCreateReminder}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Reminder
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Reminders</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.total || 0}</p>
              </div>
              <Bell className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Completed</p>
                <p className="text-2xl font-bold text-green-900">{stats?.completed || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-orange-50 to-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Today</p>
                <p className="text-2xl font-bold text-orange-900">{stats?.today || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-red-50 to-red-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Overdue</p>
                <p className="text-2xl font-bold text-red-900">{stats?.overdue || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Completion Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Overall Progress</span>
                <span className="text-sm font-medium">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
              <div className="text-xs text-gray-500">
                {stats?.completed || 0} of {stats?.total || 0} reminders completed
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">High Priority</span>
                </div>
                <span className="text-sm font-medium">{stats?.byPriority.high || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Medium Priority</span>
                </div>
                <span className="text-sm font-medium">{stats?.byPriority.medium || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Low Priority</span>
                </div>
                <span className="text-sm font-medium">{stats?.byPriority.low || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-sm bg-white/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Reminder Management</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search reminders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="followup">Follow-up</option>
                <option value="admission">Admission</option>
                <option value="visit">Visit</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="today" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Today
                {stats?.today ? (
                  <Badge variant="secondary" className="ml-1">
                    {stats.today}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Overdue
                {stats?.overdue ? (
                  <Badge variant="destructive" className="ml-1">
                    {stats.overdue}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredReminders.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders found</h3>
                  <p className="text-gray-600">
                    {searchTerm || priorityFilter !== "all" || typeFilter !== "all"
                      ? "Try adjusting your filters or search terms"
                      : `No reminders for ${activeTab === 'overview' ? 'overview' : activeTab}`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReminders.map((reminder) => {
                    const TypeIcon = typeIcons[reminder.type];
                    const isOverdue = reminder.status === 'pending' && reminder.dueDate.toDate() < new Date();
                    
                    return (
                      <div
                        key={reminder.id}
                        className={`flex items-center justify-between p-4 bg-white rounded-lg border transition-all duration-200 hover:shadow-sm ${
                          isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${priorityColors[reminder.priority]}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {reminder.title}
                              </h4>
                              <Badge className={priorityColors[reminder.priority]}>
                                {reminder.priority}
                              </Badge>
                              <Badge className={statusColors[reminder.status]}>
                                {reminder.status.replace('_', ' ')}
                              </Badge>
                              {isOverdue && (
                                <Badge variant="destructive">Overdue</Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-1">
                              {reminder.description}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Users className="w-3 h-3" />
                                <span>{reminder.leadName}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{format(reminder.dueDate.toDate(), 'MMM d, h:mm a')}</span>
                              </div>
                              {reminder.assignedTo && (
                                <div className="flex items-center space-x-1">
                                  <Users className="w-3 h-3" />
                                  <span>{reminder.assignedTo}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {onReminderClick && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReminderClick(reminder)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {onReminderEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReminderEdit(reminder)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {onReminderDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onReminderDelete(reminder.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 