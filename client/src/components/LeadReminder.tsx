import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataSyncService } from "@/lib/dataSyncService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Calendar,
  Clock,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  Mail,
  MapPin,
  Target,
  Zap,
  Filter,
  SortAsc,
  SortDesc,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { sourceManagerEvents } from "@/lib/sourceManager";
import { firebaseListenerManager } from "@/lib/firebaseListenerManager";

// Component to display user name with async loading
const UserNameDisplay: React.FC<{
  userId?: string;
  userNames: Map<string, string>;
  setUserNames: React.Dispatch<React.SetStateAction<Map<string, string>>>;
}> = ({ userId, userNames, setUserNames }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadUserName = async () => {
      if (!userId || userNames.has(userId)) return;
      
      setIsLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userName = userData.name || userData.displayName || userData.email || 'Unknown User';
          setUserNames(prev => new Map(prev).set(userId, userName));
        } else {
          setUserNames(prev => new Map(prev).set(userId, 'Unknown User'));
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
        setUserNames(prev => new Map(prev).set(userId, 'Error Loading'));
      } finally {
        setIsLoading(false);
      }
    };

    loadUserName();
  }, [userId, userNames, setUserNames]);

  const displayName = userId ? (userNames.get(userId) || (isLoading ? 'Loading...' : 'Unknown')) : 'Unknown';

  return (
    <div className="flex items-center gap-2">
      <User className="w-4 h-4 text-gray-400" />
      <span className="text-sm">
        {displayName}
      </span>
    </div>
  );
};

interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  title: string;
  description: string;
  dueDate: Date;
  reminderTime: string;
  status: "pending" | "completed" | "overdue" | "call_made" | "meeting_scheduled" | "followup_scheduled" | "admission_processed" | "rescheduled" | "cancelled";
  priority: "low" | "medium" | "high";
  type: "call" | "meeting" | "followup" | "admission" | "visit" | "other";
  assignedTo: string;
  notes?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  processed?: boolean; // Whether the reminder has been processed by any user
  processedAt?: Date; // When it was processed
  processedBy?: string; // Who processed it
  hasBeenActedUpon?: boolean; // Whether any action has been taken on this reminder
  lastAction?: {
    status: string;
    timestamp: Date;
    userId: string;
    remarks?: string;
  };
}

// Add new interface for status update dialog
interface StatusUpdateData {
  reminderId: string;
  newStatus: string;
  notes: string;
  updateLeadStatus: boolean;
  newLeadStatus?: string;
}

interface Lead {
  id: string;
  name?: string;
  leadName?: string;
  phone?: string;
  contact?: string;
  email?: string;
  emailId?: string;
  status: string;
  assignedTo?: string;
  source?: string;
  course?: string;
  cityArea?: string;
  counselorName?: string;
  followUpDate?: string | Date;
  visitDate?: string | Date;
  callDate?: string | Date;
  admissionDate?: string | Date;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt?: string | Date;
  updatedAt?: string | Date;
  remark?: string;
  feedbackCallRemarks?: string;
  centreHeadRemarks?: string;
  lastReminderStatus?: string;
  lastReminderType?: string;
  lastReminderUpdate?: any;
  lastCallStatus?: string;
  lastVisitStatus?: string;
  lastFollowupStatus?: string;
  lastAdmissionStatus?: string;
}

interface LeadReminderProps {
  leads: Lead[];
}

const reminderTypes = [
  { value: "call", label: "Call", icon: Phone },
  { value: "meeting", label: "Meeting", icon: Calendar },
  { value: "followup", label: "Follow-up", icon: Target },
  { value: "admission", label: "Admission", icon: CheckCircle },
  { value: "visit", label: "Visit", icon: User },
  { value: "other", label: "Other", icon: Bell },
];

// Add status mapping for different reminder types
const reminderStatusMapping = {
  call: {
    completed: "Contacted",
    call_made: "Contacted", 
    meeting_scheduled: "Visit Scheduled",
    followup_scheduled: "Interested",
    admission_processed: "Admission Done",
    cancelled: "Not Interested"
  },
  meeting: {
    completed: "Visit Completed",
    call_made: "Contacted",
    meeting_scheduled: "Visit Scheduled", 
    followup_scheduled: "Interested",
    admission_processed: "Admission Done",
    cancelled: "Not Interested"
  },
  visit: {
    completed: "Visit Completed",
    call_made: "Contacted", 
    meeting_scheduled: "Visit Scheduled",
    followup_scheduled: "Interested",
    admission_processed: "Admission Done",
    cancelled: "Not Interested"
  },
  followup: {
    completed: "Interested",
    call_made: "Contacted",
    meeting_scheduled: "Visit Scheduled",
    followup_scheduled: "Interested", 
    admission_processed: "Admission Done",
    cancelled: "Not Interested"
  },
  admission: {
    completed: "Admission Done",
    call_made: "Contacted",
    meeting_scheduled: "Visit Scheduled",
    followup_scheduled: "Interested",
    admission_processed: "Admission Done",
    cancelled: "Not Interested"
  },
  other: {
    completed: "Interested",
    call_made: "Contacted",
    meeting_scheduled: "Visit Scheduled", 
    followup_scheduled: "Interested",
    admission_processed: "Admission Done",
    cancelled: "Not Interested"
  }
};

const priorities = [
  { value: "low", label: "Low", color: "bg-green-100 text-green-800" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: "high", label: "High", color: "bg-red-100 text-red-800" },
];

export default function LeadReminder({ leads }: LeadReminderProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [processedReminders, setProcessedReminders] = useState<Reminder[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStatusUpdateDialogOpen, setIsStatusUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<string | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [statusUpdateData, setStatusUpdateData] = useState<StatusUpdateData>({
    reminderId: "",
    newStatus: "",
    notes: "",
    updateLeadStatus: true,
    newLeadStatus: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortField, setSortField] = useState("dueDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  // Function to resolve user ID to name
  const resolveUserName = async (userId: string): Promise<string> => {
    if (!userId) return 'Unknown';
    
    // Check if we already have the name cached
    if (userNames.has(userId)) {
      return userNames.get(userId) || 'Unknown';
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userName = userData.name || userData.displayName || userData.email || 'Unknown User';
        
        // Cache the result
        setUserNames(prev => new Map(prev).set(userId, userName));
        return userName;
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
    
    return 'Unknown User';
  };

  const { toast } = useToast();
  const { userProfile } = useAuth();

  // Subscribe to data sync events for real-time updates
  useEffect(() => {
    const unsubscribeLead = dataSyncService.subscribe('lead', (event) => {
      console.log('⏰ LeadReminder: Lead sync event received:', event);
      // Trigger refresh when lead data changes
      if (event.action === 'updated' || event.action === 'deleted') {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    const unsubscribeReminder = dataSyncService.subscribe('reminder', (event) => {
      console.log('⏰ LeadReminder: Follow-up reminder sync event received:', event);
      // Trigger refresh when reminder data changes
      if (event.action === 'updated' || event.action === 'deleted' || event.action === 'created') {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    const unsubscribeStatus = dataSyncService.subscribe('status', (event) => {
      console.log('⏰ LeadReminder: Status sync event received:', event);
      // Trigger refresh when status changes
      if (event.action === 'updated') {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    const unsubscribeSource = sourceManagerEvents.subscribe((event) => {
      console.log('⏰ LeadReminder: Source update received:', event.detail);
      // Trigger refresh when a new source is added
      if (event.detail.newSource) {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    // Add event listeners for custom events from Leads component
    const handleLeadDataUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('⏰ LeadReminder: Lead data update event received:', detail);
      
      if (detail && detail.action === 'deleted' && detail.leadId) {
        // Remove reminders for the deleted lead from local state
        setReminders(prev => prev.filter(reminder => reminder.leadId !== detail.leadId));
      } else if (detail && !detail.preventRefresh) {
        // Trigger refresh for other updates
        setRefreshTrigger(prev => prev + 1);
      }
    };

    const handleReminderUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('⏰ LeadReminder: Follow-up reminder update event received:', detail);
      
      if (detail && detail.action === 'deleted' && detail.leadId) {
        // Remove reminders for the deleted lead from local state
        setReminders(prev => prev.filter(reminder => reminder.leadId !== detail.leadId));
      } else if (detail && !detail.preventRefresh) {
        // Trigger refresh for other updates
        setRefreshTrigger(prev => prev + 1);
      }
    };

    const handleCalendarUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('⏰ LeadReminder: Calendar update event received:', detail);
      
      if (detail && detail.action === 'deleted' && detail.leadId) {
        // Remove reminders for the deleted lead from local state
        setReminders(prev => prev.filter(reminder => reminder.leadId !== detail.leadId));
      } else if (detail && !detail.preventRefresh) {
        // Trigger refresh for other updates
        setRefreshTrigger(prev => prev + 1);
      }
    };

    // Add event listeners
    window.addEventListener('leadDataUpdated', handleLeadDataUpdate);
    window.addEventListener('reminderUpdated', handleReminderUpdate);
    window.addEventListener('calendarUpdated', handleCalendarUpdate);

    return () => {
      unsubscribeLead();
      unsubscribeReminder();
      unsubscribeStatus();
      unsubscribeSource();
      window.removeEventListener('leadDataUpdated', handleLeadDataUpdate);
      window.removeEventListener('reminderUpdated', handleReminderUpdate);
      window.removeEventListener('calendarUpdated', handleCalendarUpdate);
    };
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    leadId: "",
    title: "",
    description: "",
    dueDate: "",
    reminderTime: "09:00",
    priority: "medium",
    type: "followup",
    assignedTo: "",
  });

  // Load reminders from Firebase using centralized listener manager
  useEffect(() => {
    if (!userProfile?.centreId) return;

    // Use centralized listener manager to prevent duplicate listeners
    const unsubscribe = firebaseListenerManager.subscribe(
      'reminders',
      (remindersData) => {
        // Process reminders data (same as before)
        const allRemindersData = remindersData.map((reminder: any) => {
          const data = reminder;
          const reminderData = {
            id: reminder.id,
            ...data,
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate || Date.now())),
            reminderTime: data.reminderTime || '09:00', // Default time for existing reminders
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt || Date.now())),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt || Date.now())),
            processedAt: data.processedAt?.toDate ? data.processedAt.toDate() : (data.processedAt instanceof Date ? data.processedAt : (data.processedAt ? new Date(data.processedAt) : null)),
          };
          
          // Debug logging for reminders with invalid dates
          if (!reminderData.dueDate || isNaN(reminderData.dueDate.getTime())) {
            console.warn('⚠️ Follow-up reminder with invalid dueDate:', {
              id: reminder.id,
              originalDueDate: data.dueDate,
              processedDueDate: reminderData.dueDate,
              reminderTime: reminderData.reminderTime
            });
          }
          
          return reminderData;
        });

        // Separate active and processed reminders (same as before)
        const activeReminders = allRemindersData.filter(reminder => 
          !reminder.processed && !reminder.hasBeenActedUpon && reminder.status !== 'completed'
        );
        const processedRemindersData = allRemindersData.filter(reminder =>
          reminder.processed || reminder.hasBeenActedUpon || reminder.status === 'completed'
        );

        // Sort by follow-up reminder date on the client side (same as before)
        activeReminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        processedRemindersData.sort((a, b) => {
          const aTime = (a.processedAt || a.updatedAt)?.getTime() || 0;
          const bTime = (b.processedAt || b.updatedAt)?.getTime() || 0;
          return bTime - aTime;
        });

        setReminders(activeReminders);
        setProcessedReminders(processedRemindersData);
      },
      { 
        centreId: userProfile.centreId
        // No limit - as requested by user
      }
    );

    return () => unsubscribe();
  }, [userProfile?.centreId, toast, refreshTrigger]);

  // Filter and sort follow-up reminders
  const filteredReminders = reminders.filter((reminder) => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reminder.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reminder.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || reminder.status === statusFilter;
    const matchesType = typeFilter === "all" || reminder.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const sortedReminders = [...filteredReminders].sort((a, b) => {
    let aValue: any = a[sortField as keyof Reminder];
    let bValue: any = b[sortField as keyof Reminder];

    if (sortField === "dueDate") {
      aValue = a.dueDate;
      bValue = b.dueDate;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Filter and sort processed reminders
  const filteredProcessedReminders = processedReminders.filter((reminder) => {
    const matchesSearch = reminder.title.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      reminder.leadName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      reminder.description.toLowerCase().includes(historySearchTerm.toLowerCase());
    
    const matchesStatus = historyStatusFilter === "all" || reminder.status === historyStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedProcessedReminders = [...filteredProcessedReminders].sort((a, b) => {
    const aDate = a.processedAt || a.updatedAt;
    const bDate = b.processedAt || b.updatedAt;
    return bDate.getTime() - aDate.getTime(); // Most recent first
  });

  const handleCreateReminder = async () => {
    if (!formData.leadId || !formData.dueDate) {
      toast({
        title: "Validation Error",
        description: "Please select a lead and set a follow-up date",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const selectedLead = leads.find(lead => lead.id === formData.leadId);
      
      if (!selectedLead) {
        toast({
          title: "Error",
          description: "Selected lead not found",
          variant: "destructive",
        });
        return;
      }

      const reminderDateTime = new Date(`${formData.dueDate}T09:00`); // Default to 9 AM
      
      // Validate that the reminder date is in the future
      if (reminderDateTime <= new Date()) {
        toast({
          title: "Invalid Date",
          description: "Follow-up date must be in the future",
          variant: "destructive",
        });
        return;
      }

      const reminderData = {
        leadId: formData.leadId,
        leadName: selectedLead.name || selectedLead.leadName || '',
        leadPhone: selectedLead.phone || selectedLead.contact || '',
        leadEmail: selectedLead.email || selectedLead.emailId || '',
        title: `Follow up - ${selectedLead.name || selectedLead.leadName || 'New Lead'}`,
        description: formData.description || '',
        dueDate: Timestamp.fromDate(reminderDateTime),
        reminderTime: '09:00',
        status: "pending" as const,
        priority: "medium" as const,
        type: formData.type as "call" | "meeting" | "followup" | "admission" | "other",
        assignedTo: userProfile?.name || "Unassigned",
        centreId: userProfile?.centreId || "demo-centre-001",
        createdBy: userProfile?.uid || "unknown",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notificationSent: false,
      };

      const docRef = await addDoc(collection(db, "reminders"), reminderData);

      // Dispatch global event for component synchronization
      window.dispatchEvent(new CustomEvent('reminderUpdated', {
        detail: {
          reminder: { id: docRef.id, ...reminderData },
          action: 'created'
        }
      }));

      toast({
        title: "Success",
        description: `Follow-up reminder created successfully for ${selectedLead.name || selectedLead.leadName || 'the lead'}`,
      });

      // Reset form
      setFormData({
        leadId: "",
        title: "",
        description: "",
        dueDate: "",
        reminderTime: "09:00",
        priority: "medium",
        type: "followup",
        assignedTo: "",
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating follow-up reminder:", error);
      toast({
        title: "Error",
        description: "Failed to create follow-up reminder",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReminder = async () => {
    if (!selectedReminder) return;

    try {
      setLoading(true);
      const reminderRef = doc(db, "reminders", selectedReminder.id);
      
      // Check if date has changed
      const newDueDate = new Date(`${formData.dueDate}T09:00`);
      const originalDueDate = selectedReminder.dueDate;
      const dateChanged = newDueDate.toDateString() !== originalDueDate.toDateString();
      
      const updates = {
        title: `Follow up - ${selectedReminder.leadName || 'New Lead'}`,
        description: formData.description,
        dueDate: Timestamp.fromDate(newDueDate),
        reminderTime: '09:00',
        priority: "medium" as const,
        type: formData.type as "call" | "meeting" | "followup" | "admission" | "other",
        assignedTo: userProfile?.name || "Unassigned",
        updatedAt: Timestamp.now(),
        // If date changed, reset status to pending and clear notification flags
        ...(dateChanged && {
          status: "pending" as const,
          notificationSent: false,
          notificationSentAt: null
        })
      };

      await updateDoc(reminderRef, updates);

      // If date changed, trigger reminder rescheduling
      if (dateChanged) {
        console.log('🔄 Follow-up date changed, triggering reschedule for:', selectedReminder.title);
        
        // Dispatch event to trigger reminder service rescheduling
        window.dispatchEvent(new CustomEvent('reminderRescheduled', {
          detail: {
            reminderId: selectedReminder.id,
            newDueDate: newDueDate,
            action: 'rescheduled'
          }
        }));

        // Force refresh of reminder service
        if (userProfile?.centreId) {
          // Trigger reminder service refresh
          window.dispatchEvent(new CustomEvent('reminderServiceRefresh', {
            detail: { centreId: userProfile.centreId }
          }));
        }
      }

      // Dispatch global event for component synchronization
      window.dispatchEvent(new CustomEvent('reminderUpdated', {
        detail: {
          reminder: { id: selectedReminder.id, ...updates },
          action: 'updated'
        }
      }));

      toast({
        title: "Success",
        description: dateChanged 
          ? "Follow-up reminder updated and rescheduled successfully" 
          : "Follow-up reminder updated successfully",
      });

      setIsEditDialogOpen(false);
      setSelectedReminder(null);
    } catch (error) {
      console.error("Error updating follow-up reminder:", error);
      toast({
        title: "Error",
        description: "Failed to update follow-up reminder",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      console.log('🗑️ Starting follow-up reminder deletion process for:', reminderId);
      
      // First, check if the reminder exists
      const reminderRef = doc(db, "reminders", reminderId);
      console.log('🔍 Checking if follow-up reminder exists in Firebase...');
      const reminderDoc = await getDoc(reminderRef);
      
      if (!reminderDoc.exists()) {
        console.warn('⚠️ Follow-up reminder not found for deletion:', reminderId);
        toast({
          title: "Warning",
          description: "Follow-up reminder not found or already deleted.",
          variant: "destructive",
        });
        return;
      }
      
      const reminderData = reminderDoc.data();
      const leadId = reminderData.leadId;
      console.log('✅ Follow-up reminder found, proceeding with deletion. Lead ID:', leadId);
      
      // Update local state immediately to prevent UI flicker
      setReminders(prev => {
        const filtered = prev.filter(reminder => reminder.id !== reminderId);
        console.log('🔄 Updated local state immediately, remaining follow-up reminders:', filtered.length);
        return filtered;
      });
      
      // Delete the reminder from Firebase
      console.log('🗑️ Deleting follow-up reminder from Firebase...');
      await deleteDoc(reminderRef);
      console.log('✅ Successfully deleted follow-up reminder from Firebase:', reminderId);
      
      // Trigger data sync service to handle the deletion
      if (dataSyncService) {
        console.log('🔄 Triggering data sync service for deletion...');
        dataSyncService.handleDataSync({
          type: 'reminder',
          action: 'deleted',
          data: { reminder: { id: reminderId, ...reminderData }, changeType: 'removed' },
          timestamp: Date.now(),
          source: 'manual_deletion',
          leadId: leadId
        });
      }
      
      // Dispatch events to notify other components
      if (leadId) {
        const deleteEventDetail = {
          leadId,
          reminderId,
          action: 'deleted',
          timestamp: Date.now(),
          source: 'follow-up-reminder',
          preventRefresh: true
        };
        
        console.log('📡 Dispatching follow-up reminder delete events:', deleteEventDetail);
        
        // Dispatch events immediately and with a delay to ensure all components are notified
        window.dispatchEvent(new CustomEvent('reminderUpdated', {
          detail: deleteEventDetail
        }));
        
        window.dispatchEvent(new CustomEvent('leadDataUpdated', {
          detail: deleteEventDetail
        }));
        
        window.dispatchEvent(new CustomEvent('calendarUpdated', {
          detail: deleteEventDetail
        }));
        
        // Also dispatch to data sync service for comprehensive synchronization
        if (dataSyncService) {
          dataSyncService.handleDataSync({
            type: 'reminder',
            action: 'deleted',
            data: { reminder: { id: reminderId, ...reminderData }, changeType: 'removed' },
            timestamp: Date.now(),
            source: 'follow-up-reminder-deletion',
            leadId: leadId
          });
        }
        
        // Dispatch delayed events to ensure Firebase has processed the deletion
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('reminderUpdated', {
            detail: { ...deleteEventDetail, delayed: true }
          }));
          
          window.dispatchEvent(new CustomEvent('leadDataUpdated', {
            detail: { ...deleteEventDetail, delayed: true }
          }));
          
          window.dispatchEvent(new CustomEvent('calendarUpdated', {
            detail: { ...deleteEventDetail, delayed: true }
          }));
        }, 500);
      }
      
      console.log('✅ Follow-up reminder deletion process completed successfully');
      toast({
        title: "Success",
        description: "Follow-up reminder deleted successfully",
      });
    } catch (error) {
      console.error("❌ Error deleting follow-up reminder:", error);
      
      // Revert local state if deletion failed
      setRefreshTrigger(prev => prev + 1);
      
      // Show more specific error message
      let errorMessage = "Failed to delete follow-up reminder. Please try again.";
      if (error instanceof Error) {
        console.error("❌ Error details:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        if (error.message.includes('permission')) {
          errorMessage = "You don't have permission to delete this follow-up reminder.";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('not-found')) {
          errorMessage = "Follow-up reminder not found or already deleted.";
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };



  const handleReminderStatusUpdate = (reminderId: string, newStatus: string) => {
    // Update local state
    setReminders(prev => 
      prev.map(reminder => 
        reminder.id === reminderId ? { ...reminder, status: newStatus as any } : reminder
      )
    );
  };

  const handleLeadStatusUpdate = (leadId: string, newStatus: string) => {
    // This will be handled by the parent component through data sync
    console.log('Lead status updated:', { leadId, newStatus });
  };

  const handleEditReminder = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setFormData({
      leadId: reminder.leadId,
      title: reminder.title,
      description: reminder.description,
      dueDate: reminder.dueDate.toISOString().split('T')[0],
      reminderTime: '09:00',
      priority: 'medium',
      type: reminder.type,
      assignedTo: reminder.assignedTo,
    });
    setIsEditDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "call_made":
        return "bg-blue-100 text-blue-800";
      case "meeting_scheduled":
        return "bg-purple-100 text-purple-800";
      case "followup_scheduled":
        return "bg-orange-100 text-orange-800";
      case "admission_processed":
        return "bg-indigo-100 text-indigo-800";
      case "rescheduled":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    return priorities.find(p => p.value === priority)?.color || "bg-gray-100 text-gray-800";
  };

  const formatDateTime = (date: Date, time?: string) => {
    try {
      // Ensure date is a valid Date object
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        console.error('Invalid date in formatDateTime:', date);
        return 'Invalid Date';
      }
      
      // If no time provided, just format the date
      if (!time || time === '') {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        });
      }
      
      // Create a new date with the time
      const dateTime = new Date(`${date.toISOString().split('T')[0]}T${time}`);
      
      // Check if the resulting date is valid
      if (isNaN(dateTime.getTime())) {
        console.error('Invalid dateTime after combining date and time:', dateTime, 'date:', date, 'time:', time);
        // Fallback to just the date
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        });
      }
      
      return dateTime.toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error in formatDateTime:', error, 'date:', date, 'time:', time);
      // Fallback to just the date
      if (date && !isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        });
      }
      return 'Invalid Date';
    }
  };

  const isOverdue = (reminder: Reminder) => {
    const now = new Date();
    const reminderDateTime = new Date(`${reminder.dueDate.toISOString().split('T')[0]}T${reminder.reminderTime}`);
    return reminderDateTime < now && reminder.status === "pending";
  };

  // Get selected lead name for display
  const getSelectedLeadName = () => {
    const selectedLead = leads.find(lead => lead.id === formData.leadId);
    const leadName = selectedLead?.name || selectedLead?.leadName || '';
    const leadPhone = selectedLead?.phone || selectedLead?.contact || '';
    return selectedLead ? `${leadName} - ${leadPhone}` : "Choose a lead";
  };

  // Enhanced status update handler with lead synchronization
  const handleStatusUpdate = async (reminderId: string, newStatus: string, notes: string = "", updateLeadStatus: boolean = true) => {
    try {
      setLoading(true);
      const reminder = reminders.find(r => r.id === reminderId);
      if (!reminder) {
        toast({
          title: "Error",
          description: "Reminder not found",
          variant: "destructive",
        });
        return;
      }

      console.log('🔄 Updating reminder status:', { reminderId, newStatus, notes, updateLeadStatus });

      // Update reminder status
      const reminderRef = doc(db, "reminders", reminderId);
      const reminderUpdates = {
        status: newStatus as any,
        notes: notes,
        updatedAt: Timestamp.now(),
        updatedBy: userProfile?.uid || "unknown",
        // Mark reminder as processed so it moves to history
        processed: true,
        processedAt: Timestamp.now(),
        processedBy: userProfile?.uid || "unknown",
        hasBeenActedUpon: true,
        lastAction: {
          status: newStatus,
          timestamp: Timestamp.now(),
          userId: userProfile?.uid || "unknown",
          remarks: notes || ""
        }
      };

      await updateDoc(reminderRef, reminderUpdates);
      console.log('✅ Reminder status updated in Firebase');

      // Update lead status if requested
      if (updateLeadStatus && reminder.leadId) {
        const leadRef = doc(db, "leads", reminder.leadId);
        const leadUpdates: any = {
          updatedAt: Timestamp.now(),
          updatedBy: userProfile?.uid || "unknown",
          lastReminderUpdate: Timestamp.now(),
          lastReminderStatus: newStatus,
          lastReminderType: reminder.type
        };

        // Map reminder status to lead status based on reminder type
        const statusMapping = reminderStatusMapping[reminder.type as keyof typeof reminderStatusMapping];
        if (statusMapping && statusMapping[newStatus as keyof typeof statusMapping]) {
          leadUpdates.status = statusMapping[newStatus as keyof typeof statusMapping];
          console.log('📊 Mapped reminder status to lead status:', { 
            reminderType: reminder.type, 
            reminderStatus: newStatus, 
            leadStatus: leadUpdates.status 
          });
        }

        // Add specific date fields based on reminder type and status
        const now = Timestamp.now();
        switch (reminder.type) {
          case "call":
            if (newStatus === "call_made" || newStatus === "completed") {
              leadUpdates.callDate = now;
              leadUpdates.lastCallStatus = newStatus;
            }
            break;
          case "visit":
          case "meeting":
            if (newStatus === "meeting_scheduled") {
              leadUpdates.visitDate = reminder.dueDate;
              leadUpdates.lastVisitStatus = "scheduled";
            } else if (newStatus === "completed") {
              leadUpdates.visitDate = now;
              leadUpdates.lastVisitStatus = "completed";
            }
            break;
          case "followup":
            if (newStatus === "followup_scheduled") {
              leadUpdates.followUpDate = reminder.dueDate;
              leadUpdates.lastFollowupStatus = "scheduled";
            } else if (newStatus === "completed") {
              leadUpdates.followUpDate = now;
              leadUpdates.lastFollowupStatus = "completed";
            }
            break;
          case "admission":
            if (newStatus === "admission_processed" || newStatus === "completed") {
              leadUpdates.admissionDate = now;
              leadUpdates.lastAdmissionStatus = newStatus;
            }
            break;
        }

        // Add notes to lead if provided
        if (notes) {
          switch (reminder.type) {
            case "call":
              leadUpdates.feedbackCallRemarks = notes;
              break;
            case "followup":
              leadUpdates.followUpNotes = notes;
              break;
            default:
              leadUpdates.remark = notes;
              break;
          }
        }

        await updateDoc(leadRef, leadUpdates);
        console.log('✅ Lead status updated in Firebase:', leadUpdates);

        // Dispatch comprehensive sync events
        dataSyncService.syncLeadData(reminder.leadId, leadUpdates);
        dataSyncService.syncStatusUpdate(reminder.leadId, leadUpdates.status);
        dataSyncService.forceRefresh('calendar');

        // Dispatch global events for immediate UI updates
        window.dispatchEvent(new CustomEvent('leadDataUpdated', {
          detail: {
            leadId: reminder.leadId,
            updates: leadUpdates,
            action: 'updated',
            source: 'reminder',
            timestamp: Date.now()
          }
        }));

        window.dispatchEvent(new CustomEvent('statusUpdated', {
          detail: {
            leadId: reminder.leadId,
            newStatus: leadUpdates.status,
            action: 'updated',
            source: 'reminder',
            timestamp: Date.now()
          }
        }));

        window.dispatchEvent(new CustomEvent('reminderUpdated', {
          detail: {
            reminderId: reminderId,
            newStatus: newStatus,
            leadId: reminder.leadId,
            action: 'updated',
            source: 'reminder',
            timestamp: Date.now()
          }
        }));

        toast({
          title: "Success",
          description: `Follow-up status updated and lead status synchronized to "${leadUpdates.status}"`,
        });
      } else {
        toast({
          title: "Success", 
          description: "Follow-up status updated successfully",
        });
      }

      // Update local state
      setReminders(prev => 
        prev.map(r => 
          r.id === reminderId 
            ? { ...r, status: newStatus as any, notes: notes, updatedAt: new Date() }
            : r
        )
      );

      setIsStatusUpdateDialogOpen(false);
      setSelectedReminder(null);
      setStatusUpdateData({
        reminderId: "",
        newStatus: "",
        notes: "",
        updateLeadStatus: true,
        newLeadStatus: ""
      });

    } catch (error) {
      console.error("Error updating reminder status:", error);
      toast({
        title: "Error",
        description: "Failed to update follow-up status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open status update dialog
  const openStatusUpdateDialog = (reminder: Reminder) => {
    console.log('Opening status update dialog for reminder:', reminder);
    setSelectedReminder(reminder);
    setStatusUpdateData({
      reminderId: reminder.id,
      newStatus: reminder.status,
      notes: reminder.notes || "",
      updateLeadStatus: true,
      newLeadStatus: ""
    });
    setIsStatusUpdateDialogOpen(true);
  };

  // Get suggested lead status based on reminder type and status
  const getSuggestedLeadStatus = (reminderType: string, reminderStatus: string) => {
    const statusMapping = reminderStatusMapping[reminderType as keyof typeof reminderStatusMapping];
    return statusMapping ? statusMapping[reminderStatus as keyof typeof statusMapping] : "Other";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Follow-up Reminders
          </h2>
          <p className="text-gray-600 mt-1">
            Manage and track lead follow-ups with simplified reminders
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Follow-up Reminder
              </DialogTitle>
              <DialogDescription>
                Set a reminder to follow up with this lead. This will automatically sync with your calendar and reminder system.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-pink-50 p-6 rounded-lg space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enableReminder"
                  checked={true}
                  className="rounded"
                />
                <Label htmlFor="enableReminder">Enable Follow-up Reminder</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="leadId">Select Lead *</Label>
                <Popover open={leadSearchOpen} onOpenChange={setLeadSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={leadSearchOpen}
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {getSelectedLeadName()}
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search leads..." />
                      <CommandList>
                        <CommandEmpty>No lead found.</CommandEmpty>
                        <CommandGroup>
                          {leads.map((lead) => (
                            <CommandItem
                              key={lead.id}
                              value={`${lead.name || lead.leadName || ''} ${lead.phone || lead.contact || ''} ${lead.email || lead.emailId || ''}`}
                              onSelect={() => {
                                setFormData({ ...formData, leadId: lead.id });
                                setLeadSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.leadId === lead.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">{lead.name || lead.leadName}</div>
                                  <div className="text-sm text-gray-500">{lead.phone || lead.contact}</div>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="followUpDate" className="flex items-center">
                    Follow-up Date <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="followUpDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      placeholder="dd-mm-yyyy"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reminderType">Reminder Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="followup">Follow-up Call</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="visit">Visit</SelectItem>
                      <SelectItem value="admission">Admission</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reminderNotes">Reminder Notes</Label>
                <Textarea
                  id="reminderNotes"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add notes for the follow-up reminder..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div className="bg-pink-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-red-500" />
                  <span className="font-medium">Reminder Preview:</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Title:</span> Follow up - {formData.leadId ? 'Selected Lead' : 'New Lead'}</div>
                  <div><span className="font-medium">Date:</span> {formData.dueDate || 'Not set'}</div>
                  <div><span className="font-medium">Type:</span> {formData.type}</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReminder} disabled={loading}>
                {loading ? "Creating..." : "Create Reminder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search follow-up reminders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="call_made">Call Made</SelectItem>
                <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                <SelectItem value="followup_scheduled">Follow-up Scheduled</SelectItem>
                <SelectItem value="admission_processed">Admission Processed</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="visit">Visit</SelectItem>
                <SelectItem value="admission">Admission</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Reminders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Follow-up Reminders ({sortedReminders.length})</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
              >
                {sortDirection === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedReminders.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No follow-up reminders found</p>
              <p className="text-sm text-gray-400 mt-2">
                Create your first follow-up reminder by clicking the "Create Follow-up" button above
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                                 <TableHeader>
                   <TableRow>
                     <TableHead>Lead</TableHead>
                     <TableHead>Follow-up Title</TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>Date</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Last Updated</TableHead>
                     <TableHead>Assigned To</TableHead>
                     <TableHead>Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {sortedReminders.map((reminder) => {
                    const TypeIcon = reminderTypes.find(t => t.value === reminder.type)?.icon || Bell;
                    const isOverdueReminder = isOverdue(reminder);
                    
                    return (
                      <TableRow key={reminder.id} className={isOverdueReminder ? "bg-red-50" : ""}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{reminder.leadName}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {reminder.leadPhone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="font-medium">{reminder.title}</div>
                            {reminder.description && (
                              <div className="text-sm text-gray-500 truncate">
                                {reminder.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="w-4 h-4" />
                            <span className="capitalize">{reminder.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {reminder.dueDate.toLocaleDateString()}
                            </div>
                            {isOverdueReminder && (
                              <div className="text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Overdue
                              </div>
                            )}
                            {/* Show rescheduled indicator if reminder was recently updated */}
                            {reminder.updatedAt && 
                             new Date(reminder.updatedAt).getTime() > Date.now() - (24 * 60 * 60 * 1000) && 
                             reminder.status === "pending" && (
                              <div className="text-xs text-blue-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Recently Updated
                              </div>
                            )}
                          </div>
                        </TableCell>
                                                 <TableCell>
                           <Badge className={getStatusColor(reminder.status)}>
                             {reminder.status}
                           </Badge>
                         </TableCell>
                         <TableCell>
                           <div className="text-sm text-gray-600">
                             {reminder.updatedAt ? new Date(reminder.updatedAt).toLocaleDateString() : 'Never'}
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <User className="w-4 h-4 text-gray-400" />
                             {reminder.assignedTo}
                           </div>
                         </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStatusUpdateDialog(reminder)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditReminder(reminder)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReminderToDelete(reminder.id);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Edit Follow-up Reminder
            </DialogTitle>
            <DialogDescription>
              Update the follow-up reminder details and date.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-pink-50 p-6 rounded-lg space-y-4">
            {/* Show selected lead info */}
            <div className="p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">Selected Lead:</span>
                <span className="text-gray-700">{getSelectedLeadName()}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editType">Reminder Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="followup">Follow-up Call</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="visit">Visit</SelectItem>
                    <SelectItem value="admission">Admission</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDueDate">Follow-up Date</Label>
                <Input
                  id="editDueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editDescription">Reminder Notes</Label>
              <Textarea
                id="editDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Add notes for the follow-up reminder..."
              />
            </div>
            
            {/* Show warning if date will change */}
            {selectedReminder && (() => {
              const newDueDate = new Date(`${formData.dueDate}T09:00`);
              const originalDueDate = selectedReminder.dueDate;
              const dateChanged = newDueDate.toDateString() !== originalDueDate.toDateString();
              
              return dateChanged ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Reminder will be rescheduled</span>
                  </div>
                  <div className="text-sm text-blue-600 mt-1">
                    <div>Original: {originalDueDate.toLocaleDateString()}</div>
                    <div>New: {newDueDate.toLocaleDateString()}</div>
                    <div className="mt-2">Changing the date will reset the reminder status to "pending" and reschedule the notification.</div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
              </Button>
            <Button onClick={handleUpdateReminder} disabled={loading}>
              {loading ? "Updating..." : "Update Reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={isStatusUpdateDialogOpen} onOpenChange={setIsStatusUpdateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Update Follow-up Status
            </DialogTitle>
            <DialogDescription>
              Update the follow-up reminder status and optionally sync the lead status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Reminder Info */}
            {selectedReminder && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Lead:</span> {selectedReminder.leadName}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedReminder.type}
                  </div>
                  <div>
                    <span className="font-medium">Current Status:</span> {selectedReminder.status}
                  </div>
                  <div>
                    <span className="font-medium">Due Date:</span> {selectedReminder.dueDate.toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}

            {/* Status Selection */}
            <div className="space-y-2">
              <Label htmlFor="statusSelect">New Follow-up Status</Label>
              <Select 
                value={statusUpdateData.newStatus} 
                onValueChange={(value) => {
                  console.log('Status changed to:', value);
                  setStatusUpdateData({ ...statusUpdateData, newStatus: value });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Pending</SelectItem>
                  <SelectItem value="completed">✅ Completed</SelectItem>
                  <SelectItem value="call_made">📞 Call Made</SelectItem>
                  <SelectItem value="meeting_scheduled">📅 Meeting Scheduled</SelectItem>
                  <SelectItem value="followup_scheduled">🔄 Follow-up Scheduled</SelectItem>
                  <SelectItem value="admission_processed">🎓 Admission Processed</SelectItem>
                  <SelectItem value="rescheduled">⏰ Rescheduled</SelectItem>
                  <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-gray-600">
                Current status: <span className="font-medium">{selectedReminder?.status || 'Unknown'}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="statusNotes">Follow-up Notes</Label>
              <Textarea
                id="statusNotes"
                value={statusUpdateData.notes}
                onChange={(e) => setStatusUpdateData({ ...statusUpdateData, notes: e.target.value })}
                placeholder="Add notes about this follow-up..."
                rows={3}
              />
            </div>

            {/* Lead Status Sync Option */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="updateLeadStatus"
                  checked={statusUpdateData.updateLeadStatus}
                  onChange={(e) => setStatusUpdateData({ ...statusUpdateData, updateLeadStatus: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="updateLeadStatus">Update Lead Status</Label>
              </div>

              {statusUpdateData.updateLeadStatus && selectedReminder && statusUpdateData.newStatus && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Suggested Lead Status</Label>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{getSuggestedLeadStatus(selectedReminder.type, statusUpdateData.newStatus)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      This will automatically update the lead's status based on the follow-up type ({selectedReminder.type}) and new status ({statusUpdateData.newStatus}).
                    </div>
                    <div className="text-xs text-blue-600">
                      💡 The lead status will be updated to reflect this follow-up action.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleStatusUpdate(
                statusUpdateData.reminderId, 
                statusUpdateData.newStatus, 
                statusUpdateData.notes,
                statusUpdateData.updateLeadStatus
              )} 
              disabled={loading || !statusUpdateData.newStatus}
            >
              {loading ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Follow-up Reminder
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this follow-up reminder? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (reminderToDelete) {
                  handleDeleteReminder(reminderToDelete);
                  setIsDeleteDialogOpen(false);
                  setReminderToDelete(null);
                }
              }}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete Follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder History Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Reminder History
              <Badge variant="secondary" className="ml-2">
                {sortedProcessedReminders.length}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Hide History" : "Show History"}
            </Button>
          </CardTitle>
        </CardHeader>
        
        {showHistory && (
          <CardContent>
            {/* History Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search history..."
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="call_made">Call Made</SelectItem>
                    <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                    <SelectItem value="followup_scheduled">Follow-up Scheduled</SelectItem>
                    <SelectItem value="admission_processed">Admission Processed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* History Table */}
            {sortedProcessedReminders.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No reminder history found</p>
                <p className="text-sm text-gray-400 mt-2">
                  Processed reminders will appear here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Reminder</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead>Processed By</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProcessedReminders.map((reminder) => {
                      const TypeIcon = reminderTypes.find(t => t.value === reminder.type)?.icon || Bell;
                      
                      return (
                        <TableRow key={reminder.id} className="bg-gray-50">
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{reminder.leadName}</div>
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {reminder.leadPhone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <div className="font-medium">{reminder.title}</div>
                              {reminder.description && (
                                <div className="text-sm text-gray-500 truncate">
                                  {reminder.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TypeIcon className="w-4 h-4" />
                              <span className="capitalize">{reminder.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {reminder.dueDate.toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(reminder.status)}>
                              {reminder.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-600">
                              {reminder.processedAt ? 
                                reminder.processedAt.toLocaleDateString() : 
                                reminder.updatedAt.toLocaleDateString()
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <UserNameDisplay 
                              userId={reminder.processedBy || reminder.updatedBy || reminder.assignedTo} 
                              userNames={userNames}
                              setUserNames={setUserNames}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {reminder.lastAction?.remarks || reminder.notes ? (
                                <div className="text-sm text-gray-600 truncate">
                                  {reminder.lastAction?.remarks || reminder.notes}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">No notes</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={reminder.status}
                                onValueChange={async (newStatus) => {
                                  try {
                                    await updateDoc(doc(db, 'reminders', reminder.id), {
                                      status: newStatus,
                                      updatedAt: Timestamp.now(),
                                      updatedBy: userProfile?.uid || 'system'
                                    });
                                    toast({
                                      title: "Status Updated",
                                      description: `Reminder status updated to ${newStatus}`,
                                    });
                                  } catch (error) {
                                    console.error('Error updating reminder status:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to update reminder status",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="call_made">Call Made</SelectItem>
                                  <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                                  <SelectItem value="followup_scheduled">Follow-up Scheduled</SelectItem>
                                  <SelectItem value="admission_processed">Admission Processed</SelectItem>
                                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

    </div>
  );
} 