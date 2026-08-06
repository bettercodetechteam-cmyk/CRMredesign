import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from "@/hooks/useAuth";
import { 
  Bell,
  Clock,
  CheckCircle,
  X,
  Phone,
  Calendar,
  User,
  Check,
  AlertCircle,
  Zap,
  Target,
  CheckCircle2,
  XCircle,
  PhoneCall,
  CalendarX,
  UserX,
  Mail,
  MapPin,
  BookOpen,
  Building,
  Edit,
  Play,
  Pause,
  RotateCcw,
  Star,
  Activity,
  TrendingUp
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataSyncService } from '@/lib/dataSyncService';
import { InlineLoading } from "@/components/ui/loading";

interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  title: string;
  description: string;
  dueDate: Date | any; // Can be Date, Firestore Timestamp, string, or number
  status: "pending" | "completed" | "overdue" | "call_made" | "meeting_scheduled" | "followup_scheduled" | "admission_processed" | "rescheduled" | "cancelled";
  priority: "low" | "medium" | "high";
  type: "call" | "meeting" | "followup" | "admission" | "other";
  assignedTo: string;
  notes?: string;
  updatedBy?: string;
  createdAt: Date | any;
  updatedAt: Date | any;
  processed?: boolean; // Whether the reminder has been processed by any user
  processedAt?: Date | any; // When it was processed
  processedBy?: string; // Who processed it
  hasBeenActedUpon?: boolean; // Whether any action has been taken on this reminder
  lastAction?: {
    status: string;
    timestamp: Date | any;
    userId: string;
    remarks?: string;
  };
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
  courseDuration?: string;
  education?: string;
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
  enquiryDate?: string | Date;
}

// Comprehensive lead status workflow
const leadStatusWorkflow = {
  "Other": ["Cold Lead", "Warm Lead", "Hot Lead", "Contacted", "Call Scheduled", "Follow-up Scheduled"],
  "New": ["Cold Lead", "Warm Lead", "Hot Lead", "Contacted", "Call Scheduled", "Follow-up Scheduled"],
  "Cold Lead": ["Warm Lead", "Hot Lead", "Contacted", "Not Interested", "Lost"],
  "Warm Lead": ["Hot Lead", "Contacted", "Interested", "Not Interested"],
  "Hot Lead": ["Contacted", "Interested", "Visit Scheduled", "Admission Done"],
  "Contacted": ["Interested", "Visit Scheduled", "Not Interested"],
  "Call Scheduled": ["Call Made", "Call Not Received", "Call Rescheduled", "Call Cancelled", "No Answer"],
  "Call Made": ["Interested", "Not Interested", "Follow-up Required", "Visit Scheduled", "Call Back Later"],
  "Call Not Received": ["Call Rescheduled", "Call Cancelled", "No Answer", "Wrong Number", "Not Available"],
  "Call Rescheduled": ["Call Made", "Call Not Received", "Call Cancelled"],
  "Call Cancelled": ["Call Rescheduled", "Not Interested", "Lost"],
  "No Answer": ["Call Back Later", "Call Rescheduled", "Not Available", "Wrong Number"],
  "Call Back Later": ["Call Made", "Call Rescheduled", "Not Interested"],
  "Wrong Number": ["Lost", "Fake"],
  "Not Available": ["Call Rescheduled", "Call Back Later", "Not Interested"],
  "Follow-up Scheduled": ["Follow-up Completed", "Follow-up Cancelled", "Follow-up Rescheduled", "No Response"],
  "Follow-up Completed": ["Interested", "Not Interested", "Visit Scheduled", "More Follow-up Required"],
  "Follow-up Cancelled": ["Not Interested", "Lost", "Follow-up Rescheduled"],
  "Follow-up Rescheduled": ["Follow-up Completed", "Follow-up Cancelled", "No Response"],
  "No Response": ["Follow-up Rescheduled", "Not Interested", "Lost", "Call Back Later"],
  "More Follow-up Required": ["Follow-up Scheduled", "Interested", "Not Interested"],
  "Visit Scheduled": ["Visit Completed", "Visit Shifted", "Not Visiting", "Visit Cancelled", "Visit Rescheduled"],
  "Visit Shifted": ["Visit Completed", "Visit Cancelled", "Visit Rescheduled"],
  "Not Visiting": ["Visit Cancelled", "Not Interested", "Lost"],
  "Visit Cancelled": ["Visit Rescheduled", "Not Interested", "Lost"],
  "Visit Rescheduled": ["Visit Completed", "Visit Cancelled", "Not Visiting"],
  "Visit Completed": ["Admission Done", "Interested", "Not Interested", "Follow-up Required"],
  "Interested": ["Visit Scheduled", "Admission Done", "Follow-up Required", "Converted"],
  "Not Interested": ["Lost", "Dropped", "Follow-up Later"],
  "Follow-up Later": ["Interested", "Not Interested", "Lost"],
  "Admission Done": ["Converted", "Done", "Follow-up Required"],
  "Converted": ["Done"],
  "Done": [],
  "Lost": ["Dropped"],
  "Fake": [],
  "Dropped": []
};

// Reminder status workflow
const reminderStatusWorkflow = {
  "pending": ["completed", "call_made", "meeting_scheduled", "followup_scheduled", "rescheduled", "cancelled"],
  "call_made": ["completed", "followup_scheduled", "meeting_scheduled", "admission_processed"],
  "meeting_scheduled": ["completed", "call_made", "followup_scheduled", "admission_processed", "rescheduled", "cancelled"],
  "followup_scheduled": ["completed", "call_made", "meeting_scheduled", "admission_processed", "rescheduled", "cancelled"],
  "admission_processed": ["completed"],
  "rescheduled": ["pending", "call_made", "meeting_scheduled", "followup_scheduled"],
  "cancelled": [],
  "completed": []
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "Other":
    case "New":
      return <AlertCircle className="w-4 h-4 text-blue-500" />;
    case "Cold Lead":
      return <Clock className="w-4 h-4 text-gray-500" />;
    case "Warm Lead":
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case "Hot Lead":
      return <Activity className="w-4 h-4 text-red-500" />;
    case "Contacted":
      return <Phone className="w-4 h-4 text-green-500" />;
    case "Interested":
      return <Star className="w-4 h-4 text-yellow-500" />;
    case "Not Interested":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "Visit Scheduled":
    case "Visit Completed":
      return <Calendar className="w-4 h-4 text-purple-500" />;
    case "Admission Done":
    case "Converted":
    case "Done":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "Lost":
    case "Dropped":
      return <XCircle className="w-4 h-4 text-gray-500" />;
    case "Fake":
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Target className="w-4 h-4 text-blue-500" />;
  }
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    "Admission Done": "bg-green-600 text-white",
    "Cold Lead": "bg-blue-600 text-white",
    "Hot Lead": "bg-red-600 text-white",
    "Not Interested": "bg-gray-700 text-white",
    "Visited": "bg-teal-600 text-white",
    "Placement": "bg-emerald-600 text-white",
    "Not Contacted": "bg-slate-600 text-white",
    "Job Seeker": "bg-indigo-600 text-white",
    "Converted": "bg-green-600 text-white",
    "Done": "bg-green-600 text-white",
    "Other": "bg-violet-500 text-white",
  "New": "bg-violet-500 text-white",
    "Contacted": "bg-blue-500 text-white",
    "Interested": "bg-amber-600 text-white",
    "Visit Scheduled": "bg-purple-600 text-white",
    "Visit Completed": "bg-teal-600 text-white",
    "Lost": "bg-gray-600 text-white",
    "Dropped": "bg-amber-700 text-white",
    "Fake": "bg-rose-600 text-white",
  };
  return colors[status] || "bg-gray-600 text-white";
};

interface EnhancedReminderPopupProps {
  reminder: Reminder;
  onClose: () => void;
  onUpdate: (reminderId: string, updates: any) => void;
  onDismiss?: () => void;
}

export default function EnhancedReminderPopup({ reminder, onClose, onUpdate, onDismiss }: EnhancedReminderPopupProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [leadDetails, setLeadDetails] = useState<Lead | null>(null);
  const [isLoadingLead, setIsLoadingLead] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newReminderStatus, setNewReminderStatus] = useState(reminder.status);
  const [newLeadStatus, setNewLeadStatus] = useState("");
  const [remarks, setRemarks] = useState("");

  // Check if reminder has already been processed
  useEffect(() => {
    if (reminder.processed || reminder.hasBeenActedUpon) {
      toast({
        title: "Reminder Already Processed",
        description: "This reminder has already been acted upon by another user.",
        variant: "destructive",
      });
      onClose();
      return;
    }
  }, [reminder, onClose, toast]);

  // Load lead details on mount
  useEffect(() => {
    if (reminder.leadId) {
      loadLeadDetails(reminder.leadId);
    }
  }, [reminder.leadId]);

  // Update lead status when lead details are loaded
  useEffect(() => {
    if (leadDetails) {
      setNewLeadStatus(leadDetails.status === "New" ? "Other" : (leadDetails.status || "Other"));
    }
  }, [leadDetails]);

  const loadLeadDetails = async (leadId: string) => {
    if (!leadId) return;
    
    setIsLoadingLead(true);
    try {
      const leadDoc = await getDoc(doc(db, 'leads', leadId));
      if (leadDoc.exists()) {
        const leadData = { id: leadDoc.id, ...leadDoc.data() } as Lead;
        setLeadDetails(leadData);
      }
    } catch (error) {
      console.error('Error loading lead details:', error);
    } finally {
      setIsLoadingLead(false);
    }
  };

  const getTimeRemaining = (reminder: Reminder) => {
    const now = new Date();
    let reminderDateTime: Date;
    
    // Handle different date formats
    if (reminder.dueDate && typeof reminder.dueDate === 'object' && 'toDate' in reminder.dueDate) {
      // Handle Firestore Timestamp
      reminderDateTime = (reminder.dueDate as any).toDate();
    } else if (reminder.dueDate instanceof Date) {
      // Handle Date object
      reminderDateTime = reminder.dueDate;
    } else if (typeof reminder.dueDate === 'string' || typeof reminder.dueDate === 'number') {
      // Handle string or number
      reminderDateTime = new Date(reminder.dueDate);
    } else {
      console.warn('Unknown reminder date format:', reminder.dueDate);
      return "Invalid date";
    }
    
    // Validate the reminder date
    if (isNaN(reminderDateTime.getTime())) {
      console.warn('Invalid reminder date:', reminder.dueDate);
      return "Invalid date";
    }
    
    const diff = reminderDateTime.getTime() - now.getTime();
    
    if (diff <= 0) {
      return "Overdue";
    }
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // Validate calculations to prevent NaN
    if (isNaN(minutes) || isNaN(hours) || isNaN(days)) {
      console.warn('Invalid time calculation for reminder:', reminder.id);
      return "Time calculation error";
    }
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
    }
  };

  const getAvailableReminderStatuses = () => {
    const currentStatus = reminder.status || "pending";
    return reminderStatusWorkflow[currentStatus as keyof typeof reminderStatusWorkflow] || [];
  };

  const getAvailableLeadStatuses = () => {
    const currentStatus = leadDetails?.status === "New" ? "Other" : (leadDetails?.status || "Other");
    return leadStatusWorkflow[currentStatus as keyof typeof leadStatusWorkflow] || [];
  };

  const handleReminderStatusUpdate = async () => {
    // Double-check that reminder hasn't been processed
    if (reminder.processed || reminder.hasBeenActedUpon) {
      toast({
        title: "Reminder Already Processed",
        description: "This reminder has already been acted upon by another user.",
        variant: "destructive",
      });
      onClose();
      return;
    }

    if (!newReminderStatus || newReminderStatus.trim() === "") {
      toast({
        title: "Error",
        description: "Please select a new reminder status",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    
    // Add a timeout to prevent the button from being stuck forever
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Update operation timed out, resetting button state');
      setIsUpdating(false);
      toast({
        title: "⚠️ Timeout",
        description: "Update operation took too long. Please try again.",
        variant: "destructive",
      });
    }, 30000); // 30 seconds timeout

    try {

      // Check Firebase connection and authentication
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }
      
      // Check network connectivity
      if (!navigator.onLine) {
        throw new Error('No internet connection');
      }
      
      // Step 1: Update reminder with individual try-catch
      const reminderUpdateData: any = {
        status: newReminderStatus,
        updatedAt: Timestamp.now(),
        updatedBy: userProfile?.uid || 'unknown',
        // Mark reminder as processed so it won't show again for any user
        processed: true,
        processedAt: Timestamp.now(),
        processedBy: userProfile?.uid || 'unknown',
        // Add a flag to indicate this reminder has been acted upon
        hasBeenActedUpon: true,
        // Store the action taken
        lastAction: {
          status: newReminderStatus,
          timestamp: Timestamp.now(),
          userId: userProfile?.uid || 'unknown',
          remarks: remarks || ''
        }
      };

      if (remarks) {
        reminderUpdateData.notes = remarks;
      }

      
      try {
      const reminderRef = doc(db, 'reminders', reminder.id);
        
        // Check if reminder document exists before updating
        const reminderDoc = await getDoc(reminderRef);
        if (!reminderDoc.exists()) {
          throw new Error(`Reminder document with ID ${reminder.id} does not exist`);
        }
        
        
        // Add a timeout specifically for the updateDoc operation
        const updatePromise = updateDoc(reminderRef, reminderUpdateData);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('updateDoc operation timed out after 10 seconds')), 10000)
        );
        
        await Promise.race([updatePromise, timeoutPromise]);
      } catch (reminderError: any) {
        console.error('❌ Step 1: Failed to update reminder:', reminderError);
        throw new Error(`Reminder update failed: ${reminderError.message || 'Unknown error'}`);
      }

      // Step 2: Update lead status if different from current
      if (newLeadStatus && leadDetails && newLeadStatus !== leadDetails.status) {
        
        const leadUpdateData: any = {
          status: newLeadStatus,
          updatedAt: Timestamp.now(),
          updatedBy: userProfile?.uid || 'unknown'
        };

        if (remarks) {
          leadUpdateData.statusRemarks = remarks;
        }

        try {
        const leadRef = doc(db, 'leads', reminder.leadId);
          
          // Check if lead document exists before updating
          const leadDoc = await getDoc(leadRef);
          if (!leadDoc.exists()) {
            throw new Error(`Lead document with ID ${reminder.leadId} does not exist`);
          }
          
          
          // Add a timeout specifically for the lead updateDoc operation
          const leadUpdatePromise = updateDoc(leadRef, leadUpdateData);
          const leadTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Lead updateDoc operation timed out after 10 seconds')), 10000)
          );
          
          await Promise.race([leadUpdatePromise, leadTimeoutPromise]);
        } catch (leadError: any) {
          console.error('❌ Step 2: Failed to update lead status:', leadError);
          throw new Error(`Lead status update failed: ${leadError.message || 'Unknown error'}`);
        }

        // Dispatch events for lead update
        try {
        window.dispatchEvent(new CustomEvent('statusUpdated', {
          detail: {
            leadId: reminder.leadId,
            newStatus: newLeadStatus,
            action: 'updated',
            source: 'reminder_popup',
            timestamp: Date.now()
          }
        }));
        } catch (eventError) {
          console.warn('⚠️ Step 2a: Error dispatching status update event:', eventError);
          // Don't throw here, this is not critical
        }
      }

      // Step 3: Dispatch reminder update event
      try {
      window.dispatchEvent(new CustomEvent('reminderUpdated', {
        detail: {
          reminderId: reminder.id,
          newStatus: newReminderStatus,
          leadId: reminder.leadId,
          action: 'updated',
          source: 'reminder_popup',
          timestamp: Date.now()
        }
      }));
      } catch (eventError) {
        console.warn('⚠️ Step 3: Error dispatching reminder update event:', eventError);
        // Don't throw here, this is not critical
      }

      // Step 4: Show success message
      toast({
        title: "✅ Reminder Updated",
        description: `Reminder status successfully updated to ${newReminderStatus}`,
      });

      // Step 5: Call onUpdate callback
      try {
        onUpdate(reminder.id, reminderUpdateData);
      } catch (callbackError) {
        console.warn('⚠️ Step 5: Error in onUpdate callback:', callbackError);
        // Don't throw here, this is not critical
      }
      
      // Step 6: Close popup
      onClose();
      
    } catch (error: any) {
      console.error('❌ Error updating reminder status:', error);
      toast({
        title: "❌ Error",
        description: `Failed to update reminder status: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId); // Clear the timeout
      setIsUpdating(false);
    }
  };

  const handleCompleteReminder = async () => {
    setIsUpdating(true);
    try {
      const updateData: any = {
        status: 'completed',
        updatedAt: Timestamp.now(),
        updatedBy: userProfile?.uid || 'unknown',
        completedAt: Timestamp.now()
      };

      // Update lead status if provided
      if (newLeadStatus && leadDetails && newLeadStatus !== leadDetails.status) {
        const leadRef = doc(db, 'leads', leadDetails.id);
        await updateDoc(leadRef, {
          status: newLeadStatus,
          updatedAt: Timestamp.now()
        });

        // Dispatch lead status update event
        window.dispatchEvent(new CustomEvent('statusUpdated', {
          detail: {
            leadId: leadDetails.id,
            newStatus: newLeadStatus,
            timestamp: Date.now(),
            source: 'reminder_popup'
          }
        }));
      }

      const reminderRef = doc(db, 'reminders', reminder.id);
      await updateDoc(reminderRef, updateData);

      toast({
        title: "✅ Reminder Completed",
        description: "Reminder marked as completed successfully",
      });

      onUpdate(reminder.id, updateData);
      onClose();
      
    } catch (error) {
      console.error('❌ Error updating reminder status:', error);
      toast({
        title: "❌ Error",
        description: "Failed to update reminder status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSnoozeReminder = async () => {
    setIsUpdating(true);
    try {
      // Snooze for 15 minutes by default
      const newTime = new Date();
      newTime.setMinutes(newTime.getMinutes() + 15);
      
      const updateData: any = {
        dueDate: Timestamp.fromDate(newTime),
        updatedAt: Timestamp.now(),
        updatedBy: userProfile?.uid || 'unknown',
        status: 'pending'
      };

      const reminderRef = doc(db, 'reminders', reminder.id);
      await updateDoc(reminderRef, updateData);

      toast({
        title: "✅ Reminder Snoozed",
        description: "Reminder snoozed for 15 minutes",
      });

      onUpdate(reminder.id, updateData);
      onClose();
      
    } catch (error) {
      console.error('❌ Error snoozing reminder:', error);
      toast({
        title: "❌ Error",
        description: "Failed to snooze reminder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 relative flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-6 h-6" />
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-xs font-bold">!</span>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold">Active Reminder</h2>
                <p className="text-purple-200 text-sm">Update status and manage lead</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-purple-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Reminder Info */}
            <div className="space-y-6">
              {/* Reminder Info */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-purple-900">
                    {reminder.type === 'call' ? 'Call' : reminder.title}
                  </h3>
                  <Badge className={`px-3 py-1 rounded-full text-sm font-medium ${
                    getTimeRemaining(reminder) === "Overdue" ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                  }`}>
                    {getTimeRemaining(reminder) === "Overdue" ? 'overdue' : 'due'}
                  </Badge>
                </div>
                <p className="text-lg text-purple-800 mb-2 font-medium">{reminder.leadName}</p>
                <div className="flex items-center gap-2 text-purple-700">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{getTimeRemaining(reminder)}</span>
                </div>
                {reminder.description && (
                  <p className="text-sm text-purple-700 mt-2">{reminder.description}</p>
                )}
              </div>

              {/* Lead Details */}
              {leadDetails && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Lead Details
                  </h4>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Contact:</span>
                      <span>{leadDetails.contact || leadDetails.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Email:</span>
                      <span>{leadDetails.email || leadDetails.emailId || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Course:</span>
                      <span>{leadDetails.course || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Location:</span>
                      <span>{leadDetails.cityArea || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Source:</span>
                      <span>{leadDetails.source || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Counselor:</span>
                      <span>{leadDetails.counselorName || 'N/A'}</span>
                    </div>
                     <div className="flex items-center gap-2">
                       <User className="w-4 h-4 text-blue-600" />
                       <span className="font-medium">Assigned To:</span>
                       <span>{leadDetails.assignedTo || reminder.assignedTo || 'Unassigned'}</span>
                     </div>
                  </div>
                  <div className="mt-3">
                    <Badge className={`${getStatusColor(leadDetails.status)}`}>
                      {getStatusIcon(leadDetails.status)}
                      <span className="ml-1">{leadDetails.status}</span>
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Status Updates */}
            <div className="space-y-6">
              {/* Reminder Status Update */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  Update Reminder Status
                </h4>
                <div className="space-y-3">
                  <Select value={newReminderStatus} onValueChange={setNewReminderStatus}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableReminderStatuses().map((status) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            {status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                            {status === 'call_made' && <Phone className="w-4 h-4 text-blue-500" />}
                            {status === 'meeting_scheduled' && <Calendar className="w-4 h-4 text-purple-500" />}
                            {status === 'followup_scheduled' && <Target className="w-4 h-4 text-orange-500" />}
                            {status === 'admission_processed' && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                            {status === 'rescheduled' && <Clock className="w-4 h-4 text-yellow-500" />}
                            {status === 'cancelled' && <XCircle className="w-4 h-4 text-red-500" />}
                            <span className="capitalize">{status.replace('_', ' ')}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-gray-500">
                    Current status: <span className="font-medium">{reminder.status}</span>
                  </div>
                </div>
              </div>

              {/* Lead Status Update */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-green-600" />
                  Update Lead Status
                </h4>
                <div className="space-y-3">
                  <Select value={newLeadStatus} onValueChange={setNewLeadStatus}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-green-500 focus:ring-green-500">
                      <SelectValue placeholder="Select new lead status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableLeadStatuses().map((status) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(status)}
                            <span>{status}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-gray-500">
                    Current status: <span className="font-medium">{leadDetails?.status === 'New' ? 'Other' : (leadDetails?.status || 'Other')}</span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Remarks
                </Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add remarks about this update..."
                  rows={3}
                  className="w-full resize-none border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleReminderStatusUpdate}
                  disabled={isUpdating}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-md transition-all duration-200 border-0"
                >
                  <Check className="w-4 h-4" />
                  {isUpdating ? <InlineLoading size="sm" color="primary" /> : "UPDATE & CLOSE"}
                </Button>
                 {onDismiss && (
                   <Button
                     onClick={async () => {
                       try {
                         // Mark reminder as dismissed on the server
                         const response = await fetch(`/api/reminders/${reminder.id}/dismiss`, {
                           method: 'POST',
                           headers: {
                             'Content-Type': 'application/json',
                           },
                           body: JSON.stringify({
                             userId: userProfile?.uid,
                             centreId: userProfile?.centreId,
                             reason: 'Dismissed by user'
                           })
                         });
                         
                         if (response.ok) {
                           toast({
                             title: "Reminder Dismissed",
                             description: "This reminder will not appear again for any user.",
                           });
                         }
                       } catch (error) {
                         console.error('Error dismissing reminder:', error);
                       }
                       
                       // Call the original onDismiss function
                       onDismiss();
                     }}
                     disabled={isUpdating}
                     className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all duration-200"
                   >
                     <XCircle className="w-4 h-4" />
                     DISMISS
                   </Button>
                 )}
                <Button
                  onClick={onClose}
                  disabled={isUpdating}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                  CLOSE
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 