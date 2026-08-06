import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, getDoc, Timestamp, addDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLeadDocRef } from "@/lib/leadDocumentUtils";
import { useAuth } from "@/hooks/useAuth";
import { enhancedReminderService } from "@/lib/enhancedReminderService";
import { firebaseHelpers } from "@/lib/firebaseHelpers";
import { getNextSerialNumberFromItems } from "@/lib/serialNumberUtils";
import { 
  Calendar, 
  Phone, 
  UserCheck, 
  UserPlus, 
  GraduationCap,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  PhoneCall,
  PhoneOff,
  CalendarX,
  UserX,
  MessageSquare,
  Mail,
  PhoneIncoming,
  PhoneOutgoing,
  Zap,
  Target,
  TrendingUp,
  Activity,
  Star,
  Award,
  XCircle,
  CheckCircle2,
  Loader2,
  Bell,
  BellOff,
  Clock3,
  CalendarCheck,
  AlertTriangle,
  Info
} from "lucide-react";

interface LeadStatusManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  onStatusUpdate: () => void;
}

// Enhanced status workflow with modern status management
const statusWorkflow = {
  // Initial Statuses
  "Other": ["Cold Lead", "Warm Lead", "Hot Lead", "Contacted", "Call Scheduled", "Follow-up Scheduled"],
  "New": ["Cold Lead", "Warm Lead", "Hot Lead", "Contacted", "Call Scheduled", "Follow-up Scheduled"],
  
  // Call-related Statuses
  "Call Scheduled": ["Call Made", "Call Not Received", "Call Rescheduled", "Call Cancelled", "No Answer"],
  "Call Made": ["Interested", "Not Interested", "Follow-up Required", "Visit Scheduled", "Call Back Later"],
  "Call Not Received": ["Call Rescheduled", "Call Cancelled", "No Answer", "Wrong Number", "Not Available"],
  "Call Rescheduled": ["Call Made", "Call Not Received", "Call Cancelled"],
  "Call Cancelled": ["Call Rescheduled", "Not Interested", "Lost"],
  "No Answer": ["Call Back Later", "Call Rescheduled", "Not Available", "Wrong Number"],
  "Call Back Later": ["Call Made", "Call Rescheduled", "Not Interested"],
  "Wrong Number": ["Lost", "Fake"],
  "Not Available": ["Call Rescheduled", "Call Back Later", "Not Interested"],
  
  // Follow-up Statuses
  "Follow-up Scheduled": ["Follow-up Completed", "Follow-up Cancelled", "Follow-up Rescheduled", "No Response"],
  "Follow-up Completed": ["Interested", "Not Interested", "Visit Scheduled", "More Follow-up Required"],
  "Follow-up Cancelled": ["Not Interested", "Lost", "Follow-up Rescheduled"],
  "Follow-up Rescheduled": ["Follow-up Completed", "Follow-up Cancelled", "No Response"],
  "No Response": ["Follow-up Rescheduled", "Not Interested", "Lost", "Call Back Later"],
  "More Follow-up Required": ["Follow-up Scheduled", "Interested", "Not Interested"],
  
  // Visit-related Statuses
  "Visit Scheduled": ["Visit Completed", "Visit Shifted", "Not Visiting", "Visit Cancelled", "Visit Rescheduled"],
  "Visit Shifted": ["Visit Completed", "Visit Cancelled", "Visit Rescheduled"],
  "Not Visiting": ["Visit Cancelled", "Not Interested", "Lost"],
  "Visit Cancelled": ["Visit Rescheduled", "Not Interested", "Lost"],
  "Visit Rescheduled": ["Visit Completed", "Visit Cancelled", "Not Visiting"],
  "Visit Completed": ["Admission Done", "Interested", "Not Interested", "Follow-up Required"],
  
  // Interest-based Statuses
  "Interested": ["Visit Scheduled", "Admission Done", "Follow-up Required", "Converted"],
  "Not Interested": ["Lost", "Dropped", "Follow-up Later"],
  "Follow-up Later": ["Interested", "Not Interested", "Lost"],
  
  // Conversion Statuses
  "Admission Done": ["Converted", "Done", "Follow-up Required"],
  "Converted": ["Done"],
  "Done": [],
  
  // Negative Statuses
  "Cold Lead": ["Warm Lead", "Hot Lead", "Contacted", "Not Interested", "Lost"],
  "Warm Lead": ["Hot Lead", "Contacted", "Interested", "Not Interested"],
  "Hot Lead": ["Contacted", "Interested", "Visit Scheduled", "Admission Done"],
  "Contacted": ["Interested", "Visit Scheduled", "Not Interested"],
  "Lost": ["Dropped"],
  "Fake": [],
  "Dropped": []
};

// Statuses that typically need reminders
const statusesNeedingReminders = [
  "Call Scheduled", "Call Back Later", "Follow-up Scheduled", "Follow-up Required", 
  "Visit Scheduled", "Visit Rescheduled", "Follow-up Later", "More Follow-up Required"
];

// Statuses that should cancel existing reminders
const statusesCancellingReminders = [
  "Call Made", "Call Cancelled", "Follow-up Completed", "Follow-up Cancelled",
  "Visit Completed", "Visit Cancelled", "Not Interested", "Lost", "Dropped", 
  "Fake", "Admission Done", "Converted", "Done"
];

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
    "Converted (Admission Done)": "bg-green-600 text-white",
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

const getStatusCategory = (status: string) => {
  if (status.includes('Call')) return 'call';
  if (status.includes('Follow-up') || status.includes('Followup')) return 'followup';
  if (status.includes('Visit')) return 'visit';
  if (status === 'Interested' || status === 'Not Interested') return 'interest';
  if (status === 'Admission Done' || status === 'Converted' || status === 'Done') return 'conversion';
  if (status === 'Lost' || status === 'Dropped' || status === 'Fake') return 'negative';
  return 'general';
};

export default function LeadStatusManager({ 
  open, 
  onOpenChange, 
  lead, 
  onStatusUpdate 
}: LeadStatusManagerProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [newStatus, setNewStatus] = useState(lead?.status === "New" ? "Other" : (lead?.status || "Other"));
  const [visitDate, setVisitDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [callDate, setCallDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [followUpNotes, setFollowUpNotes] = useState("");
  
  // Reminder management states
  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderType, setReminderType] = useState<'call' | 'followup' | 'visit' | 'meeting'>('followup');
  const [reminderPriority, setReminderPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [existingReminders, setExistingReminders] = useState<any[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);

  const availableStatuses = statusWorkflow[lead?.status as keyof typeof statusWorkflow] || [];

  // Load existing reminders for this lead
  useEffect(() => {
    if (open && lead?.id) {
      loadExistingReminders();
    }
  }, [open, lead?.id]);

  // Auto-enable reminder for statuses that typically need reminders
  useEffect(() => {
    if (statusesNeedingReminders.includes(newStatus)) {
      setEnableReminder(true);
      // Set default reminder date to tomorrow if no follow-up date is set
      if (!followUpDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setReminderDate(tomorrow.toISOString().split('T')[0]);
      } else {
        setReminderDate(followUpDate);
      }
    } else if (statusesCancellingReminders.includes(newStatus)) {
      setEnableReminder(false);
    }
  }, [newStatus, followUpDate]);

  const loadExistingReminders = async () => {
    if (!lead?.id || !userProfile?.centreId) return;
    
    setIsLoadingReminders(true);
    try {
      const remindersRef = collection(db, 'reminders');
      const q = query(
        remindersRef,
        where('leadId', '==', lead.id),
        where('centreId', '==', userProfile.centreId),
        where('status', 'in', ['pending', 'snoozed'])
      );
      
      const snapshot = await getDocs(q);
      const reminders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setExistingReminders(reminders);
      console.log('📅 Loaded existing reminders:', reminders.length);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setIsLoadingReminders(false);
    }
  };

  const cancelExistingReminders = async () => {
    if (!lead?.id || !userProfile?.centreId) return;
    
    try {
      const remindersRef = collection(db, 'reminders');
      const q = query(
        remindersRef,
        where('leadId', '==', lead.id),
        where('centreId', '==', userProfile.centreId),
        where('status', 'in', ['pending', 'snoozed'])
      );
      
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log('📅 Cancelled existing reminders:', snapshot.docs.length);
      setExistingReminders([]);
    } catch (error) {
      console.error('Error cancelling reminders:', error);
    }
  };

  const createReminder = async () => {
    if (!lead?.id || !userProfile?.centreId || !reminderDate || !reminderTime) return;
    
    try {
      const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);
      
      const reminderData = {
        leadId: lead.id,
        leadName: lead.leadName || lead.name || 'Unknown Lead',
        leadPhone: lead.contact || lead.phone || '',
        leadEmail: lead.email || lead.emailId || '',
        title: `${reminderType.charAt(0).toUpperCase() + reminderType.slice(1)} - ${lead.leadName || lead.name}`,
        description: followUpNotes || `${reminderType} for ${lead.leadName || lead.name}`,
        dueDate: Timestamp.fromDate(reminderDateTime),
        reminderTime: reminderTime,
        status: 'pending' as const,
        priority: reminderPriority,
        type: reminderType,
        notes: followUpNotes,
        assignedTo: lead.assignedTo || userProfile.firstName || '',
        centreId: userProfile.centreId,
        createdBy: userProfile.uid || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: userProfile.uid || ''
      };

      await addDoc(collection(db, 'reminders'), reminderData);
      console.log('📅 Created reminder for status update');
      
      // Refresh reminders list
      await loadExistingReminders();
    } catch (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
  };

  const handleStatusUpdate = async () => {
    if (!lead?.id) {
      toast({
        title: "Error",
        description: "Lead ID is missing",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: Timestamp.now(),
        updatedBy: userProfile?.id || 'unknown'
      };

      // Add visit date if scheduling visit
      if (newStatus.includes('Visit') && visitDate) {
        updateData.visitDate = new Date(visitDate);
      }

      // Add follow-up date
      if (followUpDate) {
        updateData.followUpDate = new Date(followUpDate);
      }

      // Add call date for call-related statuses
      if (newStatus.includes('Call') && callDate) {
        updateData.callDate = new Date(callDate);
      }

      // Add remarks
      if (remarks) {
        updateData.statusRemarks = remarks;
      }

      // Update admission date if converting to admission
      if (newStatus === "Admission Done") {
        updateData.admissionDate = new Date();
      }

      const leadRef = getLeadDocRef(db, lead.id, lead);
      
      const docSnap = await getDoc(leadRef);
      if (!docSnap.exists()) {
        throw new Error(`Lead document with ID ${lead.id} does not exist`);
      }
      
      await updateDoc(leadRef, updateData);

      // If status is Converted, create student entry automatically
      const isConverted = newStatus === "Admission Done";
      
      if (isConverted) {
        try {
          // Check if student already exists for this lead
          const studentsQuery = query(
            collection(db, 'students'),
            where('leadId', '==', lead.id)
          );
          const existingStudents = await getDocs(studentsQuery);
          
          if (existingStudents.empty) {
            // Get the next SR number
            const studentsSnapshot = await getDocs(collection(db, 'students'));
            const nextSrNo = getNextSerialNumberFromItems(
              studentsSnapshot.docs.map((d) => ({ ...d.data(), id: d.id }))
            );
            
            // Get current lead data for mapping
            const leadDoc = await getDoc(leadRef);
            const leadData = leadDoc.data();
            
            // Map lead data to student data
            const studentData: any = {
              srNo: nextSrNo,
              firstName: leadData?.leadName || lead?.leadName || '',
              lastName: '',
              email: leadData?.emailId || lead?.emailId || '',
              phone: leadData?.contact || lead?.contact || '',
              course: leadData?.course || lead?.course || '',
              courseDuration: leadData?.courseDuration ? parseFloat(leadData.courseDuration.toString()) : null,
              education: leadData?.education || lead?.education || '',
              admissionDate: new Date(),
              admissionMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
              status: 'active',
              centreId: userProfile?.centreId || 'unknown',
              leadId: lead.id, // Link student to lead
              source: leadData?.source || lead?.source || '',
              cityArea: leadData?.cityArea || lead?.cityArea || '',
              remarks: leadData?.remark || leadData?.notes || lead?.remark || lead?.notes || '',
              assignedTo: leadData?.counselorName || leadData?.assignedTo || lead?.counselorName || lead?.assignedTo || '',
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: userProfile?.uid || 'unknown',
              updatedBy: userProfile?.uid || 'unknown'
            };
            
            // Create student
            const studentId = await firebaseHelpers.saveStudent(studentData);
            
            if (studentId) {
              // Update lead with studentId and convertedAt
              await updateDoc(leadRef, {
                studentId: studentId,
                convertedAt: Timestamp.now(),
                admissionDate: Timestamp.now()
              });
              
              console.log('✅ Student created from converted lead:', studentId);
            } else {
              throw new Error('Failed to create student');
            }
          } else {
            // Student already exists, just update the lead
            await updateDoc(leadRef, {
              convertedAt: Timestamp.now(),
              admissionDate: Timestamp.now()
            });
            
            console.log('✅ Student already exists for this lead');
          }
        } catch (studentError: any) {
          console.error('❌ Error creating student from converted lead:', studentError);
          // Don't fail the status update if student creation fails
        }
      }

      // Handle reminders based on status change
      if (statusesCancellingReminders.includes(newStatus)) {
        // Cancel existing reminders for negative statuses
        await cancelExistingReminders();
        toast({
          title: "✅ Status Updated",
          description: `Lead status updated to ${newStatus}. Existing reminders cancelled.`,
        });
      } else if (enableReminder && reminderDate && reminderTime) {
        // Cancel existing reminders first
        await cancelExistingReminders();
        // Create new reminder
        await createReminder();
        toast({
          title: "✅ Status Updated with Reminder",
          description: `Lead status updated to ${newStatus}. New reminder scheduled for ${reminderDate} at ${reminderTime}.`,
        });
      } else {
        toast({
          title: "✅ Status Updated",
          description: `Lead status successfully updated to ${newStatus}`,
        });
      }

      // Dispatch comprehensive update events for all components
      window.dispatchEvent(new CustomEvent('statusUpdated', {
        detail: {
          leadId: lead.id,
          newStatus,
          timestamp: Date.now(),
          source: 'status_manager',
          preventRefresh: false
        }
      }));

      // Dispatch lead data updated event to update Overview
      window.dispatchEvent(new CustomEvent('leadDataUpdated', {
        detail: {
          leadId: lead.id,
          action: 'update',
          timestamp: Date.now(),
          updates: {
            status: newStatus,
            ...(visitDate && { visitDate: new Date(visitDate) }),
            ...(followUpDate && { followUpDate: new Date(followUpDate) }),
            ...(callDate && { callDate: new Date(callDate) }),
            ...(remarks && { statusRemarks: remarks }),
            ...(newStatus === "Admission Done" && { admissionDate: new Date() })
          },
          source: 'status_manager',
          preventRefresh: false
        }
      }));

      // Dispatch analytics update
      window.dispatchEvent(new CustomEvent('analyticsDataUpdated', {
        detail: {
          source: 'status',
          timestamp: Date.now(),
          leadId: lead.id,
          newStatus,
          updates: {
            status: newStatus,
            ...(visitDate && { visitDate: new Date(visitDate) }),
            ...(followUpDate && { followUpDate: new Date(followUpDate) }),
            ...(callDate && { callDate: new Date(callDate) })
          },
          preventRefresh: false
        }
      }));

      // Dispatch calendar update if dates changed
      if (visitDate || followUpDate || callDate || newStatus === "Admission Done") {
        window.dispatchEvent(new CustomEvent('calendarDataUpdated', {
          detail: {
            leadId: lead.id,
            visitDate: visitDate ? new Date(visitDate) : undefined,
            followUpDate: followUpDate ? new Date(followUpDate) : undefined,
            callDate: callDate ? new Date(callDate) : undefined,
            admissionDate: newStatus === "Admission Done" ? new Date() : undefined,
            timestamp: Date.now(),
            source: 'status_manager',
            preventRefresh: false
          }
        }));
      }

      // Force refresh reminder service
      enhancedReminderService.forceRefresh();

      onStatusUpdate();
      onOpenChange(false);
      
      console.log('✅ Status update completed successfully');
    } catch (error) {
      console.error('❌ Error updating lead status:', error);
      toast({
        title: "❌ Error",
        description: "Failed to update lead status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextActions = () => {
    const currentStatus = lead?.status === "New" ? "Other" : (lead?.status || "Other");
    const nextStatuses = statusWorkflow[currentStatus as keyof typeof statusWorkflow] || [];
    
    return nextStatuses.map(status => ({
      status,
      icon: getStatusIcon(status),
      color: getStatusColor(status),
      category: getStatusCategory(status)
    }));
  };

  const filteredActions = getNextActions().filter(action => 
    selectedCategory === "all" || action.category === selectedCategory
  );

  const categories = [
    { id: "all", label: "All Statuses", icon: "📋" },
    { id: "call", label: "Call Related", icon: "📞" },
    { id: "followup", label: "Follow-up", icon: "📅" },
    { id: "visit", label: "Visit Related", icon: "🏢" },
    { id: "interest", label: "Interest", icon: "💡" },
    { id: "conversion", label: "Conversion", icon: "✅" },
    { id: "negative", label: "Negative", icon: "❌" }
  ];

  const needsReminder = statusesNeedingReminders.includes(newStatus);
  const shouldCancelReminders = statusesCancellingReminders.includes(newStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-purple-50 to-pink-50 border-0 shadow-2xl">
        <DialogHeader className="pb-6 border-b border-gray-200/50">
          <DialogTitle className="flex items-center gap-4 text-3xl font-bold text-gray-900">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <UserCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Lead Status Management
              </div>
              <div className="text-sm text-gray-600 font-normal mt-1">
                Update lead status and manage reminders
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-6">
          {/* Current Lead Info - Modern Card Design */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Lead Information</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-500">Name</span>
                <p className="font-semibold text-gray-900">{lead?.leadName || lead?.name}</p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-500">Phone</span>
                <p className="font-semibold text-gray-900">{lead?.contact || lead?.phone}</p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-500">Course</span>
                <p className="font-semibold text-gray-900">{lead?.course || lead?.interestedCourse}</p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-500">Current Status</span>
                <Badge className={`${getStatusColor(lead?.status)} font-medium text-sm px-3 py-1`}>
                  {lead?.status === "New" ? "Other" : (lead?.status || "Other")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Existing Reminders Warning */}
          {existingReminders.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-amber-800">Existing Reminders Found</h3>
              </div>
              <div className="space-y-3">
                {existingReminders.map((reminder, index) => (
                  <div key={reminder.id} className="flex items-center justify-between p-3 bg-amber-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-800">{reminder.title}</p>
                        <p className="text-sm text-amber-700">
                          Due: {reminder.dueDate?.toDate?.()?.toLocaleString() || 'Unknown date'}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-amber-200 text-amber-800">
                      {reminder.status}
                    </Badge>
                  </div>
                ))}
                <p className="text-sm text-amber-700">
                  <Info className="w-4 h-4 inline mr-1" />
                  These reminders will be cancelled when you update the status.
                </p>
              </div>
            </div>
          )}

          {/* Category Filter - Modern Design */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-white">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Filter by Category</h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="lg"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-3 transition-all duration-200 ${
                    selectedCategory === category.id 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg' 
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="text-lg">{category.icon}</span>
                  {category.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Status Workflow - Modern Flow Design */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Available Status Updates</h3>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {filteredActions.map((action, index) => (
                <div key={action.status} className="flex items-center gap-3">
                  {index > 0 && (
                    <div className="flex items-center">
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setNewStatus(action.status)}
                    className={`flex items-center gap-3 transition-all duration-200 ${
                      newStatus === action.status 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="text-lg">{action.icon}</span>
                    <span className="font-medium">{action.status}</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Status Update Form */}
          {newStatus && (
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl text-white">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Update Status</h3>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="newStatus" className="text-sm font-medium text-gray-700">New Status</Label>
                    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                      <span className="text-2xl">{getStatusIcon(newStatus)}</span>
                      <div>
                        <p className="font-semibold text-gray-900">{newStatus}</p>
                        <p className="text-sm text-gray-600">{getStatusCategory(newStatus)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="followUpDate" className="text-sm font-medium text-gray-700">Follow-up Date</Label>
                    <Input 
                      id="followUpDate" 
                      type="date" 
                      value={followUpDate} 
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="followUpNotes" className="text-sm font-medium text-gray-700">Follow-up Notes</Label>
                  <Textarea 
                    id="followUpNotes" 
                    value={followUpNotes} 
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    placeholder="Add notes about the status update..."
                    rows={4}
                  />
                </div>

                {/* Reminder Management Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Reminder Management</h4>
                  </div>

                  {shouldCancelReminders ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <BellOff className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="font-medium text-red-800">Reminders will be cancelled</p>
                          <p className="text-sm text-red-700">
                            This status change will automatically cancel any existing reminders for this lead.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : needsReminder ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={enableReminder}
                            onCheckedChange={setEnableReminder}
                          />
                          <div>
                            <p className="font-medium text-gray-900">Enable Reminder</p>
                            <p className="text-sm text-gray-600">Schedule a reminder for this status update</p>
                          </div>
                        </div>
                        {enableReminder && (
                          <Badge className="bg-green-100 text-green-800">
                            <Clock3 className="w-3 h-3 mr-1" />
                            Recommended
                          </Badge>
                        )}
                      </div>

                      {enableReminder && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Reminder Date</Label>
                            <Input 
                              type="date" 
                              value={reminderDate} 
                              onChange={(e) => setReminderDate(e.target.value)}
                              className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Reminder Time</Label>
                            <Input 
                              type="time" 
                              value={reminderTime} 
                              onChange={(e) => setReminderTime(e.target.value)}
                              className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Reminder Type</Label>
                            <Select value={reminderType} onValueChange={(value: any) => setReminderType(value)}>
                              <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call">Call</SelectItem>
                                <SelectItem value="followup">Follow-up</SelectItem>
                                <SelectItem value="visit">Visit</SelectItem>
                                <SelectItem value="meeting">Meeting</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Priority</Label>
                            <Select value={reminderPriority} onValueChange={(value: any) => setReminderPriority(value)}>
                              <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <Info className="w-5 h-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-800">No reminder needed</p>
                          <p className="text-sm text-gray-600">
                            This status doesn't typically require a reminder. You can manually enable one if needed.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200/50">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewStatus("");
                      setFollowUpDate("");
                      setFollowUpNotes("");
                      setEnableReminder(false);
                    }}
                    className="h-12 px-6 rounded-xl border-gray-200 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={isUpdating}
                    className="h-12 px-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Update Status
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 