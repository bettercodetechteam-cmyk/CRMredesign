import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLeadsStore } from "@/hooks/useCentreData";
import { usePageLoadingSignal } from "@/contexts/NavigationLoadingContext";
import {
  UserPlus,
  Search,
  Plus,
  Phone,
  Mail,
  User,
  Filter,
  Edit,
  Trash2,
  Download,
  CheckCircle,
  Upload,
  Check,
  Zap,
  X,
  Save,
  XCircle,
  PieChart,
  BarChart3,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Users,
  GraduationCap,
  Briefcase,
  Globe,
  Target,
  Activity,
  Clock,
  CalendarDays,
  MapPin,
  MessageSquare,
  BookOpen,
  GraduationCap as GraduationCapIcon,
  Building,
  Calendar,
  Eye,
  Wifi,
  RefreshCw,
  Bell,
  AlertCircle
} from "lucide-react";

import * as XLSX from "xlsx";
import whatsappIcon from "@/assets/whatsapp-color-svgrepo-com.svg";
import {
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
  limit,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import { dataSyncService } from "@/lib/dataSyncService";
import { reminderService } from "@/lib/reminderService";
import { calendarSyncService } from "@/lib/calendarSyncService";
import {
  getLeadDocRef,
  mapLeadFieldsToEnquiryUpdate,
} from "@/lib/leadDocumentUtils";
import { isWebsiteEnquiryLead, type LeadRecord } from "@/lib/centreDataStore";
import { isNestLeadsEnabled } from "@/lib/nestApi";
import {
  buildNestUpdatePayload,
  isNestBackedLead,
  mapNestLeadToUi,
  mapUiStatusToNest,
} from "@/lib/nestLeadMapper";
import { nestLeadsApi } from "@/services/nest/leadsApi";
import LeadForm from "@/components/LeadForm";
import { getSourceColor, sourceManagerEvents, normalizeSourceName, getAllSources, defaultSources } from "@/lib/sourceManager";
import { ZICA_CENTRE_ADDRESS } from "@/constants/centreAddress";
import { ALL_STANDARDIZED_COURSES, MODULAR_PROGRAMS } from "@/lib/leadDataCleaningService";
import { getCityAreaOptions } from "@/lib/maharashtraDistricts";
import StatsCard from "@/components/StatsCard";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
 } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import {
  assignContiguousSerialsToOrderedList,
  getNextSerialNumberFromItems,
  DEFAULT_DATE_SORT,
} from "@/lib/serialNumberUtils";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { cn, parseDate, isToday, isSameCalendarDay, parseLocalDateInput } from "@/lib/utils";
import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Loading from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import LeadsCalendarView from "@/components/LeadsCalendarView";
import LeadReminder from "@/components/LeadReminder";
import LeadStatusManager from "@/components/LeadStatusManager";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";


interface LeadStats {
  total: number;
  new: number;
  cold: number;
  warm: number;
  hot: number;
  notInterested: number;
  fake: number;
  dropped: number;
  done: number;
  instagram: number;
  facebook: number;
  justDial: number;
  mis: number;
  hoarding: number;
  pamphlet: number;
  radioAd: number;
}

interface Lead {
  id: string;
  srNo?: number;
  enquiryDate: string | Date;
  contactedDate?: string | Date;
  nextFollowUpDate?: string | Date;
  leadName: string;
  contact: string;
  emailId: string;
  course: string;
  courseDuration: string;
  education: string;
  source: string;
  cityArea: string;
  followUpDate?: string | Date;
  status: string;
  counselorName: string;
  remark?: string;
  feedbackCallRemarks?: string;
  centreHeadRemarks?: string;
  finalRemark?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  centreId?: string;
  assignedTo?: string;
  priority?: 'low' | 'medium' | 'high';
  type?: 'lead' | 'admission';
  courseInterest?: string;
  reminderDate?: string | Date;
  visitDate?: string | Date;
  callDate?: string | Date;
  admissionDate?: string | Date;
  followUpNotificationDone?: boolean;
  followUpDoneAt?: string | Date;
  notes?: string;
  followUpType?: 'call' | 'visit' | 'meeting' | 'admission';
  followUpNotes?: string;
}

const formatDate = (date: any) => {
  if (!date) return "-";
  try {
    let d: Date;
    
    // Handle Firestore Timestamp
    if (date && typeof date === 'object' && date.toDate) {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      // Handle different string formats
      if (date.includes('/')) {
        // Handle "5/8/2025" format
        const parts = date.split('/');
        if (parts.length === 3) {
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          d = new Date(date);
        }
      } else {
        d = new Date(date);
      }
    } else if (typeof date === 'number') {
      // Handle Excel serial date number
      d = new Date((date - 25569) * 86400 * 1000);
    } else {
      return "-";
    }
    
    if (isNaN(d.getTime())) {
      return "-";
    }
    
    // Format as DD/MM/YYYY
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return "-";
  }
};

const safeRender = (value: any) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  
  // Handle different data types
  if (typeof value === 'string') {
    const stringValue = value.trim();
    return stringValue === "" ? "-" : stringValue;
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value ? "Yes" : "No";
  }
  
  // Handle objects and arrays
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : "-";
    }
    return JSON.stringify(value);
  }
  
  try {
    const stringValue = value.toString().trim();
    return stringValue === "" ? "-" : stringValue;
  } catch (error) {
    return "-";
  }
};

// Enhanced data validation function
const validateAndRender = (value: any, fieldName: string = '') => {
  try {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    
    // Special handling for specific fields
    if (fieldName === 'contact' && typeof value === 'string') {
      // Clean phone number
      const cleaned = value.replace(/[^\d+]/g, '');
      return cleaned || "-";
    }
    
    if (fieldName === 'emailId' && typeof value === 'string') {
      // Basic email validation
      const email = value.trim().toLowerCase();
      return email || "-";
    }
    
    if (fieldName === 'course' && typeof value === 'string') {
      // Ensure course name is properly capitalized
      return value.trim() || "-";
    }
    
    return safeRender(value);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error rendering ${fieldName}:`, error);
    }
    return "-";
  }
};

// Debug function to log data issues
const debugLeadData = (lead: Lead, index: number) => {
  // Only log in development and limit to first few leads to prevent spam
  if (import.meta.env.MODE !== 'development' || index > 10) return;
  
  const issues = [];
  
  if (!lead.leadName || (typeof lead.leadName === 'string' && lead.leadName.trim() === '')) {
    issues.push('Missing Lead Name');
  }
  
  if (!lead.contact || (typeof lead.contact === 'string' && lead.contact.trim() === '')) {
    issues.push('Missing Contact');
  }
  
  if (!lead.course || (typeof lead.course === 'string' && lead.course.trim() === '')) {
    issues.push('Missing Course');
  }
  
  if (!lead.counselorName || (typeof lead.counselorName === 'string' && lead.counselorName.trim() === '')) {
    issues.push('Missing Counselor Name');
  }
  
  if (issues.length > 0) {
    // console.warn(`Lead ${index + 1} (ID: ${lead.id}) has issues:`, issues);
  }
};

// Distinct background color for each status (badge: solid bg + white text)
const STATUS_BADGE_COLORS: Record<string, string> = {
  "Admission Done": "bg-green-600 text-white",
  "Cold Lead": "bg-blue-600 text-white",
  "Hot Lead": "bg-red-600 text-white",
  "Not Interested": "bg-gray-700 text-white",
  "Visited": "bg-teal-600 text-white",
  "Placement": "bg-emerald-600 text-white",
  "Not Contacted": "bg-slate-600 text-white",
  "Job Seeker": "bg-indigo-600 text-white",
  "Other": "bg-violet-600 text-white",
  "New": "bg-violet-600 text-white",
  "Converted (Admission Done)": "bg-green-600 text-white",
  "Converted": "bg-green-600 text-white",
  "Done": "bg-green-600 text-white",
};

// Palette for custom/unknown statuses (distinct colors by hash of name)
const CUSTOM_STATUS_PALETTE = [
  "bg-violet-600 text-white",
  "bg-amber-600 text-white",
  "bg-cyan-600 text-white",
  "bg-rose-600 text-white",
  "bg-lime-600 text-white",
  "bg-fuchsia-600 text-white",
  "bg-sky-600 text-white",
  "bg-orange-600 text-white",
  "bg-pink-600 text-white",
  "bg-stone-600 text-white",
];

function getStatusColor(status: string): string {
  if (STATUS_BADGE_COLORS[status]) return STATUS_BADGE_COLORS[status];
  if (!status || typeof status !== "string") return "bg-gray-600 text-white";
  let hash = 0;
  for (let i = 0; i < status.length; i++) hash = ((hash << 5) - hash) + status.charCodeAt(i);
  const index = Math.abs(hash) % CUSTOM_STATUS_PALETTE.length;
  return CUSTOM_STATUS_PALETTE[index];
}

// Row background color based on status (light tint per status)
const STATUS_ROW_COLORS: Record<string, string> = {
  "Admission Done": "bg-green-50/80 hover:bg-green-100/80",
  "Cold Lead": "bg-blue-50/80 hover:bg-blue-100/80",
  "Hot Lead": "bg-red-50/80 hover:bg-red-100/80",
  "Not Interested": "bg-gray-100/80 hover:bg-gray-200/80",
  "Visited": "bg-teal-50/80 hover:bg-teal-100/80",
  "Placement": "bg-emerald-50/80 hover:bg-emerald-100/80",
  "Not Contacted": "bg-slate-50/80 hover:bg-slate-100/80",
  "Job Seeker": "bg-indigo-50/80 hover:bg-indigo-100/80",
  "Other": "bg-violet-50/80 hover:bg-violet-100/80",
  "New": "bg-violet-50/80 hover:bg-violet-100/80",
  "Converted (Admission Done)": "bg-green-50/80 hover:bg-green-100/80",
  "Converted": "bg-green-50/80 hover:bg-green-100/80",
  "Done": "bg-green-50/80 hover:bg-green-100/80",
};

const CUSTOM_ROW_PALETTE = [
  "bg-violet-50/80 hover:bg-violet-100/80",
  "bg-amber-50/80 hover:bg-amber-100/80",
  "bg-cyan-50/80 hover:bg-cyan-100/80",
  "bg-rose-50/80 hover:bg-rose-100/80",
  "bg-lime-50/80 hover:bg-lime-100/80",
  "bg-fuchsia-50/80 hover:bg-fuchsia-100/80",
  "bg-sky-50/80 hover:bg-sky-100/80",
  "bg-orange-50/80 hover:bg-orange-100/80",
  "bg-pink-50/80 hover:bg-pink-100/80",
  "bg-stone-100/80 hover:bg-stone-200/80",
];

function getRowBackgroundColor(status: string): string {
  if (STATUS_ROW_COLORS[status]) return STATUS_ROW_COLORS[status];
  if (!status || typeof status !== "string") return "bg-gray-50 hover:bg-gray-100";
  let hash = 0;
  for (let i = 0; i < status.length; i++) hash = ((hash << 5) - hash) + status.charCodeAt(i);
  const index = Math.abs(hash) % CUSTOM_ROW_PALETTE.length;
  return CUSTOM_ROW_PALETTE[index];
}



const getFollowUpTypeColor = (type: string) => {
  const colors = {
    "call": "bg-green-25 text-green-800 border-green-100",
    "visit": "bg-purple-25 text-purple-800 border-purple-100",
    "meeting": "bg-blue-25 text-blue-800 border-blue-100",
    "admission": "bg-emerald-25 text-emerald-800 border-emerald-100",
  };
  return colors[type.toLowerCase() as keyof typeof colors] || "bg-gray-25 text-gray-800 border-gray-100";
};

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;

// Memoized tab components to prevent unnecessary re-renders
const MemoizedLeadsCalendarView = React.memo(LeadsCalendarView);
const MemoizedLeadReminder = React.memo(LeadReminder);
const MemoizedAnalyticsDashboard = React.memo(AnalyticsDashboard);

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    leads: storeLeads,
    loading,
    isLive: isConnected,
    lastUpdate,
    refresh: refreshLeadsStore,
    applyLeadsUpdater,
    patchLead,
  } = useLeadsStore();
  const leadsData = storeLeads as unknown as Lead[];
  usePageLoadingSignal(loading);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCounselors, setSelectedCounselors] = useState<string[]>([]);
  const [enquiryDateFilter, setEnquiryDateFilter] = useState("");
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);
  const [courseFilterOpen, setCourseFilterOpen] = useState(false);
  const [cityFilterOpen, setCityFilterOpen] = useState(false);
  const [counselorFilterOpen, setCounselorFilterOpen] = useState(false);
  
  // Follow-up filter states
  const [followupStatusFilter, setFollowupStatusFilter] = useState("all");
  const [followupTypeFilter, setFollowupTypeFilter] = useState("all");
  const [followupDateFrom, setFollowupDateFrom] = useState("");
  const [followupDateTo, setFollowupDateTo] = useState("");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showScheduledOnly, setShowScheduledOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState<number>(100);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"list" | "calendar" | "reminders" | "analytics">("list");
  const [showRemindersSection, setShowRemindersSection] = useState(false);
  const [remindersTabActive, setRemindersTabActive] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [colorScheme, setColorScheme] = useState<{[key: string]: {backgroundColor: string, textColor: string}}>(() => {
    const saved = localStorage.getItem('leadColorScheme');
    return saved ? JSON.parse(saved) : {};
  });
  const dataLoaded = !loading && leadsData.length >= 0;
  const lastRefreshTime = lastUpdate?.getTime() ?? 0;
  // Add debounced tab switching
  const [pendingTabChange, setPendingTabChange] = useState<string | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  // Open lead from follow-up notification link (?leadId=...)
  useEffect(() => {
    const leadId = searchParams.get("leadId");
    if (!leadId || loading) return;

    const clearLeadIdParam = () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("leadId");
          return next;
        },
        { replace: true }
      );
    };

    const lead = leadsData.find((l) => String(l.id) === leadId);
    if (lead) {
      setSelectedLead(lead);
      setShowViewDialog(true);
      setActiveTab("list");
      clearLeadIdParam();
      return;
    }

    if (leadsData.length > 0) {
      clearLeadIdParam();
      toast({
        title: "Lead not found",
        description: "This lead may have been removed or is no longer available.",
        variant: "destructive",
      });
    }
  }, [leadsData, loading, searchParams, setSearchParams, toast]);

  const handleLeadsTableWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = tableScrollRef.current;
    if (!container) return;

    const hasHorizontalOverflow = container.scrollWidth > container.clientWidth;
    if (!hasHorizontalOverflow) return;

    if (event.shiftKey || Math.abs(event.deltaX) > 0) {
      const horizontalDelta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
      container.scrollLeft += horizontalDelta;
      event.preventDefault();
    }
  }, []);
  
  // Debounce search term to reduce re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Function to check if lead was created today based on enquiry date
  const isTodayLead = (lead: Lead) => {
    return isToday(lead.enquiryDate) || isToday(lead.createdAt);
  };

  const getLeadFollowUpDate = (lead: Lead): Date | null =>
    parseDate(lead.followUpDate) || parseDate(lead.nextFollowUpDate);

  // Define filteredLeads early to avoid initialization errors
  const filteredLeads = useMemo(() => {
    if (!leadsData.length) return [];
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    const filtered = leadsData.filter((lead) => {
      const matchesSearch =
        (lead.leadName?.toLowerCase() || "").includes(searchLower) ||
        (lead.contact?.toLowerCase() || "").includes(searchLower) ||
        (lead.emailId?.toLowerCase() || "").includes(searchLower) ||
        (lead.counselorName?.toLowerCase() || "").includes(searchLower);

      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.some((status) =>
          lead.status === status || (status === "Other" && (lead.status === "Other" || lead.status === "New"))
        );
      const matchesSource = !selectedSource || lead.source === selectedSource;
      const matchesCourse =
        selectedCourses.length === 0 ||
        selectedCourses.some((course) => lead.course === course);
      const matchesCity = !selectedCity || lead.cityArea === selectedCity;
      const matchesCounselor =
        selectedCounselors.length === 0 ||
        selectedCounselors.some(
          (counselor) => lead.counselorName === counselor || (counselor === "NC" && lead.counselorName === "Gaurav")
        );
      const matchesToday = !showTodayOnly || isTodayLead(lead);
      
      // Enquiry date filter
      const matchesEnquiryDate =
        !enquiryDateFilter ||
        isSameCalendarDay(lead.enquiryDate, enquiryDateFilter) ||
        isSameCalendarDay(lead.createdAt, enquiryDateFilter);

      const followUpDate = getLeadFollowUpDate(lead);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Follow-up filters
      const matchesFollowupStatus = followupStatusFilter === "all" || (() => {
        if (followupStatusFilter === "hasFollowup") {
          return !!followUpDate;
        } else if (followupStatusFilter === "noFollowup") {
          return !followUpDate;
        } else if (followupStatusFilter === "overdue") {
          return !!followUpDate && followUpDate < startOfToday;
        } else if (followupStatusFilter === "scheduled") {
          return !!followUpDate && followUpDate >= startOfToday;
        }
        return true;
      })();

      const matchesFollowupType = followupTypeFilter === "all" || lead.followUpType === followupTypeFilter;

      const matchesFollowupDateFrom = !followupDateFrom || (() => {
        const fromDate = parseLocalDateInput(followupDateFrom);
        if (!fromDate || !followUpDate) return false;
        fromDate.setHours(0, 0, 0, 0);
        const normalizedFollowUp = new Date(followUpDate);
        normalizedFollowUp.setHours(0, 0, 0, 0);
        return normalizedFollowUp >= fromDate;
      })();

      const matchesFollowupDateTo = !followupDateTo || (() => {
        const toDate = parseLocalDateInput(followupDateTo);
        if (!toDate || !followUpDate) return false;
        toDate.setHours(23, 59, 59, 999);
        return followUpDate <= toDate;
      })();

      const matchesOverdueOnly = !showOverdueOnly || (!!followUpDate && followUpDate < startOfToday);

      const matchesScheduledOnly = !showScheduledOnly || (!!followUpDate && followUpDate >= startOfToday);

      return matchesSearch && matchesStatus && matchesSource && matchesCourse && matchesCity && matchesCounselor && matchesToday && matchesEnquiryDate && matchesFollowupStatus && matchesFollowupType && matchesFollowupDateFrom && matchesFollowupDateTo && matchesOverdueOnly && matchesScheduledOnly;
    });

    return filtered;
  }, [leadsData, debouncedSearchTerm, selectedStatuses, selectedSource, selectedCourses, selectedCity, selectedCounselors, showTodayOnly, enquiryDateFilter, followupStatusFilter, followupTypeFilter, followupDateFrom, followupDateTo, showOverdueOnly, showScheduledOnly]);

  // Initialize data sync service
  useEffect(() => {
    if (userProfile?.centreId && userProfile?.uid) {
      dataSyncService.init(userProfile.centreId, userProfile.uid);
    }
  }, [userProfile]);

  // Listen for source updates from other components
  useEffect(() => {
    const unsubscribe = sourceManagerEvents.subscribe((event) => {
      // Refresh leads data when a new source is added
      if (event.detail.newSource) {
        // The leads data will automatically include the new source
        // since it's fetched from the database
      }
    });

    return unsubscribe;
  }, []);

  // Enhanced color functions with custom scheme support
  const getCustomStatusColor = (status: string) => {
    if (colorScheme[status]) {
      return "";
    }
    return getStatusColor(status);
  };

  const getCustomRowBackgroundColor = (status: string) => {
    if (colorScheme[status]) {
      return "";
    }
    return getRowBackgroundColor(status);
  };

  const getCustomStatusStyle = (status: string) => {
    if (colorScheme[status]) {
      return {
        backgroundColor: colorScheme[status].backgroundColor,
        color: colorScheme[status].textColor,
      };
    }
    return {};
  };

  const getCustomRowStyle = (status: string) => {
    if (colorScheme[status]) {
      return {
        backgroundColor: colorScheme[status].backgroundColor,
      };
    }
    return {};
  };



  // Function to get today's lead styling
  const getTodayLeadStyle = (lead: Lead) => {
    if (isTodayLead(lead)) {
      return {
        border: '1px solid #10b981',
        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
        position: 'relative' as const,
        backgroundColor: '#f0fdf4',
      };
    }
    return {};
  };

  // Function to get today's lead class
  const getTodayLeadClass = (lead: Lead) => {
    if (isTodayLead(lead)) {
      return "relative bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 transition-all duration-200";
    }
    return "";
  };

  const fetchLeads = useCallback(
    async (forceRefresh = false) => {
      const now = Date.now();
      if (!forceRefresh && dataLoaded && now - lastRefreshTime < 5000) {
        return;
      }
      if (document.hidden && !forceRefresh) {
        return;
      }
      await refreshLeadsStore();
    },
    [dataLoaded, lastRefreshTime, refreshLeadsStore]
  );

  // Fetch reminders and calendar events for analytics
  const fetchRemindersAndEvents = useCallback(async () => {
    if (!userProfile?.centreId) return;

    try {
      
      // Reminders: single global listener via GlobalReminderNotification / enhancedReminderService
      calendarSyncService.init(userProfile.centreId, userProfile.uid || '');

      const handleReminderDataUpdated = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail?.centreId && detail.centreId !== userProfile.centreId) return;
        const list = detail?.reminders ?? [];
        setReminders(list);
      };
      window.addEventListener('reminderDataUpdated', handleReminderDataUpdated);

      const calendarUnsubscribe = calendarSyncService.subscribe((event: any) => {
      });

      calendarSyncService.forceRefresh();

      // Set fallback data if services don't respond quickly
      setTimeout(() => {
        if (reminders.length === 0) {
          setReminders([]);
        }
        if (calendarEvents.length === 0) {
          setCalendarEvents([]);
        }
      }, 2000);

      return () => {
        window.removeEventListener('reminderDataUpdated', handleReminderDataUpdated);
        calendarUnsubscribe();
      };
    } catch (error) {
      console.error('❌ Error fetching reminders and calendar events:', error);
      // Set empty arrays as fallback
      setReminders([]);
      setCalendarEvents([]);
    }
  }, [userProfile?.centreId, userProfile?.uid, reminders.length, calendarEvents.length]);

  // Enhanced event listeners for comprehensive data synchronization
  useEffect(() => {
    // Setup reminders and calendar events for analytics
    const setupAnalyticsData = async () => {
      if (userProfile?.centreId) {
        await fetchRemindersAndEvents();
      }
    };
    
    setupAnalyticsData();
    
    const handleLeadDataUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Only log in development
      if (import.meta.env.DEV) {
      }
      
      // Add null check for detail
      if (!detail) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Lead data update event received with null detail');
        }
        return;
      }
      
      // Handle deletion events specifically
      if (detail.action === 'deleted' && detail.leadId) {
        // Don't refresh data for deletions as we handle them manually
        return;
      }
      
      // Update local state immediately if we have the data
      if (detail.leadId && detail.updates) {
        patchLead(String(detail.leadId), detail.updates);
      } else if (detail.action === 'create' && !isFormOpen) {
        // For create mode, refresh all leads since we don't have the new lead ID
        // But only if the form is not open to prevent unnecessary refreshes
        if (import.meta.env.DEV) {
        }
        // Only refresh if data is stale
        const now = Date.now();
        if (!dataLoaded || (now - lastRefreshTime) > 5000) {
          fetchLeads();
        }
      } else if (!isFormOpen) {
        // Fallback to full refresh, but only if form is not open and data is stale
        if (import.meta.env.DEV) {
        }
        const now = Date.now();
        if (!dataLoaded || (now - lastRefreshTime) > 5000) {
          fetchLeads();
        }
      }
      
      // Trigger comprehensive updates without causing page refresh
      if (!detail.preventRefresh) {
        window.dispatchEvent(new CustomEvent('analyticsDataUpdated', { 
          detail: { source: 'leads', timestamp: Date.now(), leadId: detail.leadId, preventRefresh: true } 
        }));
        window.dispatchEvent(new CustomEvent('calendarDataUpdated', { 
          detail: { source: 'leads', timestamp: Date.now(), leadId: detail.leadId, preventRefresh: true } 
        }));
        window.dispatchEvent(new CustomEvent('reminderDataUpdated', { 
          detail: { source: 'leads', timestamp: Date.now(), leadId: detail.leadId, preventRefresh: true } 
        }));
      }
    };

    const handleReminderUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Add null check for detail
      if (!detail) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Follow-up reminder update event received with null detail');
        }
        return;
      }
      
      // Handle deletion events
      if (detail.action === 'deleted') {
        // No need to update leads data for follow-up reminder deletions
        return;
      }
      
      // Update leads data to reflect follow-up reminder changes
      if (detail.leadId) {
        applyLeadsUpdater(prev =>
          prev.map(lead =>
            lead.id === detail.leadId ? { ...lead, updatedAt: new Date() } : lead
          )
        );
      }
      
      // Trigger comprehensive updates without causing page refresh
      if (!detail.preventRefresh) {
        window.dispatchEvent(new CustomEvent('analyticsDataUpdated', { 
          detail: { source: 'follow-up-reminders', timestamp: Date.now(), leadId: detail.leadId, preventRefresh: true } 
        }));
        window.dispatchEvent(new CustomEvent('calendarDataUpdated', { 
          detail: { source: 'follow-up-reminders', timestamp: Date.now(), leadId: detail.leadId, preventRefresh: true } 
        }));
      }
    };

    const handleCalendarUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Add null check for detail
      if (!detail) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Calendar update event received with null detail');
        }
        return;
      }
      
      // Handle deletion events
      if (detail.action === 'deleted' && detail.leadId) {
        // No need to update leads data for calendar deletions
        return;
      }
      
      // Update leads data to reflect calendar changes
      if (detail.leadId) {
        applyLeadsUpdater(prev =>
          prev.map(lead =>
            lead.id === detail.leadId ? { ...lead, updatedAt: new Date() } : lead
          )
        );
      }
      
      // Trigger comprehensive updates without causing page refresh
      if (!detail.preventRefresh) {
        window.dispatchEvent(new CustomEvent('analyticsDataUpdated', { 
          detail: { source: 'calendar', timestamp: Date.now(), leadId: detail.leadId, preventRefresh: true } 
        }));
      }
    };

    const handleStatusUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Add null check for detail
      if (!detail) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Status update event received with null detail');
        }
        return;
      }
      
      // Update leads data to reflect status changes (statusUpdated uses newStatus, leadDataUpdated uses updates.status)
      const statusValue = detail.newStatus ?? detail.status ?? detail.updates?.status;
      if (detail.leadId && statusValue) {
        applyLeadsUpdater(prev => 
          prev.map(lead => 
            lead.id === detail.leadId ? { ...lead, status: statusValue, updatedAt: new Date() } : lead
          )
        );
      }
      
      // Trigger comprehensive updates without causing page refresh
      if (!detail.preventRefresh) {
        window.dispatchEvent(new CustomEvent('analyticsDataUpdated', { 
          detail: { source: 'status', timestamp: Date.now(), leadId: detail.leadId, preventRefresh: true } 
        }));
      }
    };

    const handleAnalyticsUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Add null check for detail
      if (!detail) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Analytics update event received with null detail');
        }
        return;
      }
      
      // Refresh analytics data without causing page refresh
      if (!detail.preventRefresh) {
        // This could trigger a refetch of analytics data if needed
      }
    };

    // Listen for data sync service events - only if data is stale
    const unsubscribeLead = dataSyncService.subscribe('lead', (event) => {
      if (
        (event.action === 'updated' || event.action === 'created') &&
        event.leadId &&
        event.data?.lead &&
        !isFormOpen
      ) {
        patchLead(String(event.leadId), event.data.lead);
      }
    });

    const unsubscribeStatus = dataSyncService.subscribe('status', (event) => {
    });

    const unsubscribeCalendar = dataSyncService.subscribe('calendar', (event) => {
    });

    window.addEventListener('leadDataUpdated', handleLeadDataUpdate);
    window.addEventListener('reminderUpdated', handleReminderUpdate);
    window.addEventListener('calendarUpdated', handleCalendarUpdate);
    window.addEventListener('statusUpdated', handleStatusUpdate);
    window.addEventListener('analyticsDataUpdated', handleAnalyticsUpdate);

    return () => {
      window.removeEventListener('leadDataUpdated', handleLeadDataUpdate);
      window.removeEventListener('reminderUpdated', handleReminderUpdate);
      window.removeEventListener('calendarUpdated', handleCalendarUpdate);
      window.removeEventListener('statusUpdated', handleStatusUpdate);
      window.removeEventListener('analyticsDataUpdated', handleAnalyticsUpdate);
      unsubscribeLead();
      unsubscribeStatus();
      unsubscribeCalendar();
    };
  }, [fetchRemindersAndEvents, isFormOpen, patchLead]);

  // Refresh analytics data when analytics tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && userProfile?.centreId) {
      fetchRemindersAndEvents();
    }
  }, [activeTab, userProfile?.centreId, fetchRemindersAndEvents]);

  // Enhanced analytics calculation with comprehensive column-wise data synchronization
  const calculateStats = useMemo(() => {
    try {

    
    // Status-based analytics
    const statusStats = {
      total: leadsData.length,
      new: leadsData.filter((l) => l.status === "New" || l.status === "Other").length,
      cold: leadsData.filter((l) => l.status === "Cold Lead").length,
      warm: leadsData.filter((l) => l.status === "Warm Lead").length,
      hot: leadsData.filter((l) => l.status === "Hot Lead").length,
      notInterested: leadsData.filter((l) => l.status === "Not Interested").length,
      fake: leadsData.filter((l) => l.status === "Fake").length,
      dropped: leadsData.filter((l) => l.status === "Dropped").length,
      done: leadsData.filter((l) => l.status === "Done").length,
      converted: leadsData.filter((l) => l.status === "Admission Done").length,
      contacted: leadsData.filter((l) => l.status === "Contacted").length,
      interested: leadsData.filter((l) => l.status === "Interested").length,
      visitScheduled: leadsData.filter((l) => l.status === "Visit Scheduled").length,
      visitCompleted: leadsData.filter((l) => l.status === "Visit Completed").length,
      callMade: leadsData.filter((l) => l.status === "Call Made").length,
      callNotReceived: leadsData.filter((l) => l.status === "Call Not Received").length,
      followUpScheduled: leadsData.filter((l) => l.status === "Follow-up Scheduled").length,
      followUpCompleted: leadsData.filter((l) => l.status === "Follow-up Completed").length,
      admissionDone: leadsData.filter((l) => l.status === "Admission Done").length,
      lost: leadsData.filter((l) => l.status === "Lost").length,
    };

    // Source-based analytics with comprehensive categorization
    const knownSources = [
      "Instagram", "Instagram Ad", "Facebook", "Facebook Ad", "Just Dial", "MIS", 
      "Hoarding", "Pamphlet", "Radio Ad", "Website", "Walk-in", "Direct Walk-in", 
      "Referral", "Social Media", "Email Campaign", "Phone Call"
    ];
    
    const sourceStats = {
      instagram: leadsData.filter((l) => l.source === "Instagram" || l.source === "Instagram Ad").length,
      facebook: leadsData.filter((l) => l.source === "Facebook" || l.source === "Facebook Ad").length,
      justDial: leadsData.filter((l) => l.source === "Just Dial").length,
      mis: leadsData.filter((l) => l.source === "MIS").length,
      hoarding: leadsData.filter((l) => l.source === "Hoarding").length,
      pamphlet: leadsData.filter((l) => l.source === "Pamphlet").length,
      radioAd: leadsData.filter((l) => l.source === "Radio Ad").length,
      website: leadsData.filter((l) => l.source === "Website").length,
      walkIn: leadsData.filter((l) => l.source === "Walk-in" || l.source === "Direct Walk-in").length,
      referral: leadsData.filter((l) => l.source === "Referral").length,
      socialMedia: leadsData.filter((l) => l.source === "Social Media").length,
      emailCampaign: leadsData.filter((l) => l.source === "Email Campaign").length,
      phoneCall: leadsData.filter((l) => l.source === "Phone Call").length,
      other: leadsData.filter((l) => !l.source || !knownSources.includes(l.source)).length,
    };
    


    // Course-based analytics
    const courseStats = {
      total: leadsData.length,
      byCourse: leadsData.reduce((acc, lead) => {
        const course = lead.course || "Unknown";
        acc[course] = (acc[course] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // City/Area-based analytics
    const cityStats = {
      total: leadsData.length,
      byCity: leadsData.reduce((acc, lead) => {
        const city = lead.cityArea || "Unknown";
        acc[city] = (acc[city] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Counselor-based analytics
    const counselorStats = {
      total: leadsData.length,
      byCounselor: leadsData.reduce((acc, lead) => {
        const counselor = lead.counselorName || "Unassigned";
        acc[counselor] = (acc[counselor] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Date-based analytics
    const dateStats = {
      total: leadsData.length,
      byMonth: leadsData.reduce((acc, lead) => {
        const date = parseDate(lead.enquiryDate);
        if (!date) {
          return acc;
        }
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthYear] = (acc[monthYear] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byWeek: leadsData.reduce((acc, lead) => {
        const date = parseDate(lead.enquiryDate);
        if (!date) {
          return acc;
        }
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        acc[weekKey] = (acc[weekKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Conversion analytics
    const conversionStats = {
      totalLeads: leadsData.length,
      convertedLeads: leadsData.filter((l) => l.status === "Admission Done").length,
      conversionRate: leadsData.length > 0 ? 
        (leadsData.filter((l) => l.status === "Admission Done").length / leadsData.length * 100).toFixed(2) : "0",
      avgTimeToConvert: 0, // TODO: Calculate average time to conversion
    };

    const stats: LeadStats & {
      statusStats: typeof statusStats;
      sourceStats: typeof sourceStats;
      courseStats: typeof courseStats;
      cityStats: typeof cityStats;
      counselorStats: typeof counselorStats;
      dateStats: typeof dateStats;
      conversionStats: typeof conversionStats;
    } = {
      ...statusStats,
      ...sourceStats,
      statusStats,
      sourceStats,
      courseStats,
      cityStats,
      counselorStats,
      dateStats,
      conversionStats,
    };

    // Dispatch analytics update event
    window.dispatchEvent(new CustomEvent('analyticsRecalculated', {
      detail: {
        stats,
        timestamp: Date.now(),
        leadCount: leadsData.length
      }
    }));


    return stats;
  } catch (error) {
    console.error('❌ Error calculating enhanced analytics:', error);
    // Return fallback stats
    return {
      total: 0,
      new: 0,
      cold: 0,
      warm: 0,
      hot: 0,
      notInterested: 0,
      fake: 0,
      dropped: 0,
      done: 0,
      converted: 0,
      contacted: 0,
      interested: 0,
      visitScheduled: 0,
      visitCompleted: 0,
      callMade: 0,
      callNotReceived: 0,
      followUpScheduled: 0,
      followUpCompleted: 0,
      admissionDone: 0,
      lost: 0,
      instagram: 0,
      facebook: 0,
      justDial: 0,
      mis: 0,
      hoarding: 0,
      pamphlet: 0,
      radioAd: 0,
      website: 0,
      walkIn: 0,
      referral: 0,
      socialMedia: 0,
      emailCampaign: 0,
      phoneCall: 0,
      other: 0,
      statusStats: {},
      sourceStats: {},
      courseStats: {},
      cityStats: {},
      counselorStats: {},
      dateStats: {},
      conversionStats: {}
    };
  }
}, [leadsData]);

  const handleUpdateLead = async (leadId: string, updates: Partial<any>) => {
    try {
      const existingLead = leadsData.find((l) => l.id === leadId);

      if (isNestLeadsEnabled() && isNestBackedLead(existingLead)) {
        const nestPayload = buildNestUpdatePayload({
          name: updates.leadName,
          phone: updates.contact,
          email: updates.emailId,
          source: updates.source,
          notes: updates.remark ?? updates.notes,
          nextFollowUpDate: updates.nextFollowUpDate ?? updates.followUpDate,
          version:
            typeof (existingLead as { version?: unknown } | undefined)?.version === 'number'
              ? ((existingLead as { version: number }).version)
              : undefined,
        });

        let updated = await nestLeadsApi.update(leadId, nestPayload);

        if (updates.status && updates.status !== existingLead?.status) {
          if (updates.status === 'Admission Done') {
            await nestLeadsApi.convert(leadId, {});
            updated = await nestLeadsApi.get(leadId);
          } else {
            const nestStatus = mapUiStatusToNest(String(updates.status));
            if (nestStatus !== 'converted') {
              updated = await nestLeadsApi.changeStatus(leadId, {
                status: nestStatus,
                lostReason:
                  nestStatus === 'lost'
                    ? String(updates.remark || updates.notes || 'Marked not interested')
                    : undefined,
              });
            }
          }
        }

        const ui = mapNestLeadToUi(updated as Parameters<typeof mapNestLeadToUi>[0]);
        applyLeadsUpdater((prev) =>
          prev.map((lead) => (lead.id === leadId ? { ...lead, ...ui, ...updates } : lead)),
        );
      } else {
        const leadRef = getLeadDocRef(db, leadId, existingLead as unknown as LeadRecord);
        const isEnquiry = existingLead
          ? isWebsiteEnquiryLead(existingLead as unknown as LeadRecord)
          : leadId.startsWith('enquiry_');

        const updatePayload = isEnquiry
          ? mapLeadFieldsToEnquiryUpdate(updates)
          : { ...updates, updatedAt: Timestamp.now() };

        await updateDoc(leadRef, updatePayload);

        applyLeadsUpdater(prev =>
          prev.map(lead =>
            lead.id === leadId ? { ...lead, ...updates } : lead
          )
        );
      }

      // Dispatch comprehensive update events with preventRefresh flag
      window.dispatchEvent(new CustomEvent('leadDataUpdated', {
        detail: {
          leadId,
          updates,
          timestamp: Date.now(),
          source: 'leads',
          preventRefresh: true
        }
      }));

      // Trigger specific updates based on what was changed
      if (updates.status) {
        window.dispatchEvent(new CustomEvent('statusUpdated', {
          detail: {
            leadId,
            newStatus: updates.status,
            timestamp: Date.now(),
            source: 'leads',
            preventRefresh: true
          }
        }));
      }

      if (updates.followUpDate || updates.reminderDate || updates.callDate || updates.visitDate || updates.admissionDate) {
        window.dispatchEvent(new CustomEvent('calendarUpdated', {
          detail: {
            leadId,
            updates,
            timestamp: Date.now(),
            source: 'leads',
            preventRefresh: true
          }
        }));
      }

      if (updates.followUpDate || updates.reminderDate || updates.callDate || updates.visitDate || updates.admissionDate) {
        window.dispatchEvent(new CustomEvent('reminderUpdated', {
          detail: {
            leadId,
            followUpDate: updates.followUpDate,
            reminderDate: updates.reminderDate,
            callDate: updates.callDate,
            visitDate: updates.visitDate,
            admissionDate: updates.admissionDate,
            timestamp: Date.now(),
            source: 'leads',
            preventRefresh: true
          }
        }));
      }

      if (updates.visitDate || updates.callDate || updates.admissionDate) {
        window.dispatchEvent(new CustomEvent('calendarUpdated', {
          detail: {
            leadId,
            visitDate: updates.visitDate,
            callDate: updates.callDate,
            admissionDate: updates.admissionDate,
            timestamp: Date.now(),
            source: 'leads',
            preventRefresh: true
          }
        }));
      }

      // Always trigger analytics update with preventRefresh flag
      window.dispatchEvent(new CustomEvent('analyticsDataUpdated', {
        detail: {
          source: 'lead_update',
          timestamp: Date.now(),
          leadId,
          updates,
          preventRefresh: true
        }
      }));

      toast({
        title: "Lead Updated",
        description: "Lead information updated successfully",
        variant: "default",
      });
    } catch (error) {
      console.error('❌ Error updating lead:', error);
      toast({
        title: "Error",
        description: "Failed to update lead information",
        variant: "destructive",
      });
    }
  };

  const handleStatusUpdate = async (leadId: string, newStatus: string) => {
    try {
      const existingLead = leadsData.find((l) => l.id === leadId);

      if (isNestLeadsEnabled() && isNestBackedLead(existingLead)) {
        if (newStatus === 'Admission Done') {
          await nestLeadsApi.convert(leadId, {});
        } else {
          const nestStatus = mapUiStatusToNest(newStatus);
          if (nestStatus === 'converted') {
            await nestLeadsApi.convert(leadId, {});
          } else {
            await nestLeadsApi.changeStatus(leadId, {
              status: nestStatus,
              lostReason:
                nestStatus === 'lost' ? 'Marked not interested from leads page' : undefined,
            });
          }
        }

        applyLeadsUpdater((prev) =>
          prev.map((lead) =>
            lead.id === leadId ? { ...lead, status: newStatus } : lead,
          ),
        );
      } else {
        const leadRef = getLeadDocRef(db, leadId, existingLead as unknown as LeadRecord);

        const docSnap = await getDoc(leadRef);
        if (!docSnap.exists()) {
          throw new Error(`Lead document with ID ${leadId} does not exist`);
        }

        const isEnquiry = existingLead
          ? isWebsiteEnquiryLead(existingLead as unknown as LeadRecord)
          : leadId.startsWith('enquiry_');

        await updateDoc(
          leadRef,
          isEnquiry
            ? { status: newStatus }
            : { status: newStatus, updatedAt: Timestamp.now() }
        );

        applyLeadsUpdater(prev =>
          prev.map(lead =>
            lead.id === leadId ? { ...lead, status: newStatus } : lead
          )
        );
      }

      // Dispatch comprehensive update events with preventRefresh flag
      window.dispatchEvent(new CustomEvent('statusUpdated', {
        detail: {
          leadId,
          newStatus,
          timestamp: Date.now(),
          source: 'leads',
          preventRefresh: true
        }
      }));

      window.dispatchEvent(new CustomEvent('analyticsDataUpdated', {
        detail: {
          source: 'status',
          timestamp: Date.now(),
          leadId,
          newStatus,
          preventRefresh: true
        }
      }));

      window.dispatchEvent(new CustomEvent('notificationDataUpdated', {
        detail: {
          source: 'status',
          timestamp: Date.now(),
          leadId,
          newStatus,
          preventRefresh: true
        }
      }));

      window.dispatchEvent(new CustomEvent('calendarDataUpdated', {
        detail: {
          source: 'status',
          timestamp: Date.now(),
          leadId,
          newStatus,
          preventRefresh: true
        }
      }));

      toast({
        title: "✅ Status Updated",
        description: `Lead status successfully updated to ${newStatus}`,
        variant: "default",
      });

      // Check for admission conversion
      if (newStatus === "Admission Done") {
        const lead = leadsData.find(l => l.id === leadId);
        if (lead) {
          if (isNestLeadsEnabled() && isNestBackedLead(lead)) {
            toast({
              title: "Student Created",
              description: "Lead converted via Nest API. Open Students to view the roll number.",
            });
          } else {
            toast({
              title: "Redirecting to Students",
              description: "Opening student form with lead details...",
            });

            setTimeout(() => {
              navigate('/students', {
                state: {
                  prefillData: {
                    firstName: lead.leadName || '',
                    phone: lead.contact || '',
                    email: lead.emailId || '',
                    course: lead.course || '',
                    source: lead.source || '',
                    city: lead.cityArea || '',
                    counselor: lead.counselorName || '',
                    admissionDate: new Date(),
                    status: 'active'
                  }
                }
              });
            }, 1000);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error updating status:', error);
      toast({
        title: "❌ Error",
        description: "Failed to update lead status. Please try again.",
        variant: "destructive",
      });
    }
  };



  const handleLeadDelete = async (leadId: string) => {
    if (isDeleting) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const existingLead = leadsData.find((l) => l.id === leadId);

      if (isNestLeadsEnabled() && isNestBackedLead(existingLead)) {
        toast({
          title: "Delete not available",
          description: "Nest leads cannot be deleted yet. Mark as Not Interested instead.",
          variant: "destructive",
        });
        return;
      }

      const leadRef = getLeadDocRef(db, leadId, existingLead as unknown as LeadRecord);
      
      const leadDoc = await getDoc(leadRef);
      if (!leadDoc.exists()) {
        console.warn('⚠️ Lead not found for deletion:', leadId);
        toast({
          title: "Warning",
          description: "Lead not found or already deleted.",
          variant: "destructive",
        });
        return;
      }
      
      
      // Update local state immediately to prevent UI flicker
      applyLeadsUpdater(prev => {
        const filtered = prev.filter(lead => lead.id !== leadId);
        return filtered;
      });

              // Delete related follow-up reminders first using reminder service
        try {
          await reminderService.deleteRemindersForLead(leadId);
        } catch (error) {
          console.error('❌ Error deleting follow-up reminders:', error);
          // Continue with lead deletion even if reminders fail
        }
      
      // Delete the lead
      await deleteDoc(leadRef);
      
      // Dispatch comprehensive delete events with preventRefresh flag
      const deleteEventDetail = {
        leadId,
        action: 'deleted',
        timestamp: Date.now(),
        source: 'leads',
        preventRefresh: true
      };


      // Dispatch events with a small delay to ensure Firebase has processed the deletion
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('leadDataUpdated', {
          detail: deleteEventDetail
        }));

        window.dispatchEvent(new CustomEvent('reminderUpdated', {
          detail: deleteEventDetail
        }));

        window.dispatchEvent(new CustomEvent('calendarUpdated', {
          detail: deleteEventDetail
        }));

        window.dispatchEvent(new CustomEvent('analyticsDataUpdated', {
          detail: {
            source: 'lead_delete',
            timestamp: Date.now(),
            leadId,
            preventRefresh: true
          }
        }));

        window.dispatchEvent(new CustomEvent('notificationDataUpdated', {
          detail: {
            source: 'lead_delete',
            timestamp: Date.now(),
            leadId,
            preventRefresh: true
          }
        }));
      }, 200);

      
      // Force refresh after a short delay to ensure UI is updated
      setTimeout(() => {
        fetchLeads(true);
      }, 300);
      
      toast({
        title: "Lead Deleted",
        description: "Lead and related follow-up reminders have been deleted successfully.",
        variant: "default",
      });

    } catch (error) {
      console.error('❌ Error deleting lead:', error);
      
      // Show more specific error message
      let errorMessage = "Failed to delete lead. Please try again.";
      if (error instanceof Error) {
        console.error("❌ Error details:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        if (error.message.includes('permission')) {
          errorMessage = "You don't have permission to delete this lead.";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('not-found')) {
          errorMessage = "Lead not found or already deleted.";
        }
      }
      
      // Revert local state if deletion failed - force refresh
      fetchLeads(true);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (isDeletingAll || leadsData.length === 0) {
      return;
    }

    if (isNestLeadsEnabled()) {
      toast({
        title: "Delete not available",
        description: "Bulk delete is not supported for Nest-backed leads yet.",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingAll(true);

    try {

      // Get all lead IDs
      const allLeadIds = leadsData.map(lead => lead.id);
      const totalLeads = allLeadIds.length;

      // Delete reminders for all leads first
      const reminderDeletePromises = allLeadIds.map(leadId => 
        reminderService.deleteRemindersForLead(leadId).catch(error => {
          console.error(`❌ Error deleting reminders for lead ${leadId}:`, error);
          // Continue even if reminder deletion fails
        })
      );
      await Promise.allSettled(reminderDeletePromises);

      // Delete all leads using batch operations (Firestore batch limit is 500)
      const BATCH_SIZE = 500;
      let deletedCount = 0;

      for (let i = 0; i < allLeadIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchIds = allLeadIds.slice(i, i + BATCH_SIZE);

        batchIds.forEach(leadId => {
          const existingLead = leadsData.find((l) => l.id === leadId);
          const leadRef = getLeadDocRef(db, leadId, existingLead as LeadRecord);
          batch.delete(leadRef);
        });

        try {
          await batch.commit();
          deletedCount += batchIds.length;
        } catch (batchError) {
          console.error(`❌ Error committing batch ${i / BATCH_SIZE + 1}:`, batchError);
          // Continue with next batch even if one fails
          throw batchError; // Re-throw to be caught by outer catch
        }
      }

      // Clear local state
      applyLeadsUpdater([]);
      setSelectedLeads(new Set());
      setSelectAll(false);

      // Trigger data sync service
      if (dataSyncService) {
        dataSyncService.handleDataSync({
          type: 'lead',
          action: 'bulk_deleted',
          data: { count: deletedCount },
          timestamp: Date.now(),
          source: 'manual_bulk_deletion'
        });
      }

      // Dispatch events to notify other components
      window.dispatchEvent(new CustomEvent('leadDataUpdated', {
        detail: {
          action: 'bulk_deleted',
          count: deletedCount,
          timestamp: Date.now(),
          source: 'leads',
          preventRefresh: true
        }
      }));

      // Force refresh to ensure UI is updated
      setTimeout(() => {
        fetchLeads(true);
      }, 500);

      toast({
        title: "Success",
        description: `Successfully deleted ${deletedCount} leads and their related reminders.`,
        variant: "default",
      });

      setShowDeleteAllDialog(false);
    } catch (error) {
      console.error('❌ Error deleting all leads:', error);
      
      let errorMessage = "Failed to delete all leads. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage = "You don't have permission to delete leads.";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleLeadEdit = (lead: any) => {
    setSelectedLead(lead);
    setFormMode("edit");
    setIsFormOpen(true);
    setShowViewDialog(false);
  };

  const handleLeadClick = (lead: any) => {
    setSelectedLead(lead);
    setShowViewDialog(true);
  };

  const handleLeadView = (lead: any) => {
    setSelectedLead(lead);
    setShowViewDialog(true);
  };

  /** Normalize contact for WhatsApp: digits only, India +91 if 10 digits */
  const normalizePhoneForWhatsApp = (contact: string): string => {
    const digits = (contact || "").replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
    return digits;
  };

  const handleWhatsAppClick = (lead: Lead) => {
    const contact = (lead.contact || "").trim();
    if (!contact) {
      toast({ title: "No contact number", description: "This lead has no phone number.", variant: "destructive" });
      return;
    }
    const phone = normalizePhoneForWhatsApp(contact);
    if (phone.length < 10) {
      toast({ title: "Invalid number", description: "Please add a valid phone number for this lead.", variant: "destructive" });
      return;
    }
    const name = lead.leadName || "Student";
    // Use bullet (•) so message displays correctly in WhatsApp on all devices
    const bullet = "\u2022";
    const message = `Dear ${name},

Greetings from Zee Institute Creative Art and Media Arts, PCMC.

Thank you for reaching out to ZICA and ZIMA, Pimpri Chinchwad, Pune. We appreciate your interest.

We offer professional courses in the following areas.
Animation
VFX
Graphic Design
Filmmaking
Video Editing
UI/UX
And more creative programs

Contact details
${bullet} Office numbers: 9028757041, 9028757042

Online presence
${bullet} Website: https://zicazimapcmc.com

${bullet} Instagram: https://www.instagram.com/zicazima_pcmc

${bullet} Facebook: https://www.facebook.com/share/15ARsoiTa3

${bullet} Address
${ZICA_CENTRE_ADDRESS}
${bullet} Location map: https://maps.app.goo.gl/FhAACecN2tiUJQn17

Our team will connect with you shortly.

Warm regards,
ZICA and ZIMA, PCMC, Pune`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleDateClick = (date: Date) => {
  };

  const handleAddLead = () => {
    setSelectedLead(null);
    setFormMode("create");
    setIsFormOpen(true);
  };

  // Handle lead selection
  const handleLeadSelect = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedLeads(new Set());
      setSelectAll(false);
    } else {
      setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)));
      setSelectAll(true);
    }
  };

  // Update selectAll state when individual selections change
  useEffect(() => {
    if (selectedLeads.size === 0) {
      setSelectAll(false);
    } else if (selectedLeads.size === filteredLeads.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedLeads.size, filteredLeads.length]);

  // Download selected leads
  const downloadSelectedLeads = () => {
    if (selectedLeads.size === 0) {
      toast({
        title: "No Leads Selected",
        description: "Please select leads to download.",
        variant: "destructive",
      });
      return;
    }

    const selectedLeadsData = filteredLeads.filter(lead => selectedLeads.has(lead.id));
    
    try {
      const exportData = selectedLeadsData.map(lead => ({
        'Enquiry Date': formatDate(lead.enquiryDate),
        'Lead Name': lead.leadName || '',
        'Contact': lead.contact || '',
        'Email ID': lead.emailId || '',
        'Course': lead.course || '',
        'Course Duration': lead.courseDuration || '',
        'Education': lead.education || '',
        'Source': lead.source || '',
        'City/Area': lead.cityArea || '',
        'Follow up Date': formatDate(lead.followUpDate),
        'Status': (lead.status === "Converted (Admission Done)" ? "Admission Done" : lead.status) || '',
        'Counselor Name': (lead.counselorName === "Gaurav" ? "NC" : lead.counselorName) || '',
        'Feedback Call Remarks': [lead.feedbackCallRemarks, lead.remark].filter(Boolean).join(", ") || '',
        'Final Remark': lead.finalRemark || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Selected Leads');
      
      const fileName = `selected-leads-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Download Successful",
        description: `${selectedLeads.size} leads have been downloaded.`,
        variant: "default",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export selected leads.",
        variant: "destructive",
      });
    }
  };

  // Force refresh data when component mounts or when data might be stale
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isFormOpen) {
        if (import.meta.env.DEV) {
        }
        // Only refresh if data is stale (older than 5 minutes)
        const now = Date.now();
        if (!dataLoaded || now - lastRefreshTime > 300000) {
          void fetchLeads(true);
        }
      }
    };

    const handleFocus = () => {
      if (!isFormOpen) {
        if (import.meta.env.DEV) {
        }
        const now = Date.now();
        if (!dataLoaded || now - lastRefreshTime > 300000) {
          void fetchLeads(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchLeads, isFormOpen, dataLoaded, lastRefreshTime]);

  // Status filter: 8 options + Other (same as Lead popup)
  const statuses = useMemo(
    () => ["Admission Done", "Cold Lead", "Hot Lead", "Not Interested", "Visited", "Placement", "Not Contacted", "Job Seeker", "Other"],
    []
  );
  const [sources, setSources] = useState<string[]>([]);

  // Sources filter: only options like Lead popup (getAllSources when centre; else defaultSources only)
  useEffect(() => {
    const loadSources = async () => {
      if (userProfile?.centreId) {
        const allSources = await getAllSources(userProfile.centreId);
        setSources(allSources);
      } else {
        setSources([...defaultSources]);
      }
    };
    loadSources();
  }, [userProfile?.centreId]);
  
  // Listen for source updates
  useEffect(() => {
    const unsubscribe = sourceManagerEvents.subscribe(async (event) => {
      if (event.detail.newSource && userProfile?.centreId) {
        const allSources = await getAllSources(userProfile.centreId);
        setSources(allSources);
      }
    });
    
    return unsubscribe;
  }, [userProfile?.centreId]);
  // Course filter: only options from Lead popup (standardized + modular; no custom/from leads)
  const courses = useMemo(
    () => Array.from(new Set([...ALL_STANDARDIZED_COURSES, ...MODULAR_PROGRAMS])).sort(),
    []
  );

  // City/Area filter: PCMC + Maharashtra districts + custom areas from lead form
  const [cityAreaOptionsVersion, setCityAreaOptionsVersion] = useState(0);
  useEffect(() => {
    const onCityAreaUpdated = () => setCityAreaOptionsVersion((v) => v + 1);
    window.addEventListener("cityAreaUpdated", onCityAreaUpdated);
    return () => window.removeEventListener("cityAreaUpdated", onCityAreaUpdated);
  }, []);
  const cities = useMemo(() => getCityAreaOptions(), [cityAreaOptionsVersion]);

  // Counselors filter: options from Lead popup (Tayyaba, Snehal, Both, NC)
  const counselors = useMemo(() => ["Tayyaba", "Snehal", "Both", "NC"], []);

  const { sortedData: sortedFilteredLeads, requestSort, sortConfig } = useTableSort(
    filteredLeads,
    DEFAULT_DATE_SORT
  );

  const numberedLeads = useMemo(
    () => assignContiguousSerialsToOrderedList(sortedFilteredLeads),
    [sortedFilteredLeads]
  );

  const totalPages = Math.max(1, Math.ceil(numberedLeads.length / leadsPerPage) || 1);
  const startIndex = (currentPage - 1) * leadsPerPage;
  const endIndex = startIndex + leadsPerPage;
  const currentLeads = numberedLeads.slice(startIndex, endIndex);

  // Reset/clamp page when filters or result count change (avoids empty table on high page)
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchTerm,
    selectedStatuses,
    selectedSource,
    selectedCourses,
    selectedCity,
    selectedCounselors,
    showTodayOnly,
    enquiryDateFilter,
    followupStatusFilter,
    followupTypeFilter,
    followupDateFrom,
    followupDateTo,
    showOverdueOnly,
    showScheduledOnly,
  ]);

  useEffect(() => {
    setCurrentPage((page) => (page > totalPages ? totalPages : page));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [leadsPerPage]);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const importCentreId = userProfile?.centreId?.trim();
    if (!importCentreId) {
      toast({
        title: 'Cannot import',
        description: 'Your account has no centre assigned. Leads must be linked to your centre.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const existingLeadsSnapshot = await getDocs(collection(db, "leads"));
        let importSrNo = getNextSerialNumberFromItems(
          existingLeadsSnapshot.docs.map((d) => ({ ...d.data(), id: d.id }))
        );

        // Enhanced field mapping with multiple possible column names
        const getFieldValue = (rowData: Record<string, any>, possibleNames: string[], defaultValue: string = "") => {
          for (const name of possibleNames) {
            // Iterate through actual rowData keys and trim them for comparison
            for (const key in rowData) {
              if (key.trim() === name.trim()) { // Trim both the possible name and the actual key
                const value = rowData[key];
                if (value !== undefined && value !== null && value !== "") {
                  return String(value).trim();
                }
              }
            }
          }
          return defaultValue;
        };

        // Process and add leads
        for (const row of jsonData) {
          const rowData = row as Record<string, any>;
          
          // Parse the original date from Excel sheet
          let enquiryDate = null;
          if (rowData["Enquiry Date"] || rowData["EnquiryDate"] || rowData["Date"]) {
            const dateValue = rowData["Enquiry Date"] || rowData["EnquiryDate"] || rowData["Date"];
            
            if (dateValue) {
              // Handle Excel date serial number
              if (typeof dateValue === 'number') {
                enquiryDate = new Date((dateValue - 25569) * 86400 * 1000);
              } else if (typeof dateValue === 'string') {
                // Handle different string date formats
                if (dateValue.includes('/')) {
                  // Handle "5/8/2025" format
                  const parts = dateValue.split('/');
                  if (parts.length === 3) {
                    enquiryDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                  } else {
                    enquiryDate = new Date(dateValue);
                  }
                } else if (dateValue.includes('-')) {
                  // Handle "2025-08-05" format
                  enquiryDate = new Date(dateValue);
                } else {
                  // Try direct parsing
                  enquiryDate = new Date(dateValue);
                }
              } else {
                enquiryDate = new Date(dateValue);
              }
              
              // Validate the date
              if (isNaN(enquiryDate.getTime())) {
                enquiryDate = new Date(); // Use current date as fallback
              }
            }
          }
          
          // Parse Follow up Date from Excel sheet
          let followUpDate = null;
          if (rowData["Follow up Date"] || rowData["Follow Up Date"] || rowData["FollowUp Date"] || rowData["Followup Date"]) {
            const dateValue = rowData["Follow up Date"] || rowData["Follow Up Date"] || rowData["FollowUp Date"] || rowData["Followup Date"];
            
            if (dateValue) {
              // Handle Excel date serial number
              if (typeof dateValue === 'number') {
                followUpDate = new Date((dateValue - 25569) * 86400 * 1000);
              } else if (typeof dateValue === 'string') {
                // Handle different string date formats
                if (dateValue.includes('/')) {
                  // Handle "10/8/2025" format
                  const parts = dateValue.split('/');
                  if (parts.length === 3) {
                    followUpDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                  } else {
                    followUpDate = new Date(dateValue);
                  }
                } else if (dateValue.includes('-')) {
                  // Handle "2025-08-10" format
                  followUpDate = new Date(dateValue);
                } else {
                  // Try direct parsing
                  followUpDate = new Date(dateValue);
                }
              } else {
                followUpDate = new Date(dateValue);
              }
              
              // Validate the date
              if (isNaN(followUpDate.getTime())) {
                followUpDate = null;
              }
            }
          }
          
          // Log the first row to see available columns
          if (jsonData.indexOf(row) === 0) {
          }

          // Debug course field mapping
          const courseValue = getFieldValue(rowData, ["Course", "Course Name", "Interested Course", "Course Interest", "Program", "Program Name"], "");
          
          // If course is still empty, try to find any column that might contain course info
          let finalCourseValue = courseValue;
          if (!courseValue && jsonData.indexOf(row) === 0) {
            const allColumns = Object.keys(rowData);
            for (const column of allColumns) {
              const value = rowData[column];
              if (value && typeof value === 'string' && value.toLowerCase().includes('course')) {
                finalCourseValue = value;
                break;
              }
            }
          }
          
          if (jsonData.indexOf(row) === 0) {
            
            // If still no course found, show all available columns
            if (!finalCourseValue) {
              Object.keys(rowData).forEach((column, index) => {
              });
            }
          }

          const leadData = {
            srNo: importSrNo++,
            enquiryDate: enquiryDate || new Date(), // Use original date or current date as fallback
            leadName: getFieldValue(rowData, ["Name", "Lead Name", "LeadName", "Student Name", "StudentName"], ""),
            contact: getFieldValue(rowData, ["Mobile Number", "Contact", "Phone", "Phone Number", "Mobile", "Contact Number"], ""),
            emailId: getFieldValue(rowData, ["Email", "Email ID", "EmailId", "Email Address"], ""),
            course: finalCourseValue,
            courseDuration: getFieldValue(rowData, ["Course Duration", "Duration", "Course Length", "Program Duration"], ""),
            education: getFieldValue(rowData, ["Qualification", "Education", "Educational Background", "Academic Background"], ""),
            source: getFieldValue(rowData, ["Source", "Lead Source", "Source of Lead", "How did you hear about us"], ""),
            cityArea: getFieldValue(rowData, ["City/Area", "City", "Area", "Location", "City Area"], ""),
            followUpDate: followUpDate, // Use parsed follow up date
            status: getFieldValue(rowData, ["Status", "Lead Status", "Current Status"], "Other"),
            counselorName: getFieldValue(rowData, ["Counselor Name", "Counselor", "Assigned To", "Assigned Counselor"], ""),
            remark: getFieldValue(rowData, ["Remark", "Remarks", "Notes", "Comments"], ""),
            feedbackCallRemarks: getFieldValue(rowData, ["Feedback Call Remarks", "Feedback Remarks", "Call Feedback", "Call Notes"], ""),
            centreHeadRemarks: getFieldValue(rowData, ["Centre Head Remarks", "Centre Head Comments", "Director Remarks", "Manager Remarks"], ""),
            finalRemark: getFieldValue(rowData, ["Final Remark", "Final Remarks", "Final Notes", "Closing Remark"], ""),
            createdAt: enquiryDate || new Date(),
            updatedAt: new Date(),
            centreId: importCentreId,
          };

          // Log the mapped data for debugging

          // Validate required fields
          const validationIssues = [];
          if (!leadData.leadName) validationIssues.push('Lead Name');
          if (!leadData.contact) validationIssues.push('Contact');
          if (!leadData.course) validationIssues.push('Course');
          if (!leadData.counselorName) validationIssues.push('Counselor Name');

          if (validationIssues.length > 0) {
            console.warn(`Row ${jsonData.indexOf(row) + 1} missing required fields:`, validationIssues);
            console.warn('Available columns in Excel:', Object.keys(rowData));
          }

          await addDoc(collection(db, "leads"), leadData);
        }

        // Count successful imports
        let successCount = 0;
        let missingCourseCount = 0;
        let missingContactCount = 0;
        let missingNameCount = 0;

        for (const row of jsonData) {
          const rowData = row as Record<string, any>;
          const course = getFieldValue(rowData, ["Course", "Course Name", "Interested Course", "Course Interest", "Program", "Program Name"], "");
          const contact = getFieldValue(rowData, ["Mobile Number", "Contact", "Phone", "Phone Number", "Mobile", "Contact Number"], "");
          const name = getFieldValue(rowData, ["Name", "Lead Name", "LeadName", "Student Name", "StudentName"], "");
          
          if (course) successCount++;
          else missingCourseCount++;
          
          if (!contact) missingContactCount++;
          if (!name) missingNameCount++;
        }

        const summary = [];
        if (successCount > 0) summary.push(`${successCount} with course data`);
        if (missingCourseCount > 0) summary.push(`${missingCourseCount} missing course`);
        if (missingContactCount > 0) summary.push(`${missingContactCount} missing contact`);
        if (missingNameCount > 0) summary.push(`${missingNameCount} missing name`);

        toast({
          title: "Import Completed",
          description: `${jsonData.length} leads processed. ${summary.join(', ')}`,
        });
      } catch (error) {
        console.error('Import error:', error);
        toast({
          title: "Import Failed",
          description: "Failed to import leads data",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Optimized tab change handler
  const handleTabChange = useCallback((value: string) => {
    if (import.meta.env.DEV) {
    }
    
    // If it's the same tab, don't do anything
    if (value === activeTab) {
      return;
    }
    
    // Handle reminders tab specially
    if (value === "reminders") {
      setShowRemindersSection(true);
    }
    
    // Set pending tab change for debouncing
    setPendingTabChange(value);
  }, [activeTab]);

  // Debounced tab switching to prevent rapid tab changes
  useEffect(() => {
    if (pendingTabChange) {
      const timer = setTimeout(() => {
        setActiveTab(pendingTabChange as "list" | "calendar" | "reminders" | "analytics");
        setPendingTabChange(null);
      }, 100); // 100ms debounce

      return () => clearTimeout(timer);
    }
  }, [pendingTabChange]);

  // Auto-show reminders section when reminders tab is active
  useEffect(() => {
    if (activeTab === "reminders") {
      setShowRemindersSection(true);
    }
  }, [activeTab]);

  if (loading) {
    return <Loading fullScreen={true} text="Loading leads..." color="primary" />;
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        {/* Enhanced Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r "></div>
          <div className="sticky top-16 lg:top-20 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 lg:py-6">
              <div className="flex flex-col space-y-2 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="p-1.5 sm:p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md sm:rounded-lg shadow-sm">
                    <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-5xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-1.1 ml-1 ">Lead Management</h1>
                      {isConnected && (
                        <div className="flex items-center gap-1">
                          <Wifi className="w-4 h-4 text-green-500" />
                          <span className="text-xs text-green-600">Live</span>
                        </div>
                      )}
                      {isNestLeadsEnabled() && (
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                          Nest API
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm lg:text-base text-gray-600 ml-1">
                      {isNestLeadsEnabled()
                        ? 'Leads loaded from NestJS + PostgreSQL'
                        : 'Manage and track all your leads effectively'}
                      {lastUpdate && (
                        <span className="ml-2 text-xs text-gray-500">
                          • Updated {lastUpdate.toLocaleTimeString()}
                        </span>
                      )}
                    </p>
                </div>
              </div>

              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-10xl mx-auto px-2 sm:px-2 py-1 sm:py-2">
          {/* Simple Tab Navigation */}
          <div className="mb-1">
            <div className="rounded-lg p-1">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg">
                  <TabsTrigger 
                    value="list" 
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                  >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Lead List</span>
                    <span className="sm:hidden">List</span>
                </TabsTrigger>
                  

                  
                  <TabsTrigger 
                    value="analytics" 
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                  >
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Analytics</span>
                    <span className="sm:hidden">Analytics</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-4">
                <div className="space-y-4">






                  {/* Leads list — full page width, page scroll (no inner height box) */}
                <section className="w-full">
                  <div className="px-2 sm:px-4 pt-2 pb-3">
                    {/* Header Row: Title, Search, Filters, Actions */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      {/* Left: Title & Count */}
                      <div className="flex items-center gap-3 min-w-fit">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                          Leads
                        </h2>
                        <Badge variant="secondary" className="px-2.5 py-1 text-sm bg-slate-100 text-slate-600 border border-slate-200" title="Total leads loaded for your centre">
                          {filteredLeads.length}
                          {filteredLeads.length !== leadsData.length && (
                            <span className="text-slate-400 font-normal"> / {leadsData.length}</span>
                          )}
                        </Badge>
                      </div>

                      {/* Right: Search, Filter, Actions */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                        <div className="relative group w-full sm:w-[320px] lg:w-[400px]">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                          <Input
                            placeholder="Search leads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 sm:h-10 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white transition-all duration-300"
                          />
                        </div>

                        <Button
                          onClick={() => setShowFilters(!showFilters)}
                          variant={showFilters ? "secondary" : "outline"}
                          className={`flex items-center gap-2 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-all duration-200 ${
                            showFilters 
                              ? "bg-blue-50 text-blue-600 border-blue-200" 
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>Filters</span>
                          <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                        </Button>

                        {/* Action Buttons Group */}
                        <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-3 ml-0 sm:ml-1">
                          <TooltipProvider delayDuration={100}>
                            <div className="flex items-center gap-2">
                              {/* Download Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={downloadSelectedLeads}
                                    disabled={selectedLeads.size === 0}
                                    size="sm"
                                    variant="outline"
                                    className="h-9 w-9 p-0 rounded-lg text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download Selected</TooltipContent>
                              </Tooltip>

                              {/* Import Button */}
                              {/* Import Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    onClick={() => fileInputRef.current?.click()}
                                    size="sm" 
                                    variant="outline" 
                                    className="h-9 w-9 p-0 rounded-lg text-slate-600 hover:text-green-600 hover:border-green-200 transition-colors"
                                  >
                                    <Upload className="w-4 h-4" />
                                    <input 
                                      type="file" 
                                      ref={fileInputRef}
                                      accept=".xlsx,.xls" 
                                      onChange={handleImport} 
                                      className="hidden" 
                                      id="import-file-header" 
                                    />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Import Leads</TooltipContent>
                              </Tooltip>

                              {/* Add Lead Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    onClick={handleAddLead} 
                                    size="sm" 
                                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-2 shadow-sm hover:shadow-md transition-all font-medium"
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Add Lead</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add New Lead</TooltipContent>
                              </Tooltip>

                              {/* Delete Selected Button (Conditional) */}
                               {selectAll && filteredLeads.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={() => setShowDeleteAllDialog(true)}
                                      disabled={isDeletingAll}
                                      size="sm"
                                      variant="outline"
                                      className="h-9 w-9 p-0 rounded-lg text-red-500 border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete Selected</TooltipContent>
                                </Tooltip>
                              )}

                            </div>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>

                    {/* Active Filters Row (Visible when filters are active) */}
                     {(selectedStatuses.length > 0 || selectedSource !== "" || selectedCourses.length > 0 || selectedCity !== "" || selectedCounselors.length > 0 || enquiryDateFilter !== "" || showTodayOnly || followupStatusFilter !== "all" || followupTypeFilter !== "all" || followupDateFrom !== "" || followupDateTo !== "" || showOverdueOnly || showScheduledOnly) && (
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-1 pb-1">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Active:</span>
                            {selectedStatuses.length > 0 && (
                              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                                Status: {selectedStatuses.join(", ")}
                              </Badge>
                            )}
                            {selectedSource && <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">Source: {selectedSource}</Badge>}
                            {selectedCourses.length > 0 && <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">Course: {selectedCourses.join(", ")}</Badge>}
                            {selectedCity && <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200">City: {selectedCity}</Badge>}
                            {selectedCounselors.length > 0 && <Badge variant="secondary" className="bg-pink-50 text-pink-700 border-pink-200">Counselor: {selectedCounselors.join(", ")}</Badge>}
                            {enquiryDateFilter !== "" && <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200">Date: {enquiryDateFilter}</Badge>}
                            {showTodayOnly && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Today Only</Badge>}
                            {followupStatusFilter !== "all" && <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">F-Up Status: {followupStatusFilter}</Badge>}
                            {followupTypeFilter !== "all" && <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">F-Up Type: {followupTypeFilter}</Badge>}
                            {showOverdueOnly && <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">Overdue</Badge>}
                            {showScheduledOnly && <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200">Scheduled</Badge>}
                            
                             <Button
                              onClick={() => {
                                setSelectedStatuses([]); setSelectedSource(""); setSelectedCourses([]);
                                setSelectedCity(""); setSelectedCounselors([]); setEnquiryDateFilter("");
                                setShowTodayOnly(false); setFollowupStatusFilter("all"); setFollowupTypeFilter("all");
                                setFollowupDateFrom(""); setFollowupDateTo(""); setShowOverdueOnly(false);
                                setShowScheduledOnly(false); setCurrentPage(1);
                              }}
                              variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              Clear All
                            </Button>
                        </div>
                     )}


                    {/* Collapsible Filter Panel */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-[2000px] opacity-100 pt-4 border-t border-slate-100' : 'max-h-0 opacity-0'}`}>
                      {/* Filter Grid */}
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {/* Status Filter - multi-select */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Status</label>
                            <div className="relative">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStatusFilterOpen((prev) => !prev)}
                                className="h-9 w-full justify-between bg-slate-50 border-slate-200 hover:bg-slate-100"
                              >
                                <span className="truncate text-xs text-slate-700">
                                  {selectedStatuses.length > 0 ? `${selectedStatuses.length} selected` : "—"}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              </Button>
                              {statusFilterOpen && (
                                <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg p-2 max-h-56 overflow-y-auto">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedStatuses([])}
                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-600"
                                  >
                                    Clear selection
                                  </button>
                                  {statuses.map((status) => {
                                    const checked = selectedStatuses.includes(status);
                                    return (
                                      <button
                                        key={status}
                                        type="button"
                                        onClick={() => {
                                          setSelectedStatuses((prev) =>
                                            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                                          );
                                        }}
                                        className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100"
                                      >
                                        <span className="truncate">{status}</span>
                                        {checked && <Check className="w-4 h-4 text-green-600" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                           {/* Source Filter */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Source</label>
                            <div className="relative">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSourceFilterOpen((prev) => !prev)}
                                className="h-9 w-full justify-between bg-slate-50 border-slate-200 hover:bg-slate-100"
                              >
                                <span className="truncate text-xs text-slate-700">{selectedSource || "—"}</span>
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              </Button>
                              {sourceFilterOpen && (
                                <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg p-2 max-h-56 overflow-y-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSource("");
                                      setSourceFilterOpen(false);
                                    }}
                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-600"
                                  >
                                    Clear selection
                                  </button>
                                  {sources.map((source) => {
                                    const checked = selectedSource === source;
                                    return (
                                      <button
                                        key={source}
                                        type="button"
                                        onClick={() => {
                                          setSelectedSource(source);
                                          setSourceFilterOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100"
                                      >
                                        <span className="truncate">{source}</span>
                                        {checked && <Check className="w-4 h-4 text-green-600" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                            {/* Course Filter */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Course</label>
                            <div className="relative">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCourseFilterOpen((prev) => !prev)}
                                className="h-9 w-full justify-between bg-slate-50 border-slate-200 hover:bg-slate-100"
                              >
                                <span className="truncate text-xs text-slate-700">
                                  {selectedCourses.length > 0 ? `${selectedCourses.length} selected` : "—"}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              </Button>
                              {courseFilterOpen && (
                                <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg p-2 max-h-56 overflow-y-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCourses([]);
                                    }}
                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-600"
                                  >
                                    Clear selection
                                  </button>
                                  {courses.map((course) => {
                                    const checked = selectedCourses.includes(course);
                                    return (
                                      <button
                                        key={course}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCourses((prev) =>
                                            prev.includes(course) ? prev.filter((item) => item !== course) : [...prev, course]
                                          );
                                        }}
                                        className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100"
                                      >
                                        <span className="truncate">{course}</span>
                                        {checked && <Check className="w-4 h-4 text-green-600" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                            {/* City Filter */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">City</label>
                            <div className="relative">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCityFilterOpen((prev) => !prev)}
                                className="h-9 w-full justify-between bg-slate-50 border-slate-200 hover:bg-slate-100"
                              >
                                <span className="truncate text-xs text-slate-700">{selectedCity || "—"}</span>
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              </Button>
                              {cityFilterOpen && (
                                <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg p-2 max-h-56 overflow-y-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCity("");
                                      setCityFilterOpen(false);
                                    }}
                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-600"
                                  >
                                    Clear selection
                                  </button>
                                  {cities.map((city) => {
                                    const checked = selectedCity === city;
                                    return (
                                      <button
                                        key={city}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCity(city);
                                          setCityFilterOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100"
                                      >
                                        <span className="truncate">{city}</span>
                                        {checked && <Check className="w-4 h-4 text-green-600" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                            {/* Counselor Filter */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Counselor</label>
                            <div className="relative">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCounselorFilterOpen((prev) => !prev)}
                                className="h-9 w-full justify-between bg-slate-50 border-slate-200 hover:bg-slate-100"
                              >
                                <span className="truncate text-xs text-slate-700">
                                  {selectedCounselors.length > 0 ? `${selectedCounselors.length} selected` : "—"}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              </Button>
                              {counselorFilterOpen && (
                                <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg p-2 max-h-56 overflow-y-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCounselors([]);
                                    }}
                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 text-slate-600"
                                  >
                                    Clear selection
                                  </button>
                                  {counselors.map((counselor) => {
                                    const checked = selectedCounselors.includes(counselor);
                                    return (
                                      <button
                                        key={counselor}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCounselors((prev) =>
                                            prev.includes(counselor)
                                              ? prev.filter((item) => item !== counselor)
                                              : [...prev, counselor]
                                          );
                                        }}
                                        className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100"
                                      >
                                        <span className="truncate">{counselor}</span>
                                        {checked && <Check className="w-4 h-4 text-green-600" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                           {/* Enquiry Date Filter */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Enquiry Date</label>
                            <Input type="date" value={enquiryDateFilter} onChange={(e) => setEnquiryDateFilter(e.target.value)} className="h-9 bg-slate-50 border-slate-200" />
                          </div>
                            {/* Follow-up Date From */}
                           <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">F-Up From</label>
                            <Input type="date" value={followupDateFrom} onChange={(e) => setFollowupDateFrom(e.target.value)} className="h-9 bg-slate-50 border-slate-200" />
                          </div>
                             {/* Follow-up Date To */}
                           <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">F-Up To</label>
                            <Input type="date" value={followupDateTo} onChange={(e) => setFollowupDateTo(e.target.value)} className="h-9 bg-slate-50 border-slate-200" />
                          </div>
                       </div>
                       
                        {/* Quick Action Filters Row */}
                       <div className="flex flex-wrap gap-3">
                            <Button
                            size="sm"
                            onClick={() => setShowTodayOnly(!showTodayOnly)}
                            variant={showTodayOnly ? "default" : "outline"}
                            className={`h-8 text-xs ${showTodayOnly ? "bg-emerald-600 hover:bg-emerald-700" : "text-slate-600 border-slate-200"}`}
                            >
                            <Calendar className="w-3.5 h-3.5 mr-1.5" />
                            Today's Leads
                            </Button>
                             <Button
                            size="sm"
                            onClick={() => {
                              setShowOverdueOnly((prev) => {
                                const next = !prev;
                                if (next) setShowScheduledOnly(false);
                                return next;
                              });
                            }}
                            variant={showOverdueOnly ? "default" : "outline"}
                            className={`h-8 text-xs ${showOverdueOnly ? "bg-red-600 hover:bg-red-700" : "text-slate-600 border-slate-200"}`}
                            >
                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                            Overdue
                            </Button>
                             <Button
                            size="sm"
                            onClick={() => {
                              setShowScheduledOnly((prev) => {
                                const next = !prev;
                                if (next) setShowOverdueOnly(false);
                                return next;
                              });
                            }}
                            variant={showScheduledOnly ? "default" : "outline"}
                            className={`h-8 text-xs ${showScheduledOnly ? "bg-blue-600 hover:bg-blue-700" : "text-slate-600 border-slate-200"}`}
                            >
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            Scheduled
                            </Button>
                       </div>
                    </div>
                  </div>

                    <div
                        ref={tableScrollRef}
                        onWheel={handleLeadsTableWheel}
                        className="scrollbar-show overflow-x-auto w-full bg-white/80"
                        style={{ scrollbarGutter: "stable" }}
                      >
                          <Table className="border-collapse min-w-[2200px]">
                            <TableHeader>
                              <TableRow className="bg-slate-50 border-b border-slate-200">
                                <TableHead className="w-[48px] min-w-[48px] px-2 sticky left-0 z-20 font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                                  <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                  />
                                </TableHead>
                                <SortableTableHead className="w-[64px] min-w-[64px] sticky left-[48px] z-20 font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]" sortConfig={sortConfig} sortKey="srNo" requestSort={requestSort}>Sr. No.</SortableTableHead>
                                <SortableTableHead className="w-[120px] min-w-[120px] sticky left-[112px] z-20 font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]" sortConfig={sortConfig} sortKey="enquiryDate" requestSort={requestSort}>Enquiry Date</SortableTableHead>
                                <SortableTableHead className="w-[150px] min-w-[150px] sticky left-[232px] z-20 font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" sortConfig={sortConfig} sortKey="leadName" requestSort={requestSort}>Lead Name</SortableTableHead>
                                <SortableTableHead className="min-w-[120px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="contactedDate" requestSort={requestSort}>Contacted Date</SortableTableHead>
                                <SortableTableHead className="w-[150px] min-w-[150px] font-semibold text-slate-700 py-3 sm:py-4 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="contact" requestSort={requestSort}>Contact</SortableTableHead>
                                <SortableTableHead className="min-w-[150px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="emailId" requestSort={requestSort}>Email ID</SortableTableHead>
                                <SortableTableHead className="min-w-[100px] sm:min-w-[120px] max-w-[180px] sm:max-w-[200px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="course" requestSort={requestSort}>Course</SortableTableHead>
                                <SortableTableHead className="min-w-[80px] sm:min-w-[100px] max-w-[120px] sm:max-w-[150px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="courseDuration" requestSort={requestSort}>Course Duration</SortableTableHead>
                                <SortableTableHead className="min-w-[80px] sm:min-w-[100px] max-w-[120px] sm:max-w-[150px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="education" requestSort={requestSort}>Education</SortableTableHead>
                                <SortableTableHead className="min-w-[150px] sm:min-w-[180px] max-w-[220px] sm:max-w-[250px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="source" requestSort={requestSort}>Source</SortableTableHead>
                                <SortableTableHead className="min-w-[100px] sm:min-w-[120px] max-w-[150px] sm:max-w-[180px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="cityArea" requestSort={requestSort}>City/Area</SortableTableHead>
                                <SortableTableHead className="min-w-[100px] sm:min-w-[120px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="nextFollowUpDate" requestSort={requestSort}>Next Follow-up Date</SortableTableHead>
                                <SortableTableHead className="min-w-[80px] sm:min-w-[100px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="status" requestSort={requestSort}>Status</SortableTableHead>
                                <SortableTableHead className="min-w-[120px] sm:min-w-[150px] max-w-[180px] sm:max-w-[200px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="counselorName" requestSort={requestSort}>Counselor Name</SortableTableHead>
                                <SortableTableHead className="min-w-[120px] sm:min-w-[150px] max-w-[200px] sm:max-w-[250px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="feedbackCallRemarks" requestSort={requestSort}>Feedback Call Remarks</SortableTableHead>
                                <SortableTableHead className="min-w-[120px] sm:min-w-[150px] max-w-[200px] sm:max-w-[250px] font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50" sortConfig={sortConfig} sortKey="finalRemark" requestSort={requestSort}>Final Remark</SortableTableHead>
                                <TableHead className="w-24 sm:w-32 font-semibold text-slate-700 py-2 sm:py-3 text-xs sm:text-sm bg-slate-50">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                          {currentLeads.map((lead, index) => {
                            // Debug data issues in development
                            if (import.meta.env.DEV) {
                              debugLeadData(lead, index);
                            }
                            
                            return (
                              <TableRow 
                                key={lead.id} 
                                className={`${getCustomRowBackgroundColor(lead.status)} ${getTodayLeadClass(lead)}`} 
                                style={{...getCustomRowStyle(lead.status), ...getTodayLeadStyle(lead)}}
                              >
                              <TableCell className="w-[48px] min-w-[48px] px-2 sticky left-0 z-10 bg-inherit">
                                  <input
                                    type="checkbox"
                                    checked={selectedLeads.has(lead.id)}
                                    onChange={() => handleLeadSelect(lead.id)}
                                  className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                  />
                                </TableCell>
                              <TableCell className="w-[64px] min-w-[64px] font-medium sticky left-[48px] z-10 bg-inherit">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className="text-xs sm:text-sm tabular-nums">{lead.srNo ?? "—"}</span>
                                  {isTodayLead(lead) && (
                                    <Badge className="bg-emerald-100 text-emerald-700 text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded-full border border-emerald-200 font-medium">
                                      <span className="hidden sm:inline">Today</span>
                                      <span className="sm:hidden">T</span>
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px] sticky left-[112px] z-10 bg-inherit shadow-[1px_0_0_0_#e2e8f0]">
                                <div className="text-xs sm:text-sm text-gray-700 font-medium">
                                  {formatDate(lead.enquiryDate)}
                                </div>
                              </TableCell>
                              <TableCell className="w-[150px] min-w-[150px] sticky left-[232px] z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <div className="font-medium text-gray-900 leading-relaxed text-xs sm:text-sm">
                                  {validateAndRender(lead.leadName, 'leadName')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[100px] sm:min-w-[120px]">
                                <div className="text-xs sm:text-sm text-gray-700 font-medium">
                                  {formatDate(lead.contactedDate)}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[100px] sm:min-w-[120px] max-w-[120px] sm:max-w-[150px]">
                                <div className="text-xs sm:text-sm text-gray-700 font-medium">
                                  {validateAndRender(lead.contact, 'contact')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[120px] sm:min-w-[150px] max-w-[180px] sm:max-w-[200px]">
                                <div className="text-xs sm:text-sm text-gray-600 truncate" title={lead.emailId}>
                                  {validateAndRender(lead.emailId, 'emailId')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[100px] sm:min-w-[120px] max-w-[180px] sm:max-w-[200px]">
                                <div className="font-medium text-gray-900 text-xs sm:text-sm">
                                  {validateAndRender(lead.course, 'course')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[80px] sm:min-w-[100px] max-w-[120px] sm:max-w-[150px]">
                                <div className="text-xs sm:text-sm text-gray-700 font-medium">
                                  {validateAndRender(lead.courseDuration, 'courseDuration')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[80px] sm:min-w-[100px] max-w-[120px] sm:max-w-[150px]">
                                <div className="text-xs sm:text-sm text-gray-700">
                                  {validateAndRender(lead.education, 'education')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[150px] sm:min-w-[180px] max-w-[220px] sm:max-w-[250px]">
                                <div title={lead.source} className="cursor-help">
                                  <Badge className={`${getSourceColor(lead.source)} whitespace-normal text-left text-xs px-2 py-1 font-medium leading-tight`}>
                                    {validateAndRender(lead.source, 'source')}
                                  </Badge>
                                </div>
                                </TableCell>
                              <TableCell className="min-w-[100px] sm:min-w-[120px] max-w-[150px] sm:max-w-[180px]">
                                <div className="text-xs sm:text-sm text-gray-700 font-medium break-words">
                                  {validateAndRender(lead.cityArea, 'cityArea')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[100px] sm:min-w-[120px]">
                                {(() => {
                                  const activeFollowUpDate = lead.nextFollowUpDate || lead.followUpDate;
                                  const isFollowUpDone = !activeFollowUpDate && lead.followUpNotificationDone === true;

                                  return (
                                    <div className="flex flex-col gap-1">
                                      <div className="text-xs sm:text-sm text-gray-700 font-medium">
                                        {formatDate(activeFollowUpDate)}
                                      </div>
                                      {isFollowUpDone && (
                                        <Badge className="w-fit text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200">
                                          Follow-up Done
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="min-w-[80px] sm:min-w-[100px]">
                                <Badge className={`${getCustomStatusColor(lead.status)} text-xs px-1 sm:px-2 py-0.5 sm:py-1`} style={getCustomStatusStyle(lead.status)}>
                                    {validateAndRender(lead.status === "New" ? "Other" : lead.status === "Converted (Admission Done)" ? "Admission Done" : lead.status, 'status')}
                                  </Badge>
                                </TableCell>
                              <TableCell className="min-w-[120px] sm:min-w-[150px] max-w-[180px] sm:max-w-[200px]">
                                <div className="text-xs sm:text-sm text-gray-700 font-medium truncate">
                                  {validateAndRender(lead.counselorName === "Gaurav" ? "NC" : lead.counselorName, 'counselorName')}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[120px] sm:min-w-[150px] max-w-[200px] sm:max-w-[250px]">
                                <div 
                                  className="text-xs sm:text-sm text-gray-700 leading-relaxed cursor-help"
                                  title={(() => {
                                    const combined = [lead.feedbackCallRemarks, lead.remark].filter(Boolean).join(", ");
                                    return combined.length > 50 ? combined : undefined;
                                  })()}
                                >
                                  {(() => {
                                    const combined = [lead.feedbackCallRemarks, lead.remark].filter(Boolean).join(", ");
                                    if (!combined) return validateAndRender(undefined, 'feedbackCallRemarks');
                                    if (combined.length > 50) return `${combined.substring(0, 50)}...`;
                                    return combined;
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[120px] sm:min-w-[150px] max-w-[200px] sm:max-w-[250px]">
                                <div 
                                  className="text-xs sm:text-sm text-gray-700 leading-relaxed cursor-help"
                                  title={lead.finalRemark && lead.finalRemark.length > 50 ? lead.finalRemark : undefined}
                                >
                                  {lead.finalRemark && lead.finalRemark.length > 50 
                                    ? `${lead.finalRemark.substring(0, 50)}...` 
                                    : validateAndRender(lead.finalRemark, 'finalRemark')
                                  }
                                </div>
                              </TableCell>
                              <TableCell className="w-24 sm:w-32">
                                <TooltipProvider delayDuration={100}>
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleLeadView(lead)}
                                          className="hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all duration-200 p-1 sm:p-2 h-7 sm:h-8 w-7 sm:w-8"
                                        >
                                          <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Lead Details</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleWhatsAppClick(lead)}
                                          className="hover:bg-green-50 hover:text-[#25D366] hover:border-[#25D366]/50 transition-all duration-200 p-1 sm:p-2 h-7 sm:h-8 w-7 sm:w-8"
                                        >
                                          <img src={whatsappIcon} alt="WhatsApp" className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Send WhatsApp</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedLead(lead);
                                            setFormMode("edit");
                                            setIsFormOpen(true);
                                          }}
                                          className="hover:bg-green-50 hover:text-green-600 hover:border-green-300 transition-all duration-200 p-1 sm:p-2 h-7 sm:h-8 w-7 sm:w-8"
                                        >
                                          <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit Lead</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setLeadToDelete(lead.id);
                                            setShowDeleteDialog(true);
                                          }}
                                          className="hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200 p-1 sm:p-2 h-7 sm:h-8 w-7 sm:w-8"
                                        >
                                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete Lead</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </TableCell>
                              </TableRow>
                            );
                          })}
                          </TableBody>
                        </Table>
                      </div>

                    {numberedLeads.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mt-4 sm:mt-6 py-3 border-t border-slate-200/80">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="text-xs sm:text-sm text-gray-600 font-medium">
                            Showing <span className="text-blue-600 font-bold">{startIndex + 1}</span> to{" "}
                            <span className="text-blue-600 font-bold">{Math.min(endIndex, filteredLeads.length)}</span> of{" "}
                            <span className="text-blue-600 font-bold">{filteredLeads.length}</span> results
                            {userProfile?.role === 'director' && (
                              <span className="text-slate-500 font-normal"> (all centres)</span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500">
                            Page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
                          </div>
                          <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                            Rows per page
                            <select
                              value={leadsPerPage}
                              onChange={(e) => setLeadsPerPage(Number(e.target.value))}
                              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                            >
                              {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>{size}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        
                        <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPage === 1}
                            className="flex items-center gap-1 hover:bg-blue-50 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                            >
                            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Previous</span>
                            <span className="sm:hidden">Prev</span>
                            </Button>
                          
                          <div className="flex items-center gap-1">
                            {/* First page */}
                            {currentPage > 3 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(1)}
                                className="w-6 h-6 sm:w-8 sm:h-8 p-0 hover:bg-blue-25 text-xs sm:text-sm"
                              >
                                1
                              </Button>
                            )}
                            
                            {/* Ellipsis */}
                            {currentPage > 4 && (
                              <span className="px-1 sm:px-2 text-gray-400 text-xs sm:text-sm">...</span>
                            )}
                            
                            {/* Page numbers around current */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(page => {
                                // Always show first and last page
                                if (page === 1 || page === totalPages) return true;
                                // Show pages around current page, but avoid duplicates
                                if (page >= currentPage - 1 && page <= currentPage + 1) {
                                  // Don't show page 1 again if it's already shown above
                                  if (page === 1 && currentPage > 3) return false;
                                  // Don't show last page again if it's already shown below
                                  if (page === totalPages && currentPage < totalPages - 2) return false;
                                  return true;
                                }
                                return false;
                              })
                              .map((page) => (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(page)}
                                  className={`w-6 h-6 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm ${
                                    currentPage === page 
                                      ? "bg-blue-400 text-white hover:bg-blue-500" 
                                      : "hover:bg-blue-25"
                                  }`}
                                >
                                  {page}
                                </Button>
                              ))}
                            
                            {/* Ellipsis */}
                            {currentPage < totalPages - 3 && (
                              <span className="px-1 sm:px-2 text-gray-400 text-xs sm:text-sm">...</span>
                            )}
                            
                            {/* Last page */}
                            {currentPage < totalPages - 2 && totalPages > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                className="w-6 h-6 sm:w-8 sm:h-8 p-0 hover:bg-blue-25 text-xs sm:text-sm"
                              >
                                {totalPages}
                              </Button>
                            )}
                          </div>
                          
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={currentPage === totalPages}
                            className="flex items-center gap-1 hover:bg-blue-25 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                            >
                            <span className="hidden sm:inline">Next</span>
                            <span className="sm:hidden">Next</span>
                            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                </section>
                </div>
              </TabsContent>



                              <TabsContent value="analytics" className="mt-6">
          
          
          <MemoizedAnalyticsDashboard
            key="analytics-view"
            leads={leadsData}
            reminders={reminders}
            calendarEvents={calendarEvents}
          />
        </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Status Management Dialog */}
        {selectedLead && (
          <LeadStatusManager
            open={showStatusDialog}
            onOpenChange={setShowStatusDialog}
            lead={selectedLead}
            onStatusUpdate={() => {
              fetchLeads();
              setShowStatusDialog(false);
            }}
          />
        )}

        {/* Lead Form Dialog */}
        <LeadForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          lead={selectedLead}
          mode={formMode}
        />

        {/* View Lead Dialog */}
        {selectedLead && (
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white border border-slate-200/80 shadow-xl rounded-2xl mx-4 sm:mx-0">
              {/* Header: compact profile strip */}
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/60 rounded-t-2xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white text-xl font-semibold shadow-inner">
                    {(selectedLead.leadName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-xl font-semibold text-slate-900 truncate pr-8">
                      {selectedLead.leadName}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 mt-0.5">
                      Lead details
                    </DialogDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className={cn("text-xs font-medium", getStatusColor(selectedLead.status))}>
                        {selectedLead.status === "New" ? "Other" : selectedLead.status === "Converted (Admission Done)" ? "Admission Done" : selectedLead.status}
                      </Badge>
                      {selectedLead.source && (
                        <Badge variant="outline" className={cn("text-xs", getSourceColor(selectedLead.source))}>
                          {selectedLead.source}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5 overflow-y-auto">
                {/* Contact */}
                <Card className="border border-slate-200/80 shadow-sm overflow-hidden">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-100">
                    <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" />
                      Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Primary contact</Label>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedLead.contact || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Email</Label>
                      <p className="text-sm text-slate-900 mt-0.5 truncate" title={selectedLead.emailId}>{selectedLead.emailId || "—"}</p>
                    </div>
                    {selectedLead.cityArea && (
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-medium text-slate-500">City / Area</Label>
                        <p className="text-sm text-slate-900 mt-0.5">{selectedLead.cityArea}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Course & education */}
                <Card className="border border-slate-200/80 shadow-sm overflow-hidden">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-100">
                    <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-slate-500" />
                      Course & education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Course interest</Label>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedLead.course || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Education</Label>
                      <p className="text-sm text-slate-900 mt-0.5">{selectedLead.education || "—"}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Schedule & meta */}
                <Card className="border border-slate-200/80 shadow-sm overflow-hidden">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-100">
                    <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      Schedule & meta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Assigned counselor</Label>
                      <p className="text-sm text-slate-900 mt-0.5">{selectedLead.counselorName === "Gaurav" ? "NC" : selectedLead.counselorName || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Enquiry date</Label>
                      <p className="text-sm text-slate-900 mt-0.5">{formatDate(selectedLead.enquiryDate)}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Follow-up date</Label>
                      <p className="text-sm text-slate-900 mt-0.5">
                        {selectedLead.followUpDate ? formatDate(selectedLead.followUpDate) : "Not scheduled"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Follow-up type</Label>
                      <p className="text-sm text-slate-900 mt-0.5">
                        {selectedLead.followUpType ? (
                          <Badge variant="outline" className={cn("text-xs", getFollowUpTypeColor(selectedLead.followUpType))}>
                            {selectedLead.followUpType}
                          </Badge>
                        ) : "Not specified"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Priority</Label>
                      <p className="text-sm text-slate-900 mt-0.5">
                        {selectedLead.priority ? (
                          <Badge variant="outline" className={cn("text-xs",
                            selectedLead.priority === "high" && "border-red-200 text-red-700",
                            selectedLead.priority === "medium" && "border-amber-200 text-amber-700",
                            selectedLead.priority === "low" && "border-emerald-200 text-emerald-700"
                          )}>
                            {selectedLead.priority}
                          </Badge>
                        ) : "Not set"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Created / updated</Label>
                      <p className="text-sm text-slate-900 mt-0.5">
                        {formatDate(selectedLead.createdAt)} / {formatDate(selectedLead.updatedAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Remarks & notes */}
                {(() => {
                  const combinedRemarks = [selectedLead.feedbackCallRemarks, selectedLead.remark].filter(Boolean).join(", ");
                  const hasRemarks = combinedRemarks || selectedLead.finalRemark || selectedLead.followUpNotes;
                  if (!hasRemarks) return null;
                  return (
                    <Card className="border border-slate-200/80 shadow-sm overflow-hidden">
                      <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-100">
                        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          Remarks & notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        {combinedRemarks && (
                          <div>
                            <Label className="text-xs font-medium text-slate-500">Feedback / remarks</Label>
                            <p className="text-sm text-slate-900 mt-1 bg-slate-50 rounded-lg p-3 border border-slate-100">{combinedRemarks}</p>
                          </div>
                        )}
                        {selectedLead.finalRemark && (
                          <div>
                            <Label className="text-xs font-medium text-slate-500">Final remark</Label>
                            <p className="text-sm text-slate-900 mt-1 bg-slate-50 rounded-lg p-3 border border-slate-100">{selectedLead.finalRemark}</p>
                          </div>
                        )}
                        {selectedLead.followUpNotes && (
                          <div>
                            <Label className="text-xs font-medium text-slate-500">Follow-up notes</Label>
                            <p className="text-sm text-slate-900 mt-1 bg-blue-50/80 rounded-lg p-3 border border-blue-100">{selectedLead.followUpNotes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>

              <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex flex-row gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewDialog(false)}
                  className="text-slate-700"
                >
                  Close
                </Button>
                {selectedLead.contact && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowViewDialog(false);
                      handleWhatsAppClick(selectedLead);
                    }}
                    className="text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/10"
                  >
                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedLead(selectedLead);
                    setFormMode("edit");
                    setIsFormOpen(true);
                    setShowViewDialog(false);
                  }}
                  className="bg-slate-800 hover:bg-slate-900 text-white"
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" />
                  Edit lead
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

                {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={(open) => {
            if (!open && isDeleting) {
              // Prevent closing while deletion is in progress
              return;
            }
            setShowDeleteDialog(open);
            if (!open && !isDeleting) {
              // Reset state when dialog closes (only if not deleting)
              setLeadToDelete(null);
            }
          }}
          onConfirm={async () => {
            if (leadToDelete && !isDeleting) {
              try {
                await handleLeadDelete(leadToDelete);
                // Reset state after successful deletion
                setLeadToDelete(null);
                setShowDeleteDialog(false);
              } catch (error) {
                console.error('❌ Error in delete confirmation:', error);
                // Keep dialog open if deletion failed
              }
            }
          }}
          title="Delete Lead"
          description="Are you sure you want to delete this lead? This action cannot be undone and will also delete all related follow-up reminders."
          isLoading={isDeleting}
          loadingText="Deleting..."
        />

        {/* Delete All Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={showDeleteAllDialog}
          onOpenChange={(open) => {
            if (!open && isDeletingAll) {
              // Prevent closing while deletion is in progress
              return;
            }
            setShowDeleteAllDialog(open);
          }}
          onConfirm={async () => {
            if (!isDeletingAll && leadsData.length > 0) {
              try {
                await handleDeleteAll();
              } catch (error) {
                console.error('❌ Error in delete all confirmation:', error);
                // Keep dialog open if deletion failed
              }
            }
          }}
          title="Delete All Leads"
          description={`Are you sure you want to delete ALL ${leadsData.length} leads? This action cannot be undone and will also delete all related follow-up reminders for each lead. This is a permanent action.`}
          isLoading={isDeletingAll}
          loadingText="Deleting all leads..."
          confirmText="Delete All"
        />

        </div>
      </div>
    </>
  );
}