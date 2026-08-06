import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { reminderService, Reminder } from '@/lib/reminderService';
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  Phone,
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Star,
  StarOff,
  MoreHorizontal,
  PhoneCall,
  MessageSquare,
  Video,
  Mail,
  User
} from 'lucide-react';
import { format, isToday, isTomorrow, isYesterday, addDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ReminderManagementProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const ReminderManagement: React.FC<ReminderManagementProps> = ({ isOpen = true, onClose }) => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [loading, setLoading] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(),
    status: 'pending' as const,
    priority: 'medium' as const,
    type: 'call' as const,
    notes: '',
    assignedTo: '',
    leadId: '',
    leadName: '',
    leadPhone: '',
    leadEmail: ''
  });

  useEffect(() => {
    if (!userProfile?.centreId) return;

    // Initialize reminder service
    reminderService.init(userProfile.centreId);

    // Subscribe to reminder updates
    const unsubscribe = reminderService.subscribe((notifications) => {
      // This will be handled by the reminder service
    });

    // Fetch reminders
    fetchReminders();

    return () => {
      unsubscribe();
    };
  }, [userProfile?.centreId]);

  const fetchReminders = async () => {
    if (!userProfile?.centreId) return;

    setLoading(true);
    try {
      // Get reminders from Firestore
      const remindersRef = collection(db, 'reminders');
      const q = query(remindersRef, where('centreId', '==', userProfile.centreId));
      const querySnapshot = await getDocs(q);
      
      const allReminders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];

      // Filter out processed reminders - only show active ones
      const activeReminders = allReminders.filter(reminder => 
        !reminder.processed && !reminder.hasBeenActedUpon && reminder.status !== 'completed'
      );

      setReminders(activeReminders);
      setFilteredReminders(activeReminders);
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

  useEffect(() => {
    let filtered = [...reminders];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(reminder =>
        reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reminder.leadName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reminder.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(reminder => reminder.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(reminder => reminder.priority === priorityFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(reminder => reminder.type === typeFilter);
    }

    setFilteredReminders(filtered);
  }, [reminders, searchTerm, statusFilter, priorityFilter, typeFilter]);

  const handleCreateReminder = async () => {
    if (!userProfile?.centreId) return;

    try {
      const reminderData = {
        ...formData,
        centreId: userProfile.centreId,
        createdBy: userProfile.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await reminderService.createReminder(reminderData);
      
      toast({
        title: "Success",
        description: "Reminder created successfully",
      });

      setIsCreateDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        dueDate: new Date(),
        status: 'pending',
        priority: 'medium',
        type: 'call',
        notes: '',
        assignedTo: '',
        leadId: '',
        leadName: '',
        leadPhone: '',
        leadEmail: ''
      });
      
      fetchReminders();
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast({
        title: "Error",
        description: "Failed to create reminder",
        variant: "destructive",
      });
    }
  };

  const handleEditReminder = async () => {
    if (!selectedReminder) return;

    try {
      const updateData = {
        ...formData,
        updatedAt: Timestamp.now(),
        updatedBy: userProfile?.uid
      };

      await reminderService.updateReminder(selectedReminder.id, updateData);
      
      toast({
        title: "Success",
        description: "Reminder updated successfully",
      });

      setIsEditDialogOpen(false);
      setSelectedReminder(null);
      fetchReminders();
    } catch (error) {
      console.error('Error updating reminder:', error);
      toast({
        title: "Error",
        description: "Failed to update reminder",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await reminderService.deleteReminder(reminderId);
      
      toast({
        title: "Success",
        description: "Reminder deleted successfully",
      });

      fetchReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: "Error",
        description: "Failed to delete reminder",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (reminderId: string, newStatus: string) => {
    try {
      await reminderService.updateReminderStatus(reminderId, newStatus);
      fetchReminders();
    } catch (error) {
      console.error('Error updating reminder status:', error);
      toast({
        title: "Error",
        description: "Failed to update reminder status",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'snoozed': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="w-4 h-4" />;
      case 'meeting': return <Video className="w-4 h-4" />;
      case 'followup': return <MessageSquare className="w-4 h-4" />;
      case 'admission': return <Users className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const formatDueDate = (dueDate: any) => {
    if (!dueDate) return 'No date set';
    
    const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
    
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    
    return format(date, 'MMM dd, yyyy');
  };

  const getRemindersForDate = (date: Date) => {
    const start = startOfDay(date);
    const end = endOfDay(date);
    
    return filteredReminders.filter(reminder => {
      const reminderDate = reminder.dueDate.toDate ? reminder.dueDate.toDate() : new Date(reminder.dueDate);
      return reminderDate >= start && reminderDate <= end;
    });
  };

  const openEditDialog = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setFormData({
      title: reminder.title,
      description: reminder.description,
      dueDate: reminder.dueDate.toDate ? reminder.dueDate.toDate() : new Date(reminder.dueDate),
      status: reminder.status,
      priority: reminder.priority || 'medium',
      type: reminder.type || 'call',
      notes: reminder.notes || '',
      assignedTo: reminder.assignedTo || '',
      leadId: reminder.leadId || '',
      leadName: reminder.leadName || '',
      leadPhone: reminder.leadPhone || '',
      leadEmail: reminder.leadEmail || ''
    });
    setIsEditDialogOpen(true);
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reminder Management</h2>
          <p className="text-gray-600">Manage and track all your reminders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchReminders}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reminder
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search reminders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="snoozed">Snoozed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="admission">Admission</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'calendar')}>
          <TabsList>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-sm text-gray-600">
          {filteredReminders.length} reminder{filteredReminders.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      <TabsContent value="list" className="space-y-4">
        {filteredReminders.map((reminder) => (
          <Card key={reminder.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(reminder.type || 'other')}
                    <h3 className="font-semibold text-gray-900">{reminder.title}</h3>
                    <Badge className={getPriorityColor(reminder.priority || 'medium')}>
                      {reminder.priority || 'medium'}
                    </Badge>
                    <Badge className={getStatusColor(reminder.status)}>
                      {reminder.status}
                    </Badge>
                  </div>
                  
                  <p className="text-gray-600 mb-2">{reminder.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDueDate(reminder.dueDate)}
                    </div>
                    {reminder.leadName && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {reminder.leadName}
                      </div>
                    )}
                    {reminder.assignedTo && (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {reminder.assignedTo}
                      </div>
                    )}
                  </div>
                  
                  {reminder.notes && (
                    <p className="text-sm text-gray-500 mt-2 italic">"{reminder.notes}"</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(reminder)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteReminder(reminder.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredReminders.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders found</h3>
              <p className="text-gray-600">Create your first reminder to get started</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="calendar" className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
        
        {selectedDate && (
          <Card>
            <CardHeader>
              <CardTitle>
                Reminders for {format(selectedDate, 'MMMM dd, yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getRemindersForDate(selectedDate).length > 0 ? (
                <div className="space-y-2">
                  {getRemindersForDate(selectedDate).map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(reminder.type || 'other')}
                        <div>
                          <h4 className="font-medium">{reminder.title}</h4>
                          <p className="text-sm text-gray-600">{reminder.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(reminder.priority || 'medium')}>
                          {reminder.priority || 'medium'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(reminder)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-4">No reminders for this date</p>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Create Reminder Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Reminder</DialogTitle>
            <DialogDescription>
              Add a new reminder with all the necessary details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Reminder title"
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="admission">Admission</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Reminder description"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDate ? format(formData.dueDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate}
                      onSelect={(date) => date && setFormData({...formData, dueDate: date})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Input
                  id="assignedTo"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                  placeholder="Staff member"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReminder}>
              Create Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Reminder Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
            <DialogDescription>
              Update the reminder details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Reminder title"
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="admission">Admission</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Reminder description"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-dueDate">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDate ? format(formData.dueDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate}
                      onSelect={(date) => date && setFormData({...formData, dueDate: date})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as any})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="snoozed">Snoozed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditReminder}>
              Update Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReminderManagement;
