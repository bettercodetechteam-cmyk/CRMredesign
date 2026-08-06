import React, { useState, useMemo, useEffect } from 'react';

// Global type declaration for hover timeout
declare global {
  interface Window {
    hoverTimeout?: NodeJS.Timeout;
  }
}
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO, getDay, getDate } from 'date-fns';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  User, 
  Phone, 
  Mail, 
  Edit, 
  Trash2, 
  Eye,
  Plus,
  School,
  Clock,
  Star,
  CheckCircle,
  AlertCircle,
  Info,
  CalendarDays,
  Calendar,
  Search,
  X,
  UserPlus,
  FileText,
  Bell,
  MapPin,
  MessageSquare,
  BookOpen,
  Target,
  Zap,
  Shield,
  Award,
  TrendingUp,
  Users,
  Building,
  GraduationCap,
  Briefcase,
  Globe,
  Activity,
  Settings,
  Filter,
  RefreshCw,
  Save,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from "@/hooks/useAuth";
import { dataSyncService } from "@/lib/dataSyncService";
import { reminderService } from "@/lib/reminderService";
import { calendarSyncService } from "@/lib/calendarSyncService";
import { firebaseListenerManager } from "@/lib/firebaseListenerManager";

interface Lead {
  id: string;
  name?: string;
  leadName?: string;
  phone?: string;
  contact?: string;
  email?: string;
  emailId?: string;
  status: string;
  source: string;
  assignedTo?: string;
  followUpDate?: string | Date;
  followUpType?: 'call' | 'visit' | 'meeting' | 'admission';
  followUpNotes?: string;
  visitDate?: string | Date;
  callDate?: string | Date;
  admissionDate?: string | Date;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: string | Date;
  updatedAt: string | Date;
  type?: 'lead' | 'admission';
  courseInterest?: string;
  reminderDate?: string | Date;
  enquiryDate?: string | Date;
  course?: string;
  education?: string;
  cityArea?: string;
  counselorName?: string;
  remark?: string;
  feedbackCallRemarks?: string;
  centreHeadRemarks?: string;
}

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
}

interface LeadsCalendarProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onDateClick: (date: Date) => void;
  onStatusUpdate: (leadId: string, newStatus: string) => void;
  onLeadEdit: (lead: Lead) => void;
  onLeadDelete: (leadId: string) => void;
  onAddLead: () => void;
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
}

const LeadsCalendar: React.FC<LeadsCalendarProps> = ({
  leads,
  onLeadClick,
  onDateClick,
  onStatusUpdate,
  onLeadEdit,
  onLeadDelete,
  onAddLead,
  onUpdateLead
}) => {

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | 'followups' | 'calls' | 'visits' | 'admissions'>('all');
  
  // Lead selection states
  const [showLeadSelector, setShowLeadSelector] = useState(false);
  const [selectedLeadForEvent, setSelectedLeadForEvent] = useState<Lead | null>(null);
  const [eventType, setEventType] = useState<'followup' | 'call' | 'visit' | 'admission'>('followup');
  const [eventDate, setEventDate] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Notification states
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Hover tooltip state
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const { userProfile } = useAuth();

  // Initialize calendar sync service
  useEffect(() => {
    if (userProfile?.centreId && userProfile?.uid && userProfile.centreId.trim() !== '') {
      try {
        calendarSyncService.init(userProfile.centreId.trim(), userProfile.uid);
      } catch (error) {
        console.error('📅 LeadsCalendar: Error initializing calendar sync service:', error);
      }
    } else {
      console.warn('📅 LeadsCalendar: Invalid user profile data, skipping calendar sync initialization');
    }
  }, [userProfile?.centreId, userProfile?.uid]);

  // Subscribe to calendar sync events
  useEffect(() => {
    const unsubscribeCalendarSync = calendarSyncService.subscribe((event) => {
      // Force re-render when calendar data changes
      setSearchTerm(prev => prev);
    });

    return () => {
      unsubscribeCalendarSync();
    };
  }, []);

  // Close tooltip when clicking outside or when mouse leaves the calendar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hoveredDate) {
        setHoveredDate(null);
        setShowTooltip(false);
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      // Check if mouse left the calendar area
      const target = event.target as HTMLElement;
      if (!target.closest('.calendar-container')) {
        setHoveredDate(null);
        setShowTooltip(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hoveredDate]);



  // Subscribe to data sync events for real-time updates
  useEffect(() => {
    const unsubscribeLead = dataSyncService.subscribe('lead', (event) => {
      // Trigger refresh when lead data changes
      if (event.action === 'updated' || event.action === 'created' || event.action === 'deleted') {
        // Force re-render by updating a state
        setSearchTerm(prev => prev);
      }
    });

    const unsubscribeStatus = dataSyncService.subscribe('status', (event) => {
      // Trigger refresh when status changes
      if (event.action === 'updated') {
        setSearchTerm(prev => prev);
      }
    });

    const unsubscribeCalendar = dataSyncService.subscribe('calendar', (event) => {
      // Trigger refresh when calendar data changes
      if (event.action === 'updated' || event.action === 'created') {
        setSearchTerm(prev => prev);
      }
    });

    const unsubscribeReminder = dataSyncService.subscribe('reminder', (event) => {
      // Trigger refresh when reminder data changes
      if (event.action === 'updated' || event.action === 'created' || event.action === 'deleted') {
        console.log('📅 LeadsCalendar: Reminder sync event received:', event);
        setSearchTerm(prev => prev);
      }
    });

    // Listen for global events
    const handleLeadDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      setSearchTerm(prev => prev);
    };

    const handleStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      setSearchTerm(prev => prev);
    };

    const handleReminderUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('📅 LeadsCalendar: Global reminder update event received:', customEvent.detail);
      setSearchTerm(prev => prev);
    };

    const handleCalendarUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('📅 LeadsCalendar: Global calendar update event received:', customEvent.detail);
      setSearchTerm(prev => prev);
    };

    // Listen for specific calendar data updates
    const handleCalendarDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('📅 LeadsCalendar: Global calendar data update event received:', customEvent.detail);
      setSearchTerm(prev => prev);
    };

    // Listen for reminder data updates
    const handleReminderDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('📅 LeadsCalendar: Reminder data update received:', customEvent.detail);
      setSearchTerm(prev => prev);
    };

    window.addEventListener('leadDataUpdated', handleLeadDataUpdate);
    window.addEventListener('statusUpdated', handleStatusUpdate);
    window.addEventListener('reminderUpdated', handleReminderUpdate);
    window.addEventListener('calendarUpdated', handleCalendarUpdate);
    window.addEventListener('calendarDataUpdated', handleCalendarDataUpdate);
    window.addEventListener('reminderDataUpdated', handleReminderDataUpdate);

    return () => {
      console.log('📅 LeadsCalendar: Cleaning up data sync subscriptions');
      unsubscribeLead();
      unsubscribeStatus();
      unsubscribeCalendar();
      unsubscribeReminder();
      window.removeEventListener('leadDataUpdated', handleLeadDataUpdate);
      window.removeEventListener('statusUpdated', handleStatusUpdate);
      window.removeEventListener('reminderUpdated', handleReminderUpdate);
      window.removeEventListener('calendarUpdated', handleCalendarUpdate);
      window.removeEventListener('calendarDataUpdated', handleCalendarDataUpdate);
      window.removeEventListener('reminderDataUpdated', handleReminderDataUpdate);
    };
  }, []);

  // Load reminders from Firebase using centralized listener manager
  useEffect(() => {
    if (!userProfile?.centreId) return;

    // Use centralized listener manager to prevent duplicate listeners
    const unsubscribe = firebaseListenerManager.subscribe(
      'reminders',
      (remindersData) => {
        // Process reminders data (same as before)
        const processedReminders = remindersData.map((reminder: any) => {
          const data = reminder;
          return {
            id: reminder.id,
            ...data,
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate || Date.now())),
            reminderTime: data.reminderTime || '09:00', // Default time if missing
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt || Date.now())),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt || Date.now())),
          };
        });
        console.log('📅 LeadsCalendar: Loaded reminders:', processedReminders.length, 'total');
        console.log('📅 LeadsCalendar: Reminder types:', processedReminders.map(r => ({ 
          id: r.id, 
          type: r.type, 
          title: r.title, 
          dueDate: r.dueDate,
          reminderTime: r.reminderTime 
        })));
        setReminders(processedReminders);
      },
      { 
        centreId: userProfile.centreId
        // No limit - as requested by user
      }
    );

    return () => unsubscribe();
  }, [userProfile?.centreId]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() - start.getDay());
    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() + (6 - end.getDay()));
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Get follow-ups for a specific date (from both leads and reminders)
  const getFollowUpsForDate = (date: Date) => {
    // console.log('📅 LeadsCalendar: Getting follow-ups for date:', format(date, 'yyyy-MM-dd'));
    // console.log('📅 LeadsCalendar: Total leads available:', leads?.length || 0);
    // console.log('📅 LeadsCalendar: Total reminders available:', reminders.length);
    
    const leadFollowUps = leads?.filter(lead => {
      if (lead.followUpDate) {
        let followUpDate: Date;
        try {
          if (lead.followUpDate instanceof Date) {
            followUpDate = lead.followUpDate;
          } else if (typeof lead.followUpDate === 'string' && lead.followUpDate.trim()) {
            followUpDate = parseISO(lead.followUpDate);
          } else {
            return false;
          }
          const isSame = isSameDay(followUpDate, date);
          if (isSame) {
            console.log('📅 LeadsCalendar: Found follow-up for lead:', lead.name || lead.leadName, 'on', format(date, 'yyyy-MM-dd'));
          }
          return isSame;
        } catch (error) {
          console.warn('Invalid followUpDate for lead:', lead.id, lead.followUpDate);
          return false;
        }
      }
      return false;
    }) || [];

    const reminderFollowUps = reminders.filter(reminder => {
      if (reminder.type === 'followup') {
        try {
          // Handle reminders with or without reminderTime
          let reminderDateTime: Date;
          if (reminder.reminderTime) {
            reminderDateTime = new Date(`${reminder.dueDate.toISOString().split('T')[0]}T${reminder.reminderTime}`);
          } else {
            // Default to 9 AM if no reminderTime is set
            reminderDateTime = new Date(`${reminder.dueDate.toISOString().split('T')[0]}T09:00`);
          }
          return isSameDay(reminderDateTime, date);
        } catch (error) {
          console.warn('Invalid reminder date for reminder:', reminder.id, reminder.dueDate);
          return false;
        }
      }
      return false;
    }).map(reminder => ({
      id: `reminder-${reminder.id}`,
      leadName: reminder.leadName,
      name: reminder.leadName,
      contact: reminder.leadPhone,
      phone: reminder.leadPhone,
      emailId: reminder.leadEmail,
      email: reminder.leadEmail,
      status: reminder.status,
      source: 'Follow-up Reminder',
      assignedTo: reminder.assignedTo,
      followUpDate: reminder.dueDate,
      followUpNotes: reminder.description,
      priority: reminder.priority,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      type: 'lead' as const,
      isReminder: true,
      reminderId: reminder.id,
      reminderTitle: reminder.title
    }));

    const allFollowUps = [...leadFollowUps, ...reminderFollowUps];
    // console.log(`📅 LeadsCalendar: Total follow-ups for ${format(date, 'yyyy-MM-dd')}:`, allFollowUps.length, 'leads +', reminderFollowUps.length, 'reminders');
    
    return allFollowUps;
  };

  // Get calls for a specific date (from both leads and reminders)
  const getCallsForDate = (date: Date) => {
    // console.log('📅 LeadsCalendar: Getting calls for date:', format(date, 'yyyy-MM-dd'));
    
    const leadCalls = leads?.filter(lead => {
      if (lead.callDate) {
        let callDate: Date;
        try {
          if (lead.callDate instanceof Date) {
            callDate = lead.callDate;
          } else if (typeof lead.callDate === 'string' && lead.callDate.trim()) {
            callDate = parseISO(lead.callDate);
          } else {
            return false;
          }
          const isSame = isSameDay(callDate, date);
          if (isSame) {
            console.log('📅 LeadsCalendar: Found call for lead:', lead.name || lead.leadName, 'on', format(date, 'yyyy-MM-dd'));
          }
          return isSame;
        } catch (error) {
          console.warn('Invalid callDate for lead:', lead.id, lead.callDate);
          return false;
        }
      }
      return false;
    }) || [];

    const reminderCalls = reminders.filter(reminder => {
      if (reminder.type === 'call') {
        const reminderDateTime = new Date(`${reminder.dueDate.toISOString().split('T')[0]}T${reminder.reminderTime}`);
        return isSameDay(reminderDateTime, date);
      }
      return false;
    }).map(reminder => ({
      id: `reminder-${reminder.id}`,
      leadName: reminder.leadName,
      name: reminder.leadName,
      contact: reminder.leadPhone,
      phone: reminder.leadPhone,
      emailId: reminder.leadEmail,
      email: reminder.leadEmail,
      status: reminder.status,
      source: 'Reminder',
      assignedTo: reminder.assignedTo,
      callDate: reminder.dueDate,
      priority: reminder.priority,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      type: 'lead' as const,
      isReminder: true,
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      reminderType: reminder.type
    }));

    return [...leadCalls, ...reminderCalls];
  };

  // Get visits for a specific date (from both leads and reminders)
  const getVisitsForDate = (date: Date) => {
    // console.log('📅 LeadsCalendar: Getting visits for date:', format(date, 'yyyy-MM-dd'));
    // console.log('📅 LeadsCalendar: Available reminders:', reminders.map(r => ({ id: r.id, type: r.type, title: r.title, dueDate: r.dueDate })));
    
    const leadVisits = leads?.filter(lead => {
      if (lead.visitDate) {
        let visitDate: Date;
        try {
          if (lead.visitDate instanceof Date) {
            visitDate = lead.visitDate;
          } else if (typeof lead.visitDate === 'string' && lead.visitDate.trim()) {
            visitDate = parseISO(lead.visitDate);
          } else {
            return false;
          }
          return isSameDay(visitDate, date);
        } catch (error) {
          console.warn('Invalid visitDate for lead:', lead.id, lead.visitDate);
          return false;
        }
      }
      return false;
    }) || [];

    const reminderVisits = reminders.filter(reminder => {
      // console.log('📅 LeadsCalendar: Checking reminder:', reminder.id, 'type:', reminder.type, 'for visit filtering');
      if (reminder.type === 'visit' || reminder.type === 'meeting') {
        const reminderDateTime = new Date(`${reminder.dueDate.toISOString().split('T')[0]}T${reminder.reminderTime}`);
        const isSame = isSameDay(reminderDateTime, date);
        // console.log('📅 LeadsCalendar: Reminder', reminder.id, 'matches date:', isSame, 'reminderDateTime:', reminderDateTime, 'targetDate:', date);
        return isSame;
      }
      return false;
    }).map(reminder => ({
      id: `reminder-${reminder.id}`,
      leadName: reminder.leadName,
      name: reminder.leadName,
      contact1: reminder.leadPhone,
      phone: reminder.leadPhone,
      emailId: reminder.leadEmail,
      email: reminder.leadEmail,
      status: reminder.status,
      source: 'Reminder',
      assignedTo: reminder.assignedTo,
      visitDate: reminder.dueDate,
      priority: reminder.priority,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      type: 'lead' as const,
      isReminder: true,
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      reminderType: reminder.type
    }));

    return [...leadVisits, ...reminderVisits];
  };

  // Get admissions for a specific date (from both leads and reminders)
  const getAdmissionsForDate = (date: Date) => {
    const leadAdmissions = leads?.filter(lead => {
      if (lead.admissionDate) {
        let admissionDate: Date;
        try {
          if (lead.admissionDate instanceof Date) {
            admissionDate = lead.admissionDate;
          } else if (typeof lead.admissionDate === 'string' && lead.admissionDate.trim()) {
            admissionDate = parseISO(lead.admissionDate);
          } else {
            return false;
          }
          return isSameDay(admissionDate, date);
        } catch (error) {
          console.warn('Invalid admissionDate for lead:', lead.id, lead.admissionDate);
          return false;
        }
      }
      return false;
    }) || [];

    const reminderAdmissions = reminders.filter(reminder => {
      if (reminder.type === 'admission') {
        const reminderDateTime = new Date(`${reminder.dueDate.toISOString().split('T')[0]}T${reminder.reminderTime}`);
        return isSameDay(reminderDateTime, date);
      }
      return false;
    }).map(reminder => ({
      id: `reminder-${reminder.id}`,
      leadName: reminder.leadName,
      name: reminder.leadName,
      contact1: reminder.leadPhone,
      phone: reminder.leadPhone,
      emailId: reminder.leadEmail,
      email: reminder.leadEmail,
      status: reminder.status,
      source: 'Reminder',
      assignedTo: reminder.assignedTo,
      admissionDate: reminder.dueDate,
      priority: reminder.priority,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      type: 'lead' as const,
      isReminder: true,
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      reminderType: reminder.type
    }));

    return [...leadAdmissions, ...reminderAdmissions];
  };

  // Get leads added on their enquiry date
  const getLeadsAddedForDate = (date: Date) => {
    // console.log('📅 LeadsCalendar: Getting enquiry leads for date:', format(date, 'yyyy-MM-dd'));
    
    const enquiryLeads = leads?.filter(lead => {
      if (!lead.enquiryDate) return false;
      
      let enquiryDate: Date;
      try {
        if (lead.enquiryDate instanceof Date) {
          enquiryDate = lead.enquiryDate;
        } else if (typeof lead.enquiryDate === 'string' && lead.enquiryDate.trim()) {
          enquiryDate = parseISO(lead.enquiryDate);
        } else {
          return false;
        }
        
        const isSame = isSameDay(enquiryDate, date);
        if (isSame) {
          console.log('📅 LeadsCalendar: Found enquiry lead:', lead.name || lead.leadName, 'enquiry date:', format(enquiryDate, 'yyyy-MM-dd'));
        }
        return isSame;
      } catch (error) {
        console.warn('Invalid enquiryDate for lead:', lead.id, lead.enquiryDate);
        return false;
      }
    }) || [];
    
    // console.log('📅 LeadsCalendar: Total enquiry leads for', format(date, 'yyyy-MM-dd'), ':', enquiryLeads.length);
    return enquiryLeads;
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
      "Lost": "bg-gray-600 text-white",
    };
    return colors[status] || "bg-gray-600 text-white";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-100 text-blue-800';
      case 'visit': 
      case 'meeting': return 'bg-purple-100 text-purple-800';
      case 'admission': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to determine event type for filtering
  const getEventType = (lead: any) => {
    if (lead.isReminder) {
      // For reminders, check the reminder type
      if (lead.reminderType === 'call') return 'call';
      if (lead.reminderType === 'visit' || lead.reminderType === 'meeting') return 'visit';
      if (lead.reminderType === 'followup') return 'followup';
      if (lead.reminderType === 'admission') return 'admission';
      // Fallback to title-based detection
      const title = lead.reminderTitle?.toLowerCase() || '';
      if (title.includes('call')) return 'call';
      if (title.includes('visit') || title.includes('meeting')) return 'visit';
      if (title.includes('follow')) return 'followup';
      if (title.includes('admission')) return 'admission';
      return 'other';
    } else {
      // For regular leads, check date fields
      if (lead.callDate) return 'call';
      if (lead.visitDate) return 'visit';
      if (lead.followUpDate) return 'followup';
      if (lead.admissionDate) return 'admission';
      return 'other';
    }
  };

  const handleDateClick = (date: Date) => {
    const dateFollowUps = getFollowUpsForDate(date);
    const dateCalls = getCallsForDate(date);
    const dateVisits = getVisitsForDate(date);
    const dateAdmissions = getAdmissionsForDate(date);
    const dateLeadsAdded = getLeadsAddedForDate(date);
    
    console.log('📅 LeadsCalendar: Date clicked:', format(date, 'yyyy-MM-dd'));
    console.log('📅 LeadsCalendar: Found events:', {
      followUps: dateFollowUps.length,
      calls: dateCalls.length,
      visits: dateVisits.length,
      admissions: dateAdmissions.length,
      newLeads: dateLeadsAdded.length,
      total: dateFollowUps.length + dateCalls.length + dateVisits.length + dateAdmissions.length + dateLeadsAdded.length
    });
    
    setSelectedDate(date);
    setSelectedLeads([...dateFollowUps, ...dateCalls, ...dateVisits, ...dateAdmissions, ...dateLeadsAdded]);
    setShowDateDialog(true);
    onDateClick(date);
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      console.log('📅 LeadsCalendar: Updating status for lead:', leadId, 'to:', newStatus);
      
      await onStatusUpdate(leadId, newStatus);
      
      // Dispatch comprehensive sync events
      dataSyncService.syncStatusUpdate(leadId, newStatus);
      dataSyncService.forceRefresh('calendar');

      // Dispatch global events for immediate UI updates
      window.dispatchEvent(new CustomEvent('statusUpdated', {
        detail: {
          leadId,
          newStatus,
          action: 'updated',
          source: 'calendar',
          timestamp: Date.now()
        }
      }));

      window.dispatchEvent(new CustomEvent('leadDataUpdated', {
        detail: {
          leadId,
          updates: { status: newStatus },
          action: 'updated',
          source: 'calendar',
          timestamp: Date.now()
        }
      }));

      setSelectedLeads(prev => 
        prev.map(lead => 
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
    } catch (error) {
      console.error('📅 LeadsCalendar: Error updating status:', error);
    }
  };

  // Handle adding event to existing lead
  const handleAddEventToLead = async () => {
    if (!selectedLeadForEvent || !eventDate) return;

    const updates: Partial<Lead> = {};
    const dateValue = new Date(eventDate);

    switch (eventType) {
      case 'followup':
        updates.followUpDate = dateValue;
        updates.followUpNotes = eventNotes;
        break;
      case 'call':
        updates.callDate = dateValue;
        break;
      case 'visit':
        updates.visitDate = dateValue;
        break;
      case 'admission':
        updates.admissionDate = dateValue;
        break;
    }

    try {
      // Update the lead data
      await onUpdateLead(selectedLeadForEvent.id, updates);
      
      // Create reminder for the event
      if (userProfile?.centreId) {
        const reminderData = {
          leadId: selectedLeadForEvent.id,
          leadName: selectedLeadForEvent.name || selectedLeadForEvent.leadName || 'Unknown Lead',
          leadPhone: selectedLeadForEvent.phone || selectedLeadForEvent.contact || '',
          leadEmail: selectedLeadForEvent.email || selectedLeadForEvent.emailId || '',
          title: `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} - ${selectedLeadForEvent.name || selectedLeadForEvent.leadName}`,
          description: eventNotes || `${eventType} scheduled for ${selectedLeadForEvent.name || selectedLeadForEvent.leadName}`,
          dueDate: Timestamp.fromDate(dateValue),
          reminderTime: '09:00', // Default time for calendar-created reminders
          status: 'pending' as const,
          priority: 'medium' as const,
          type: (eventType === 'visit' ? 'visit' : eventType) as 'call' | 'meeting' | 'followup' | 'admission' | 'visit',
          notes: eventNotes,
          assignedTo: selectedLeadForEvent.assignedTo || userProfile.firstName || '',
          centreId: userProfile.centreId,
          createdBy: userProfile.uid || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          updatedBy: userProfile.uid || ''
        };

        await addDoc(collection(db, 'reminders'), reminderData);
        console.log('📅 LeadsCalendar: Reminder created for event:', reminderData);
      }
      
      // Use calendar sync service for better synchronization
      calendarSyncService.forceRefresh();
      
      // Dispatch comprehensive sync events
      dataSyncService.syncLeadData(selectedLeadForEvent.id, updates);
      dataSyncService.forceRefresh('calendar');
      
      // Dispatch global events for immediate UI updates
      window.dispatchEvent(new CustomEvent('leadDataUpdated', {
        detail: {
          leadId: selectedLeadForEvent.id,
          updates,
          action: 'updated',
          source: 'calendar',
          timestamp: Date.now()
        }
      }));

      window.dispatchEvent(new CustomEvent('calendarUpdated', {
        detail: {
          leadId: selectedLeadForEvent.id,
          eventType,
          eventDate: dateValue,
          action: 'updated',
          source: 'calendar',
          timestamp: Date.now()
        }
      }));

      window.dispatchEvent(new CustomEvent('reminderUpdated', {
        detail: {
          leadId: selectedLeadForEvent.id,
          eventType,
          eventDate: dateValue,
          action: 'created',
          source: 'calendar',
          timestamp: Date.now()
        }
      }));
      
      // Show notification
      setNotificationMessage(`Event and reminder added to ${selectedLeadForEvent.name || selectedLeadForEvent.leadName} for ${format(dateValue, 'MMM dd, yyyy')}`);
      setShowNotification(true);
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      
      // Reset form
      setSelectedLeadForEvent(null);
      setEventType('followup');
      setEventDate('');
      setEventNotes('');
      setShowLeadSelector(false);
    } catch (error) {
      console.error('📅 LeadsCalendar: Error adding event:', error);
      setNotificationMessage('Error adding event. Please try again.');
      setShowNotification(true);
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    }
  };

  // Filter leads for selection
  const filteredLeads = leads?.filter(lead => {
    const leadName = lead.name || lead.leadName || '';
    const leadPhone = lead.phone || lead.contact || '';
    const leadEmail = lead.email || lead.emailId || '';
    
    return (
      leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leadPhone.includes(searchTerm) ||
      (leadEmail && leadEmail.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }) || [];

  const calendarStats = useMemo(() => {
    const totalFollowUps = leads?.filter(l => l.followUpDate).length || 0;
    const totalCalls = leads?.filter(l => l.callDate).length || 0;
    const totalVisits = leads?.filter(l => l.visitDate).length || 0;
    const totalAdmissions = leads?.filter(l => l.admissionDate).length || 0;
    const totalEnquiries = leads?.filter(l => l.enquiryDate).length || 0;
    const overdueFollowUps = leads?.filter(lead => {
      if (!lead.followUpDate) return false;
      let followUpDate: Date;
      try {
        if (lead.followUpDate instanceof Date) {
          followUpDate = lead.followUpDate;
        } else if (typeof lead.followUpDate === 'string' && lead.followUpDate.trim()) {
          followUpDate = parseISO(lead.followUpDate);
        } else {
          return false;
        }
        return followUpDate < new Date();
      } catch (error) {
        console.warn('Invalid followUpDate for lead:', lead.id, lead.followUpDate);
        return false;
      }
    }).length || 0;

    return { totalFollowUps, totalCalls, totalVisits, totalAdmissions, totalEnquiries, overdueFollowUps };
  }, [leads]);



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <CalendarIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Lead Events Calendar</h1>
              <p className="text-blue-100">Track follow-ups, calls, visits, and admissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <Card className="border-0 shadow-lg calendar-container">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              className="ml-2"
            >
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
                  {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              const dayFollowUps = getFollowUpsForDate(day);
              const dayCalls = getCallsForDate(day);
              const dayVisits = getVisitsForDate(day);
              const dayAdmissions = getAdmissionsForDate(day);
              const dayLeadsAdded = getLeadsAddedForDate(day);
              const hasFollowUps = dayFollowUps.length > 0;
              const hasCalls = dayCalls.length > 0;
              const hasVisits = dayVisits.length > 0;
              const hasAdmissions = dayAdmissions.length > 0;
              const hasLeadsAdded = dayLeadsAdded.length > 0;
              const hasHighPriority = [...dayFollowUps, ...dayCalls, ...dayVisits, ...dayAdmissions].some(lead => lead.priority === 'high');
              const totalEvents = dayFollowUps.length + dayCalls.length + dayVisits.length + dayAdmissions.length + dayLeadsAdded.length;
              
              // Debug: Log enquiry leads for current month days
              if (isCurrentMonth && hasLeadsAdded) {
                console.log('📅 LeadsCalendar: Day', format(day, 'yyyy-MM-dd'), 'has', dayLeadsAdded.length, 'enquiry leads:', 
                  dayLeadsAdded.map(lead => lead.name || lead.leadName)
                );
              }
              
              // Debug: Log events for current month days
              if (isCurrentMonth && totalEvents > 0) {
                console.log('📅 LeadsCalendar: Day', format(day, 'yyyy-MM-dd'), 'has', totalEvents, 'events:', {
                  followUps: dayFollowUps.length,
                  calls: dayCalls.length,
                  visits: dayVisits.length,
                  admissions: dayAdmissions.length
                });
              }

              return (
                <div
                  key={index}
                  onClick={() => handleDateClick(day)}
                  onMouseEnter={(e) => {
                    if (totalEvents > 0) {
                      // Clear any existing timeout immediately
                      if (window.hoverTimeout) {
                        clearTimeout(window.hoverTimeout);
                        window.hoverTimeout = null;
                      }
                      
                      // Small delay to prevent accidental triggers
                      window.hoverTimeout = setTimeout(() => {
                        // Set hover state
                        setHoveredDate(day);
                        setShowTooltip(true);
                        
                        // Calculate position
                        const tooltipWidth = 380;
                        const tooltipHeight = 300;
                        
                        let x = e.clientX + 10;
                        let y = e.clientY;
                        
                        // Adjust horizontal position if it would go off-screen
                        if (x + tooltipWidth > window.innerWidth - 20) {
                          x = e.clientX - tooltipWidth - 10;
                        }
                        
                        // Adjust vertical position if it would go off-screen
                        if (y + tooltipHeight > window.innerHeight - 20) {
                          y = window.innerHeight - tooltipHeight - 20;
                        }
                        if (y < 20) {
                          y = 20;
                        }
                        
                        setTooltipPosition({ x, y });
                      }, 100); // 100ms delay
                    }
                  }}
                  onMouseMove={(e) => {
                    // Update position as mouse moves within the cell
                    if (hoveredDate && showTooltip && totalEvents > 0) {
                      const tooltipWidth = 380;
                      const tooltipHeight = 300;
                      
                      let x = e.clientX + 10;
                      let y = e.clientY;
                      
                      // Adjust horizontal position if it would go off-screen
                      if (x + tooltipWidth > window.innerWidth - 20) {
                        x = e.clientX - tooltipWidth - 10;
                      }
                      
                      // Adjust vertical position if it would go off-screen
                      if (y + tooltipHeight > window.innerHeight - 20) {
                        y = window.innerHeight - tooltipHeight - 20;
                      }
                      if (y < 20) {
                        y = 20;
                      }
                      
                      setTooltipPosition({ x, y });
                    }
                  }}
                  onMouseLeave={(e) => {
                    // Check if mouse is moving to the tooltip
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    if (relatedTarget && relatedTarget.closest('.hover-tooltip')) {
                      // Mouse is moving to tooltip, don't hide
                      return;
                    }
                    
                    // Add a delay to prevent flickering when moving between elements
                    window.hoverTimeout = setTimeout(() => {
                      setHoveredDate(null);
                      setShowTooltip(false);
                    }, 200);
                  }}
                  className={cn(
                    "h-24 p-2 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 relative group",
                    isCurrentDay && "bg-gradient-to-br from-blue-400 to-blue-500 text-white border-blue-400 shadow-lg",
                    !isCurrentMonth && "text-gray-400",
                    hasFollowUps && !isCurrentDay && "bg-blue-50 border-blue-200",
                    hasCalls && !isCurrentDay && "bg-green-50 border-green-200",
                    hasVisits && !isCurrentDay && "bg-purple-50 border-purple-200",
                    hasAdmissions && !isCurrentDay && "bg-emerald-50 border-emerald-200",
                    totalEvents > 0 && "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-semibold",
                      isCurrentDay && "text-white"
                    )}>
                          {getDate(day)}
                    </span>
                    <div className="flex items-center gap-1">
                      {hasHighPriority && (
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      )}
                      {hasLeadsAdded && (
                        <div className={cn(
                          "flex items-center gap-1 rounded-full px-1.5 py-1",
                          isCurrentDay 
                            ? "bg-orange-400/90 backdrop-blur-sm border border-orange-300" 
                            : "bg-orange-100 border border-orange-300"
                        )}>
                          <FileText className={cn(
                            "w-3 h-3",
                            isCurrentDay ? "text-orange-900" : "text-orange-700"
                          )} />
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentDay ? "text-orange-900" : "text-orange-800"
                          )}>{dayLeadsAdded.length}</span>
                        </div>
                      )}
                    </div>
                  </div>

                      {/* Event Indicators with Icons */}
                  {(hasFollowUps || hasCalls || hasVisits || hasAdmissions || hasLeadsAdded) && (
                    <div className="flex flex-wrap items-center gap-1 mt-2 mb-1">
                      {hasLeadsAdded && (
                        <div className={cn(
                          "flex items-center gap-1 rounded-md px-2 py-1 border-2 shadow-sm",
                          isCurrentDay 
                            ? "bg-orange-400/90 backdrop-blur-sm border-orange-300" 
                            : "bg-orange-100 border-orange-300"
                        )} title={`${dayLeadsAdded.length} New Enquiries Added`}>
                          <FileText className={cn(
                            "w-3.5 h-3.5",
                            isCurrentDay ? "text-orange-900" : "text-orange-700"
                          )} />
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentDay ? "text-orange-900" : "text-orange-800"
                          )}>{dayLeadsAdded.length}</span>
                        </div>
                      )}
                      {hasFollowUps && (
                        <div className="flex flex-col gap-1">
                          {/* Lead Follow-ups */}
                          {dayFollowUps.filter(lead => !lead.isReminder).length > 0 && (
                            <div className={cn(
                              "flex items-center gap-1 rounded-md px-2 py-1 border-2 shadow-sm",
                              isCurrentDay 
                                ? "bg-blue-400/90 backdrop-blur-sm border-blue-300" 
                                : "bg-blue-100 border-blue-300"
                            )} title={`${dayFollowUps.filter(lead => !lead.isReminder).length} Lead Follow-ups`}>
                              <Clock className={cn(
                                "w-3.5 h-3.5",
                                isCurrentDay ? "text-white" : "text-blue-700"
                              )} />
                              <span className={cn(
                                "text-xs font-bold",
                                isCurrentDay ? "text-white" : "text-blue-800"
                              )}>{dayFollowUps.filter(lead => !lead.isReminder).length}</span>
                            </div>
                          )}
                          {/* Reminder Follow-ups */}
                          {dayFollowUps.filter(lead => lead.isReminder).length > 0 && (
                            <div className={cn(
                              "flex items-center gap-1 rounded-md px-2 py-1 border-2 shadow-sm",
                              isCurrentDay 
                                ? "bg-indigo-400/90 backdrop-blur-sm border-indigo-300" 
                                : "bg-indigo-100 border-indigo-300"
                            )} title={`${dayFollowUps.filter(lead => lead.isReminder).length} Follow-up Reminders`}>
                              <Bell className={cn(
                                "w-3.5 h-3.5",
                                isCurrentDay ? "text-white" : "text-indigo-700"
                              )} />
                              <span className={cn(
                                "text-xs font-bold",
                                isCurrentDay ? "text-white" : "text-indigo-800"
                              )}>{dayFollowUps.filter(lead => lead.isReminder).length}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {hasCalls && (
                        <div className={cn(
                          "flex items-center gap-1 rounded-md px-2 py-1 border-2 shadow-sm",
                          isCurrentDay 
                            ? "bg-green-400/90 backdrop-blur-sm border-green-300" 
                            : "bg-green-100 border-green-300"
                        )} title={`${dayCalls.length} Calls`}>
                          <Phone className={cn(
                            "w-3.5 h-3.5",
                            isCurrentDay ? "text-white" : "text-green-700"
                          )} />
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentDay ? "text-white" : "text-green-800"
                          )}>{dayCalls.length}</span>
                        </div>
                      )}
                      {hasVisits && (
                        <div className={cn(
                          "flex items-center gap-1 rounded-md px-2 py-1 border-2 shadow-sm",
                          isCurrentDay 
                            ? "bg-purple-400/90 backdrop-blur-sm border-purple-300" 
                            : "bg-purple-100 border-purple-300"
                        )} title={`${dayVisits.length} Visits`}>
                          <User className={cn(
                            "w-3.5 h-3.5",
                            isCurrentDay ? "text-white" : "text-purple-700"
                          )} />
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentDay ? "text-white" : "text-purple-800"
                          )}>{dayVisits.length}</span>
                        </div>
                      )}
                      {hasAdmissions && (
                        <div className={cn(
                          "flex items-center gap-1 rounded-md px-2 py-1 border-2 shadow-sm",
                          isCurrentDay 
                            ? "bg-emerald-400/90 backdrop-blur-sm border-emerald-300" 
                            : "bg-emerald-100 border-emerald-300"
                        )} title={`${dayAdmissions.length} Admissions`}>
                          <School className={cn(
                            "w-3.5 h-3.5",
                            isCurrentDay ? "text-white" : "text-emerald-700"
                          )} />
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentDay ? "text-white" : "text-emerald-800"
                          )}>{dayAdmissions.length}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Event Count Badge */}
                  {totalEvents > 0 && (
                    <Badge className={cn(
                      "absolute top-1 right-1 text-xs font-bold text-white transition-colors shadow-md",
                      isCurrentDay ? "bg-orange-500/90 backdrop-blur-sm border border-orange-300" : "bg-orange-500 hover:bg-orange-600"
                    )}>
                      {totalEvents}
                    </Badge>
                  )}

                  {/* Priority Indicator */}
                  {hasHighPriority && (
                    <div className="absolute bottom-1 right-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full animate-pulse",
                        isCurrentDay ? "bg-yellow-300" : "bg-red-500"
                      )}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hover Tooltip */}
      {hoveredDate && showTooltip && (
        <>
          {process.env.NODE_ENV === 'development' && console.log('Rendering tooltip for:', hoveredDate, 'position:', tooltipPosition)}
        <div
          className="fixed z-[99999] max-w-2xl max-h-[80vh] overflow-y-auto bg-white border-0 shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-200 hover-tooltip backdrop-blur-sm"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            minWidth: '420px',
            maxWidth: '520px'
          }}
          onMouseEnter={() => {
            // Keep tooltip visible when hovering over it
            if (window.hoverTimeout) {
              clearTimeout(window.hoverTimeout);
              window.hoverTimeout = null;
            }
          }}
          onMouseLeave={(e) => {
            // Hide tooltip when mouse leaves the tooltip
            window.hoverTimeout = setTimeout(() => {
              setHoveredDate(null);
              setShowTooltip(false);
            }, 150);
          }}
        >
          {/* Header with gradient background */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-t-2xl p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30">
                    <CalendarDays className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {format(hoveredDate, 'EEEE, MMMM d, yyyy')}
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                      Events and activities for this day
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setHoveredDate(null);
                    setShowTooltip(false);
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors duration-200"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          </div>
          
          <div className="p-6 space-y-6">
            {(() => {
              const dayFollowUps = getFollowUpsForDate(hoveredDate);
              const dayCalls = getCallsForDate(hoveredDate);
              const dayVisits = getVisitsForDate(hoveredDate);
              const dayAdmissions = getAdmissionsForDate(hoveredDate);
              const dayLeadsAdded = getLeadsAddedForDate(hoveredDate);
              
              return (
                <>
                  {/* Event Categories Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {dayFollowUps.length > 0 && (
                      <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200/50 rounded-full -translate-y-8 translate-x-8"></div>
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="p-2.5 bg-blue-500 rounded-xl shadow-sm">
                            <Clock className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">Follow-ups</div>
                            <div className="text-sm text-blue-600 font-medium">{dayFollowUps.length} scheduled</div>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white text-sm font-bold rounded-full">
                            {dayFollowUps.length}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {dayCalls.length > 0 && (
                      <div className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-200/50 rounded-full -translate-y-8 translate-x-8"></div>
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="p-2.5 bg-green-500 rounded-xl shadow-sm">
                            <Phone className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">Calls</div>
                            <div className="text-sm text-green-600 font-medium">{dayCalls.length} scheduled</div>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 bg-green-500 text-white text-sm font-bold rounded-full">
                            {dayCalls.length}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {dayVisits.length > 0 && (
                      <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-purple-200/50 rounded-full -translate-y-8 translate-x-8"></div>
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="p-2.5 bg-purple-500 rounded-xl shadow-sm">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">Visits</div>
                            <div className="text-sm text-purple-600 font-medium">{dayVisits.length} scheduled</div>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 bg-purple-500 text-white text-sm font-bold rounded-full">
                            {dayVisits.length}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {dayAdmissions.length > 0 && (
                      <div className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-200/50 rounded-full -translate-y-8 translate-x-8"></div>
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="p-2.5 bg-green-500 rounded-xl shadow-sm">
                            <School className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">Admissions</div>
                            <div className="text-sm text-green-600 font-medium">{dayAdmissions.length} scheduled</div>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 bg-green-500 text-white text-sm font-bold rounded-full">
                            {dayAdmissions.length}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {dayLeadsAdded.length > 0 && (
                      <div className="group relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105 shadow-md">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-orange-200/50 rounded-full -translate-y-8 translate-x-8"></div>
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="p-2.5 bg-orange-500 rounded-xl shadow-sm">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900">📄 New Enquiries</div>
                            <div className="text-sm text-orange-700 font-medium">{dayLeadsAdded.length} new enquiries</div>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 bg-orange-500 text-white text-sm font-bold rounded-full">
                            {dayLeadsAdded.length}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Total Events Summary */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 p-4">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gray-200/50 rounded-full -translate-y-10 translate-x-10"></div>
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                        <CalendarDays className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-lg">Total Events</div>
                        <div className="text-sm text-gray-600">All activities for this day</div>
                      </div>
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg font-bold rounded-full shadow-lg">
                        {dayFollowUps.length + dayCalls.length + dayVisits.length + dayAdmissions.length + dayLeadsAdded.length}
                      </div>
                    </div>
                  </div>
                  
                  {/* No Events Message */}
                  {dayFollowUps.length === 0 && dayCalls.length === 0 && dayVisits.length === 0 && dayAdmissions.length === 0 && dayLeadsAdded.length === 0 && (
                    <div className="text-center py-8 px-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <CalendarDays className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No events scheduled for this day</p>
                      <p className="text-sm text-gray-400 mt-1">Add follow-ups, calls, or other activities to see them here</p>
                    </div>
                  )}
                  
                  {/* Event Details Section */}
                  {([...dayLeadsAdded, ...dayFollowUps, ...dayCalls, ...dayVisits, ...dayAdmissions].length > 0) && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Info className="w-5 h-5 text-gray-600" />
                        </div>
                        <h5 className="text-lg font-semibold text-gray-800">Event Details</h5>
                      </div>
                      
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {[...dayLeadsAdded, ...dayFollowUps, ...dayCalls, ...dayVisits, ...dayAdmissions].slice(0, 5).map((lead, idx) => {
                          // Determine event type and icon based on which array the lead came from
                          let eventType = 'enquiry';
                          let EventIcon = FileText;
                          let iconColor = 'text-orange-500';
                          let bgColor = 'bg-orange-50';
                          let borderColor = 'border-orange-200';
                          
                          // Check which array this lead belongs to
                          const isInFollowUps = dayFollowUps.some(f => f.id === lead.id);
                          const isInCalls = dayCalls.some(c => c.id === lead.id);
                          const isInVisits = dayVisits.some(v => v.id === lead.id);
                          const isInAdmissions = dayAdmissions.some(a => a.id === lead.id);
                          const isInLeadsAdded = dayLeadsAdded.some(l => l.id === lead.id);
                          
                          if (isInFollowUps) {
                            if (lead.isReminder) {
                              eventType = 'followup-reminder';
                              EventIcon = Bell;
                              iconColor = 'text-indigo-500';
                              bgColor = 'bg-indigo-50';
                              borderColor = 'border-indigo-200';
                            } else {
                              eventType = 'followup';
                              EventIcon = Clock;
                              iconColor = 'text-blue-500';
                              bgColor = 'bg-blue-50';
                              borderColor = 'border-blue-200';
                            }
                          } else if (isInCalls) {
                            eventType = 'call';
                            EventIcon = Phone;
                            iconColor = 'text-green-500';
                            bgColor = 'bg-green-50';
                            borderColor = 'border-green-200';
                          } else if (isInVisits) {
                            eventType = 'visit';
                            EventIcon = User;
                            iconColor = 'text-purple-500';
                            bgColor = 'bg-purple-50';
                            borderColor = 'border-purple-200';
                          } else if (isInAdmissions) {
                            eventType = 'admission';
                            EventIcon = School;
                            iconColor = 'text-emerald-500';
                            bgColor = 'bg-emerald-50';
                            borderColor = 'border-emerald-200';
                          } else if (isInLeadsAdded) {
                            eventType = 'enquiry';
                            EventIcon = FileText;
                            iconColor = 'text-orange-500';
                            bgColor = 'bg-orange-50';
                            borderColor = 'border-orange-200';
                          }
                        
                        return (
                          <div key={`${lead.id}-${idx}`} className={`group flex items-center gap-4 p-4 ${bgColor} rounded-xl border-2 ${borderColor} hover:shadow-md transition-all duration-200 hover:scale-105`}>
                            <div className={`p-2.5 ${bgColor.replace('50', '100')} rounded-xl border border-gray-200`}>
                              <EventIcon className={`w-5 h-5 ${iconColor}`} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 text-base">{lead.name || lead.leadName}</div>
                              <div className="text-sm text-gray-600 mt-1">{lead.phone || lead.contact}</div>
                            </div>
                            <Badge variant="outline" className="text-xs font-medium bg-white/80 backdrop-blur-sm">
                              {eventType === 'followup-reminder' ? 'Follow-up Reminder' : 
                               eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                            </Badge>
                          </div>
                        );
                      })}
                      </div>
                      
                      {([...dayLeadsAdded, ...dayFollowUps, ...dayCalls, ...dayVisits, ...dayAdmissions].length > 5) && (
                        <div className="text-center py-3">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                            <span>+{([...dayLeadsAdded, ...dayFollowUps, ...dayCalls, ...dayVisits, ...dayAdmissions].length - 5)} more events</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        </>
      )}

      {/* Legend */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Calendar Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-600">Enquiries</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">Follow-ups</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              <span className="text-sm text-gray-600">Follow-up Reminders</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">Calls</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-600">Visits</span>
            </div>
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-gray-600">Admissions</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-600">High Priority</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>{notificationMessage}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotification(false)}
              className="text-white hover:text-white/80"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Lead Selector Dialog */}
      <Dialog open={showLeadSelector} onOpenChange={setShowLeadSelector}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-0 shadow-2xl">
          <DialogHeader className="pb-4 sm:pb-6 border-b border-gray-200/50">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl sm:rounded-2xl shadow-lg">
                <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Add Event to Existing Lead
                </div>
                <div className="text-xs sm:text-sm text-gray-600 font-normal mt-1">
                  Select a lead and schedule an event
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6 p-4">
            {/* Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Search Leads</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search leads by name, phone, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>

            {/* Lead Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Select Lead</Label>
              <div className="max-h-60 overflow-y-auto space-y-3 border rounded-lg p-2">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadForEvent(lead)}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all duration-200 hover:shadow-sm",
                      selectedLeadForEvent?.id === lead.id && "bg-blue-50 border-blue-200 shadow-md"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{lead.name || lead.leadName}</h4>
                        <p className="text-sm text-gray-600 mt-1">{lead.phone || lead.contact}</p>
                        {(lead.email || lead.emailId) && (
                          <p className="text-sm text-gray-500 mt-1">{lead.email || lead.emailId}</p>
                        )}
                      </div>
                      <Badge className={cn(getStatusColor(lead.status), "ml-3")}>
                        {lead.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Details */}
            {selectedLeadForEvent && (
              <div className="space-y-4 sm:space-y-6 border-t pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <h4 className="text-lg font-semibold text-gray-900">Event Details for {selectedLeadForEvent.name}</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="eventType" className="text-sm font-medium text-gray-700">Event Type</Label>
                    <Select value={eventType} onValueChange={(value: any) => setEventType(value)}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="followup">Follow-up</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="visit">Visit</SelectItem>
                        <SelectItem value="admission">Admission</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="eventDate" className="text-sm font-medium text-gray-700">Event Date</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                {eventType === 'followup' && (
                  <div className="space-y-2">
                    <Label htmlFor="eventNotes" className="text-sm font-medium text-gray-700">Notes</Label>
                    <Textarea
                      id="eventNotes"
                      placeholder="Enter follow-up notes..."
                      value={eventNotes}
                      onChange={(e) => setEventNotes(e.target.value)}
                      className="min-h-[100px] resize-none"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleAddEventToLead} 
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-11"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Event
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedLeadForEvent(null)}
                    className="h-11"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Date Details Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-0 shadow-2xl">
          <DialogHeader className="pb-4 sm:pb-6 border-b border-gray-200/50">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl sm:rounded-2xl shadow-lg">
                <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 font-normal mt-1">
                  Events and activities for this day
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedLeads.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <CalendarDays className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                No events scheduled
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                No follow-ups, calls, visits, or admissions scheduled for this date
              </p>
              <div className="text-sm text-gray-400 mb-6 p-3 bg-gray-50 rounded-lg">
                Debug: Selected date: {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'None'}
              </div>
              <Button 
                onClick={() => {
                  setShowDateDialog(false);
                  setShowLeadSelector(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-11 px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="all">All ({selectedLeads.length})</TabsTrigger>
                  <TabsTrigger value="enquiries">🆕 Enquiries ({selectedLeads.filter(l => l.enquiryDate).length})</TabsTrigger>
                  <TabsTrigger value="followups">Follow-ups ({selectedLeads.filter(l => getEventType(l) === 'followup').length})</TabsTrigger>
                  <TabsTrigger value="calls">Calls ({selectedLeads.filter(l => getEventType(l) === 'call').length})</TabsTrigger>
                  <TabsTrigger value="visits">Visits ({selectedLeads.filter(l => getEventType(l) === 'visit').length})</TabsTrigger>
                  <TabsTrigger value="admissions">Admissions ({selectedLeads.filter(l => getEventType(l) === 'admission').length})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                  {selectedLeads.map((lead) => (
                    <Card key={lead.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold">{lead.name || lead.leadName}</h4>
                            <Badge className={getStatusColor(lead.status)}>
                              {lead.status}
                            </Badge>
                            {lead.followUpDate && (
                              <Badge className="bg-blue-100 text-blue-800">
                                <Clock className="w-3 h-3 mr-1" />
                                Follow-up
                              </Badge>
                            )}
                            {lead.callDate && (
                              <Badge className="bg-green-100 text-green-800">
                                <Phone className="w-3 h-3 mr-1" />
                                Call
                              </Badge>
                            )}
                            {lead.visitDate && (
                              <Badge className="bg-purple-100 text-purple-800">
                                <User className="w-3 h-3 mr-1" />
                                Visit
                              </Badge>
                            )}
                            {lead.admissionDate && (
                              <Badge className="bg-emerald-100 text-emerald-800">
                                <School className="w-3 h-3 mr-1" />
                                Admission
                              </Badge>
                            )}
                            {lead.priority === 'high' && (
                              <Badge className="bg-red-100 text-red-800">
                                <Star className="w-3 h-3 mr-1" />
                                High Priority
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>{lead.phone || lead.contact}</span>
                            </div>
                                                              {(lead.email || lead.emailId) && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    <span>{lead.email || lead.emailId}</span>
                                  </div>
                                )}
                            <div className="flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              <span>Source: {lead.source}</span>
                            </div>
                              {lead.assignedTo && (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>Assigned: {lead.assignedTo}</span>
                              </div>
                            )}
                            {lead.followUpNotes && (
                              <div className="flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                <span>Notes: {lead.followUpNotes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Select
                            value={lead.status}
                            onValueChange={(value) => handleStatusChange(lead.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Other">Other</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="qualified">Qualified</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="admitted">Admitted</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onLeadClick(lead)}
                          >
                            <Eye className="w-4 h-4" />
          </Button>
          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onLeadEdit(lead)}
                          >
                            <Edit className="w-4 h-4" />
          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onLeadDelete(lead.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="enquiries" className="space-y-4 mt-4">
                  {selectedLeads
                    .filter(lead => lead.enquiryDate)
                    .map((lead) => (
                      <Card key={lead.id} className="p-4 border-l-4 border-l-yellow-400">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold">{lead.name || lead.leadName}</h4>
                              <Badge className="bg-yellow-100 text-yellow-800">
                                🆕 New Enquiry
                              </Badge>
                              <Badge className={getStatusColor(lead.status)}>
                                {lead.status}
                              </Badge>
                              {lead.priority === 'high' && (
                                <Badge className="bg-red-100 text-red-800">
                                  <Star className="w-3 h-3 mr-1" />
                                  High Priority
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <span>{lead.phone || lead.contact}</span>
                              </div>
                              {(lead.email || lead.emailId) && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4" />
                                  <span>{lead.email || lead.emailId}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                <span>Source: {lead.source}</span>
                              </div>
                              {lead.assignedTo && (
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  <span>Assigned: {lead.assignedTo}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>Enquiry Date: {lead.enquiryDate ? format(new Date(lead.enquiryDate), 'MMM dd, yyyy') : 'Not set'}</span>
                              </div>
                              {lead.notes && (
                                <div className="flex items-center gap-2">
                                  <Info className="w-4 h-4" />
                                  <span>Notes: {lead.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <Select
                              value={lead.status}
                              onValueChange={(value) => handleStatusChange(lead.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Other">Other</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="converted">Converted</SelectItem>
                                <SelectItem value="admitted">Admitted</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onLeadClick(lead)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onLeadEdit(lead)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onLeadDelete(lead.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                </TabsContent>

                <TabsContent value="followups" className="space-y-4 mt-4">
                  {selectedLeads
                    .filter(lead => getEventType(lead) === 'followup')
                    .map((lead) => (
                      <Card key={lead.id} className="p-4">
                        {/* Same content as above */}
                      </Card>
                    ))}
                </TabsContent>

                <TabsContent value="calls" className="space-y-4 mt-4">
                  {selectedLeads
                    .filter(lead => getEventType(lead) === 'call')
                    .map((lead) => (
                      <Card key={lead.id} className="p-4">
                        {/* Same content as above */}
                      </Card>
                    ))}
                </TabsContent>

                <TabsContent value="visits" className="space-y-4 mt-4">
                  {selectedLeads
                    .filter(lead => getEventType(lead) === 'visit')
                    .map((lead) => (
                      <Card key={lead.id} className="p-4">
                        {/* Same content as above */}
                      </Card>
                    ))}
                </TabsContent>

                <TabsContent value="admissions" className="space-y-4 mt-4">
                  {selectedLeads
                    .filter(lead => getEventType(lead) === 'admission')
                    .map((lead) => (
                      <Card key={lead.id} className="p-4">
                        {/* Same content as above */}
                      </Card>
                    ))}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsCalendar; 