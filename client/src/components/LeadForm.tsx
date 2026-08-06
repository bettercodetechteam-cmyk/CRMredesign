import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseDate } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, addDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSafeQuery, executeSafeQuery, firebaseHelpers } from '@/lib/firebaseHelpers';
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { commonSchemas, type LeadFormData } from "@/lib/validationUtils";
import { UserPlus, GraduationCap, Target, Calendar, XCircle, Bell, Clock, Plus, Edit, Trash2, ChevronDown } from "lucide-react";
import { defaultSources, getAllSources, addCustomSource, sourceManagerEvents } from "@/lib/sourceManager";
import { reminderService } from "@/lib/reminderService";
import { isWebsiteEnquiryLead } from "@/lib/centreDataStore";
import {
  getEnquiryDocumentId,
  getLeadDocRef,
} from "@/lib/leadDocumentUtils";
import { 
  LEAD_SOURCES, 
  ALL_STANDARDIZED_COURSES, 
  MODULAR_PROGRAMS, 
  cleanLeadData,
  validateCleanedData,
  type LeadData
} from "@/lib/leadDataCleaningService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getCityAreaOptions,
  addCustomCityArea,
  getCustomCityAreas,
} from "@/lib/maharashtraDistricts";
import { cn } from "@/lib/utils";
import { getNextSerialNumberFromItems } from "@/lib/serialNumberUtils";
import { isNestLeadsEnabled } from "@/lib/nestApi";
import {
  buildNestCreatePayload,
  buildNestUpdatePayload,
  isNestBackedLead,
  mapNestLeadToUi,
  mapUiStatusToNest,
} from "@/lib/nestLeadMapper";
import { nestLeadsApi } from "@/services/nest/leadsApi";
import { centreDataStore } from "@/lib/centreDataStore";

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: any;
  mode: "create" | "edit";
}



// Status: only these 8 + Other (add new like courses). "Converted (Admission Done)" renamed to "Admission Done"
const DEFAULT_STATUS_OPTIONS = [
  "Admission Done",
  "Cold Lead",
  "Hot Lead",
  "Not Interested",
  "Visited",
  "Placement",
  "Not Contacted",
  "Job Seeker",
  "Other"
] as const;
const CUSTOM_STATUSES_STORAGE_KEY = "customStatuses";

// Assigned To: Tayyaba, Snehal, Both, NC + Other (Gaurav removed, NC added)
const DEFAULT_ASSIGNED_TO_OPTIONS = ["Tayyaba", "Snehal", "Both", "NC", "Other"] as const;
const CUSTOM_ASSIGNEES_STORAGE_KEY = "customAssignees";

const PRESET_COURSE_DURATIONS = ["1", "1.5", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "27", "36"] as const;

function normalizeDurationValue(value: unknown): string {
  if (value == null || value === "") return "";
  return String(value).trim();
}

function isPresetCourseDuration(value: string): boolean {
  return (PRESET_COURSE_DURATIONS as readonly string[]).includes(value);
}

function formatDurationLabel(duration: string): string {
  if (duration === "1") return "1 Month";
  return `${duration} Months`;
}

// Use standardized courses from cleaning service - remove duplicates
const defaultCourses = Array.from(new Set([...ALL_STANDARDIZED_COURSES, ...MODULAR_PROGRAMS]));

export default function LeadForm({ open, onOpenChange, lead, mode }: LeadFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const formSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && !userProfile) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create or edit leads.",
        variant: "destructive",
      });
      onOpenChange(false);
    }
  }, [open, userProfile, toast, onOpenChange]);

  // State for dynamic courses
  const [courses, setCourses] = useState<string[]>(defaultCourses);
  const [showCustomCourseInput, setShowCustomCourseInput] = useState(false);
  const [customCourseName, setCustomCourseName] = useState("");

  // State for dynamic sources - use standardized sources
  const [sources, setSources] = useState<string[]>([...LEAD_SOURCES]);
  const [showCustomSourceInput, setShowCustomSourceInput] = useState(false);
  const [customSourceName, setCustomSourceName] = useState("");
  const [hasDraftData, setHasDraftData] = useState(false);
  
  // State for custom education input
  const [showCustomEducationInput, setShowCustomEducationInput] = useState(false);
  const [customEducationName, setCustomEducationName] = useState("");

  // State for Assigned To: default options + custom (Other) entries
  const [customAssignees, setCustomAssignees] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem(CUSTOM_ASSIGNEES_STORAGE_KEY) || "[]")
  );
  const [showCustomAssigneeInput, setShowCustomAssigneeInput] = useState(false);
  const [customAssigneeName, setCustomAssigneeName] = useState("");
  const [courseOpen, setCourseOpen] = useState(false);
  const [cityAreaOpen, setCityAreaOpen] = useState(false);
  const [customCityAreas, setCustomCityAreas] = useState<string[]>(() => getCustomCityAreas());
  const [showCustomCityAreaInput, setShowCustomCityAreaInput] = useState(false);
  const [customCityAreaName, setCustomCityAreaName] = useState("");
  // Status: custom entries from "Other" (like courses)
  const [customStatuses, setCustomStatuses] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem(CUSTOM_STATUSES_STORAGE_KEY) || "[]")
  );
  const [showCustomStatusInput, setShowCustomStatusInput] = useState(false);
  const [customStatusName, setCustomStatusName] = useState("");
  const [showCustomDurationInput, setShowCustomDurationInput] = useState(false);

  // Reminder management state
  const [reminders, setReminders] = useState<any[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [reminderFormData, setReminderFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    type: 'followup',
    notes: ''
  });

  // Fetch existing courses and sources from leads data and localStorage
  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        // Only fetch leads for the user's centre if centreId exists
        if (!userProfile?.centreId) {
          console.warn('⚠️ centreId is undefined, skipping Firebase query');
          // Fallback to default data + custom data from localStorage
          const savedCustomCourses = JSON.parse(localStorage.getItem('customCourses') || '[]');
          const fallbackCourses = Array.from(new Set([...defaultCourses, ...savedCustomCourses]));
          const fallbackSources = await getAllSources(); // Get sources without centreId filter
          
          setCourses(fallbackCourses);
          setSources(fallbackSources);
          return;
        }

        const leadsRef = collection(db, "leads");
        const safeQuery = createSafeQuery(leadsRef, [
          { field: 'centreId', operator: '==', value: userProfile.centreId }
        ]);
        
        if (!safeQuery) {
          console.warn('⚠️ Invalid query parameters, skipping Firebase query');
          return;
        }
        
        const querySnapshot = await getDocs(safeQuery);
        
        const existingCourses = new Set<string>();
        
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const courseValue = typeof data.course === "string" ? data.course.trim() : "";
          if (courseValue) {
            existingCourses.add(courseValue);
          }
        });
        
        // Load custom courses from localStorage
        const savedCustomCourses = JSON.parse(localStorage.getItem('customCourses') || '[]');
        
        // Combine standardized courses with existing courses and custom courses
        const allCourses = Array.from(new Set([
          ...defaultCourses, 
          ...Array.from(existingCourses),
          ...savedCustomCourses
        ]));
        setCourses(allCourses);
        
        // Use getAllSources which returns custom sources first (newest first), then defaults
        const allSources = await getAllSources(userProfile.centreId);
        setSources(allSources);
      } catch (error) {
        console.error('Error fetching existing data:', error);
        // Fallback to default data + custom data from localStorage
        const savedCustomCourses = JSON.parse(localStorage.getItem('customCourses') || '[]');
        
        const fallbackCourses = Array.from(new Set([...defaultCourses, ...savedCustomCourses]));
        const fallbackSources = Array.from(new Set([...LEAD_SOURCES]));
        
        setCourses(fallbackCourses);
        setSources(fallbackSources);
      }
    };
    
    fetchExistingData();
  }, [userProfile.centreId]);

  // Listen for source updates from other components
  useEffect(() => {
    const unsubscribe = sourceManagerEvents.subscribe(async (event) => {
      // Refresh sources when a new source is added
      if (event.detail.newSource && userProfile?.centreId) {
        const allSources = await getAllSources(userProfile.centreId);
        setSources(allSources);
      }
    });

    return unsubscribe;
  }, [userProfile?.centreId]);

  // Sync custom assignees and custom statuses from localStorage when dialog opens
  useEffect(() => {
    if (open) {
      const storedAssignees = JSON.parse(localStorage.getItem(CUSTOM_ASSIGNEES_STORAGE_KEY) || "[]");
      setCustomAssignees(Array.isArray(storedAssignees) ? storedAssignees : []);
      const storedStatuses = JSON.parse(localStorage.getItem(CUSTOM_STATUSES_STORAGE_KEY) || "[]");
      setCustomStatuses(Array.isArray(storedStatuses) ? storedStatuses : []);
    }
  }, [open]);

  // Handle education field - check if value is in predefined list when form is populated
  const predefinedOptions = [
    "Below 10th",
    "10th / Secondary School",
    "12th / Higher Secondary",
    "Diploma",
    "Undergraduate (UG)",
    "Postgraduate (PG)",
    "Doctorate (PhD)",
    "Working",
    "Business"
  ];
  
  useEffect(() => {
    if (!open) {
      setShowCustomEducationInput(false);
      setCustomEducationName("");
      return;
    }
    
    try {
      const educationValue = form.getValues("education") || "";
      
      if (educationValue && !predefinedOptions.includes(educationValue)) {
        // If education is not in predefined list, show custom input
        setShowCustomEducationInput(true);
        setCustomEducationName(educationValue);
      } else if (educationValue && predefinedOptions.includes(educationValue)) {
        // If education is in predefined list, hide custom input
        setShowCustomEducationInput(false);
        setCustomEducationName("");
      } else {
        // If no education value, hide custom input
        setShowCustomEducationInput(false);
        setCustomEducationName("");
      }
    } catch (error) {
      // If form is not ready yet, just hide custom input
      setShowCustomEducationInput(false);
      setCustomEducationName("");
    }
  }, [open, lead?.education]);

  // Function to handle adding new course
  const handleAddCustomCourse = () => {
    if (customCourseName.trim()) {
      const newCourse = customCourseName.trim();
      if (!courses.includes(newCourse)) {
        const updatedCourses = [...courses, newCourse];
        setCourses(updatedCourses);
        form.setValue("interestedCourse", newCourse);
        
        // Save to localStorage for persistence
        const savedCourses = JSON.parse(localStorage.getItem('customCourses') || '[]');
        if (!savedCourses.includes(newCourse)) {
          savedCourses.push(newCourse);
          localStorage.setItem('customCourses', JSON.stringify(savedCourses));
        }
        
        toast({
          title: "Course Added",
          description: `"${newCourse}" has been added to the course list.`,
        });
      } else {
        toast({
          title: "Course Already Exists",
          description: `"${newCourse}" is already in the course list.`,
          variant: "destructive",
        });
      }
      setCustomCourseName("");
      setShowCustomCourseInput(false);
    }
  };

  // Function to handle adding new source
  const handleAddCustomSource = async () => {
    if (customSourceName.trim()) {
      const newSource = customSourceName.trim();
      
      // Check if source already exists (case-insensitive)
      const sourceExists = sources.some(s => s.toLowerCase() === newSource.toLowerCase());
      
      if (sourceExists) {
        // Find the matching source to preserve original casing
        const existingSource = sources.find(s => s.toLowerCase() === newSource.toLowerCase()) || newSource;
        
        toast({
          title: "Source Selected",
          description: `"${existingSource}" is already in the list and has been selected.`,
        });
        
        form.setValue("source", existingSource, { shouldDirty: true, shouldValidate: true });
        setCustomSourceName("");
        setShowCustomSourceInput(false);
        return;
      }
      
      try {
        // Add to Firestore (permanent storage)
        const addedSource = await addCustomSource(newSource, userProfile?.centreId);
        
        if (addedSource) {
          // Add new source at the beginning of the list (position 1)
          const updatedSources = [addedSource, ...sources];
          setSources(updatedSources);
          form.setValue("source", addedSource);
          
          // Notify other components about the new source
          sourceManagerEvents.notifySourceUpdate(addedSource);
          
          toast({
            title: "Source Added",
            description: `"${addedSource}" has been added at the top of the source list and will be available for future leads.`,
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to add source. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error adding custom source:', error);
        toast({
          title: "Error",
          description: "An error occurred while adding the source. Please try again.",
          variant: "destructive",
        });
      }
      
      setCustomSourceName("");
      setShowCustomSourceInput(false);
    }
  };

  useEffect(() => {
    const onCityAreaUpdated = () => setCustomCityAreas(getCustomCityAreas());
    window.addEventListener("cityAreaUpdated", onCityAreaUpdated);
    return () => window.removeEventListener("cityAreaUpdated", onCityAreaUpdated);
  }, []);

  const handleAddCustomCityArea = () => {
    if (!customCityAreaName.trim()) return;
    const result = addCustomCityArea(customCityAreaName);
    if (!result.ok) return;

    if (result.usedExisting) {
      toast({
        title: "City/Area selected",
        description: `"${result.value}" is already in the list and has been selected.`,
      });
    } else {
      setCustomCityAreas(getCustomCityAreas());
      toast({
        title: "City/Area added",
        description: `"${result.value}" has been added to City/Area options.`,
      });
    }

    form.setValue("cityArea", result.value);
    setCustomCityAreaName("");
    setShowCustomCityAreaInput(false);
    setCityAreaOpen(false);
  };

  // Function to handle course selection
  const handleCourseSelection = (value: string) => {
    if (value === "Others") {
      setShowCustomCourseInput(true);
      form.setValue("interestedCourse", "");
    } else {
      setShowCustomCourseInput(false);
      form.setValue("interestedCourse", value);
    }
  };

  // Function to handle source selection
  const handleSourceSelection = (value: string) => {
    if (value === "Add Other Source") {
      setShowCustomSourceInput(true);
      form.setValue("source", "", { shouldDirty: true, shouldValidate: true });
    } else {
      setShowCustomSourceInput(false);
      form.setValue("source", value, { shouldDirty: true, shouldValidate: true });
    }
  };

  // Assigned To options: Tayyaba, Snehal, Both, NC, ...custom, Other (no duplicates; Gaurav removed)
  const assigneesList = useMemo(() => {
    const base = ["Tayyaba", "Snehal", "Both", "NC"];
    const customOnly = customAssignees.filter(
      (n) => n !== "Gaurav" && !base.includes(n) && n !== "Other"
    );
    const withCustom = [...base, ...customOnly, "Other"];
    const current = lead?.counselorName || lead?.assignedTo;
    const normalized = current === "Gaurav" ? "NC" : current;
    if (normalized && typeof normalized === "string" && normalized.trim() && !withCustom.includes(normalized.trim())) {
      return [normalized.trim(), ...withCustom];
    }
    return withCustom;
  }, [lead?.counselorName, lead?.assignedTo, customAssignees]);

  const handleAssigneeSelection = (value: string) => {
    if (value === "Other") {
      setShowCustomAssigneeInput(true);
      form.setValue("assignedTo", "");
    } else {
      setShowCustomAssigneeInput(false);
      form.setValue("assignedTo", value);
      setCustomAssigneeName("");
    }
  };

  const handleAddCustomAssignee = () => {
    if (!customAssigneeName.trim()) return;
    const newName = customAssigneeName.trim();
    if (["Tayyaba", "Snehal", "Both", "NC", "Other"].includes(newName)) {
      toast({
        title: "Use existing option",
        description: `Please select "${newName}" from the dropdown instead.`,
        variant: "destructive",
      });
      return;
    }
    if (customAssignees.includes(newName)) {
      toast({
        title: "Already added",
        description: `"${newName}" is already in the list.`,
        variant: "destructive",
      });
      setCustomAssigneeName("");
      setShowCustomAssigneeInput(false);
      form.setValue("assignedTo", newName);
      return;
    }
    const updated = [...customAssignees, newName];
    setCustomAssignees(updated);
    localStorage.setItem(CUSTOM_ASSIGNEES_STORAGE_KEY, JSON.stringify(updated));
    form.setValue("assignedTo", newName);
    setCustomAssigneeName("");
    setShowCustomAssigneeInput(false);
    toast({
      title: "Assignee added",
      description: `"${newName}" has been added to Assigned To options.`,
    });
  };

  // Status list: 8 fixed + custom + current lead value if not in list + Other
  const statusList = useMemo(() => {
    const fixed = DEFAULT_STATUS_OPTIONS.filter((s) => s !== "Other");
    const withCustom = [...fixed, ...customStatuses, "Other"];
    const current = lead?.status;
    if (current && typeof current === "string" && current.trim() && !withCustom.includes(current.trim())) {
      return [current.trim(), ...withCustom];
    }
    return withCustom;
  }, [lead?.status, customStatuses]);

  const handleStatusSelection = (value: string) => {
    if (value === "Other") {
      setShowCustomStatusInput(true);
      form.setValue("status", "");
    } else {
      setShowCustomStatusInput(false);
      form.setValue("status", value);
      setCustomStatusName("");
    }
  };

  const syncDurationInputState = (duration: unknown) => {
    const normalized = normalizeDurationValue(duration);
    setShowCustomDurationInput(Boolean(normalized && !isPresetCourseDuration(normalized)));
  };

  const handleDurationSelection = (value: string) => {
    if (value === "Other") {
      setShowCustomDurationInput(true);
      form.setValue("courseDuration", "");
    } else {
      setShowCustomDurationInput(false);
      form.setValue("courseDuration", value);
    }
  };

  const handleAddCustomStatus = () => {
    if (!customStatusName.trim()) return;
    const newStatus = customStatusName.trim();
    if (["Admission Done", "Cold Lead", "Hot Lead", "Not Interested", "Visited", "Placement", "Not Contacted", "Job Seeker", "Other"].includes(newStatus)) {
      toast({
        title: "Use existing option",
        description: `Please select "${newStatus}" from the dropdown instead.`,
        variant: "destructive",
      });
      return;
    }
    if (customStatuses.includes(newStatus)) {
      toast({
        title: "Already added",
        description: `"${newStatus}" is already in the list.`,
        variant: "destructive",
      });
      setCustomStatusName("");
      setShowCustomStatusInput(false);
      form.setValue("status", newStatus);
      return;
    }
    const updated = [...customStatuses, newStatus];
    setCustomStatuses(updated);
    localStorage.setItem(CUSTOM_STATUSES_STORAGE_KEY, JSON.stringify(updated));
    form.setValue("status", newStatus);
    setCustomStatusName("");
    setShowCustomStatusInput(false);
    toast({
      title: "Status added",
      description: `"${newStatus}" has been added to Status options.`,
    });
  };

  // Reminder management functions
  const fetchReminders = async () => {
    if (!lead?.id) return;
    
    try {
      if (!userProfile?.centreId) {
        console.warn('⚠️ centreId is undefined, skipping reminders query');
        setReminders([]);
        return;
      }
      
      const remindersRef = collection(db, 'reminders');
      const safeQuery = createSafeQuery(remindersRef, [
        { field: 'centreId', operator: '==', value: userProfile.centreId },
        { field: 'leadId', operator: '==', value: lead.id }
      ]);
      
      if (!safeQuery) {
        console.warn('⚠️ Invalid query parameters for reminders, skipping query');
        setReminders([]);
        return;
      }
      
      const querySnapshot = await getDocs(safeQuery);
      
      const remindersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>)
      }));
      
      setReminders(remindersData);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  };

  const createReminder = async () => {
    if (!userProfile?.centreId) {
      toast({
        title: "Error",
        description: "User centre ID not found",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Initialize reminder service if not already done
      if (!reminderService.getStatus().isInitialized && userProfile?.centreId) {
        reminderService.init(userProfile.centreId);
      }

      const reminderData = {
        leadId: lead?.id || 'temp', // Use temp ID for new leads
        leadName: form.getValues('name') || 'New Lead',
        leadPhone: form.getValues('phone') || '',
        leadEmail: form.getValues('email') || '',
        title: reminderFormData.title,
        description: reminderFormData.description,
        dueDate: new Date(reminderFormData.dueDate),
        status: 'pending',
        priority: reminderFormData.priority,
        type: reminderFormData.type,
        notes: reminderFormData.notes,
        assignedTo: form.getValues('assignedTo') || userProfile?.firstName || '',
        centreId: userProfile.centreId,
        createdBy: userProfile.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const reminderId = await reminderService.createReminder(reminderData);
      
      // Add the new reminder to the local state
      const newReminder = {
        id: reminderId,
        ...reminderData
      };
      
      setReminders(prev => [...prev, newReminder]);
      
      toast({
        title: "Success",
        description: "Reminder created successfully",
      });
      
      setShowReminderForm(false);
      setReminderFormData({
        title: '',
        description: '',
        dueDate: '',
        priority: 'medium',
        type: 'followup',
        notes: ''
      });
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast({
        title: "Error",
        description: "Failed to create reminder. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateReminder = async () => {
    if (!editingReminder) return;
    
    try {
      const updateData = {
        title: reminderFormData.title,
        description: reminderFormData.description,
        dueDate: new Date(reminderFormData.dueDate),
        priority: reminderFormData.priority,
        type: reminderFormData.type,
        notes: reminderFormData.notes,
        updatedAt: new Date(),
        updatedBy: userProfile?.uid
      };

      await reminderService.updateReminder(editingReminder.id, updateData);
      
      toast({
        title: "Success",
        description: "Reminder updated successfully",
      });
      
      setShowReminderForm(false);
      setEditingReminder(null);
      setReminderFormData({
        title: '',
        description: '',
        dueDate: '',
        priority: 'medium',
        type: 'followup',
        notes: ''
      });
      
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

  const deleteReminder = async (reminderId: string) => {
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

  const openEditReminder = (reminder: any) => {
    setEditingReminder(reminder);
    setReminderFormData({
      title: reminder.title,
      description: reminder.description,
      dueDate: reminder.dueDate.toDate ? reminder.dueDate.toDate().toISOString().split('T')[0] : new Date(reminder.dueDate).toISOString().split('T')[0],
      priority: reminder.priority || 'medium',
      type: reminder.type || 'followup',
      notes: reminder.notes || ''
    });
    setShowReminderForm(true);
  };

  const openCreateReminder = () => {
    setEditingReminder(null);
    
    // Pre-fill some fields based on form data
    const leadName = form.getValues('name') || '';
    const leadPhone = form.getValues('phone') || '';
    
    setReminderFormData({
      title: leadName ? `Follow up with ${leadName}` : '',
      description: leadName ? `Follow up call/meeting with ${leadName}` : '',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      priority: 'medium',
      type: 'followup',
      notes: leadPhone ? `Contact: ${leadPhone}` : ''
    });
    setShowReminderForm(true);
  };

  // Function to save form data to localStorage
  const saveFormData = useCallback((data: any) => {
    try {
      localStorage.setItem('leadFormDraft', JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save form data to localStorage:', error);
    }
  }, []);

  // Function to load form data from localStorage
  const loadFormData = () => {
    try {
      const saved = localStorage.getItem('leadFormDraft');
      if (saved) {
        const data = JSON.parse(saved);
        // Only load if data is less than 24 hours old
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          setHasDraftData(true);
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to load form data from localStorage:', error);
    }
    setHasDraftData(false);
    return null;
  };

  // Function to clear saved form data
  const clearFormData = useCallback(() => {
    try {
      localStorage.removeItem('leadFormDraft');
      setHasDraftData(false);
    } catch (error) {
      console.warn('Failed to clear form data from localStorage:', error);
    }
  }, []);

  // Load draft data once when component mounts
  const savedData = useMemo(() => {
    if (open && mode === 'create') {
      return loadFormData();
    }
    return null;
  }, [open, mode]);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(commonSchemas.lead),
    defaultValues: useMemo(() => {
      // If editing, use lead data (Gaurav -> NC for counselor/assignee)
      if (lead) {
        return {
          name: lead?.leadName || "",
          email: lead?.emailId || "",
          phone: lead?.contact ? lead.contact.toString() : "",
          centreId: lead?.centreId || userProfile?.centreId || "",
          interestedCourse: lead?.course || "",
          source: lead?.source || "",
          status: (lead?.status === "New" ? "Other" : lead?.status) || "Not Contacted",
          assignedTo: (lead?.counselorName === "Gaurav" || lead?.assignedTo === "Gaurav" ? "NC" : lead?.counselorName || lead?.assignedTo) || userProfile?.firstName || "",
          notes: lead?.remark || "",
          courseDuration: normalizeDurationValue(lead?.courseDuration),
          education: lead?.education || "",
          cityArea: lead?.cityArea || "",
          enquiryDate: lead?.enquiryDate ? (() => {
            const date = parseDate(lead.enquiryDate);
            return date ? date.toISOString().split('T')[0] : "";
          })() : "",
          contactedDate: lead?.contactedDate ? (() => {
            const date = parseDate(lead.contactedDate);
            return date ? date.toISOString().split('T')[0] : "";
          })() : "",
          nextFollowUpDate: (lead?.nextFollowUpDate || lead?.followUpDate) ? (() => {
            const date = parseDate(lead.nextFollowUpDate || lead.followUpDate);
            return date ? date.toISOString().split('T')[0] : "";
          })() : "",
          followUpDate: lead?.followUpDate ? (() => {
            const date = parseDate(lead.followUpDate);
            return date ? date.toISOString().split('T')[0] : "";
          })() : "",
          feedbackCallRemarks: lead?.feedbackCallRemarks || "",
          centreHeadRemarks: lead?.centreHeadRemarks || "",
          finalRemark: lead?.finalRemark || ""
        };
      }
      
      // If creating, use saved draft data
      if (savedData) {
        return {
          name: savedData.name || "",
          email: savedData.email || "",
          phone: savedData.phone || "",
          centreId: savedData.centreId || userProfile?.centreId || "",
          interestedCourse: savedData.interestedCourse || "",
          source: savedData.source || "",
          status: (savedData.status === "New" ? "Other" : savedData.status) || "Not Contacted",
          assignedTo: savedData.assignedTo || userProfile?.firstName || "",
          notes: savedData.notes || "",
          courseDuration: savedData.courseDuration || "",
          education: savedData.education || "",
          cityArea: savedData.cityArea || "",
          enquiryDate: savedData.enquiryDate || "",
          contactedDate: savedData.contactedDate || "",
          nextFollowUpDate: savedData.nextFollowUpDate || savedData.followUpDate || "",
          followUpDate: savedData.followUpDate || "",
          feedbackCallRemarks: savedData.feedbackCallRemarks || "",
          centreHeadRemarks: savedData.centreHeadRemarks || "",
          finalRemark: savedData.finalRemark || ""
        };
      }
      
      // Default values with user context (Assigned To: Tayyaba as default for new leads)
      return {
        name: "",
        email: "",
        phone: "",
        centreId: userProfile?.centreId || "",
        interestedCourse: "",
        source: "",
        status: "Not Contacted",
        assignedTo: "Tayyaba",
        notes: "",
        courseDuration: "",
        education: "",
        cityArea: "",
        enquiryDate: "",
        contactedDate: "",
        nextFollowUpDate: "",
        followUpDate: "",
        feedbackCallRemarks: "",
        centreHeadRemarks: "",
        finalRemark: ""
      };
    }, [lead, savedData, userProfile?.centreId, userProfile?.firstName])
  });

  const watchedCityArea = useWatch({ control: form.control, name: "cityArea" });
  const cityAreaOptions = useMemo(
    () => getCityAreaOptions(watchedCityArea || lead?.cityArea || ""),
    [customCityAreas, watchedCityArea, lead?.cityArea]
  );

  // Initialize form once per dialog open (avoid reset on realtime lead updates)
  useEffect(() => {
    if (!open) {
      formSessionRef.current = null;
      return;
    }

    const sessionKey = mode === "edit" && lead?.id ? `edit:${lead.id}` : "create";
    if (formSessionRef.current === sessionKey) {
      return;
    }
    formSessionRef.current = sessionKey;

    if (mode === "edit" && lead) {
      const editValues = {
        name: lead?.leadName || "",
        email: lead?.emailId || "",
        phone: lead?.contact ? lead.contact.toString() : "",
        centreId: lead?.centreId || userProfile?.centreId || "",
        interestedCourse: lead?.course || "",
        source: lead?.source || "",
        status: (lead?.status === "New" ? "Other" : lead?.status) || "Not Contacted",
        assignedTo:
          (lead?.counselorName === "Gaurav" || lead?.assignedTo === "Gaurav"
            ? "NC"
            : lead?.counselorName || lead?.assignedTo) ||
          userProfile?.firstName ||
          "",
        notes: lead?.remark || "",
        courseDuration: normalizeDurationValue(lead?.courseDuration),
        education: lead?.education || "",
        cityArea: lead?.cityArea || "",
        enquiryDate: lead?.enquiryDate
          ? (() => {
              const date = parseDate(lead.enquiryDate);
              return date ? date.toISOString().split("T")[0] : "";
            })()
          : "",
        contactedDate: lead?.contactedDate
          ? (() => {
              const date = parseDate(lead.contactedDate);
              return date ? date.toISOString().split("T")[0] : "";
            })()
          : "",
        nextFollowUpDate:
          lead?.nextFollowUpDate || lead?.followUpDate
            ? (() => {
                const date = parseDate(lead.nextFollowUpDate || lead.followUpDate);
                return date ? date.toISOString().split("T")[0] : "";
              })()
            : "",
        followUpDate: lead?.followUpDate
          ? (() => {
              const date = parseDate(lead.followUpDate);
              return date ? date.toISOString().split("T")[0] : "";
            })()
          : "",
        feedbackCallRemarks: lead?.feedbackCallRemarks || "",
        centreHeadRemarks: lead?.centreHeadRemarks || "",
        finalRemark: lead?.finalRemark || "",
      };
      form.reset(editValues);
      syncDurationInputState(editValues.courseDuration);
      if (lead?.education && !predefinedOptions.includes(lead.education)) {
        setShowCustomEducationInput(true);
        setCustomEducationName(lead.education);
      } else {
        setShowCustomEducationInput(false);
        setCustomEducationName("");
      }
      return;
    }

    if (mode === "create" && !hasDraftData) {
      form.reset({
        name: "",
        email: "",
        phone: "",
        centreId: userProfile?.centreId || "",
        interestedCourse: "",
        source: "",
        status: "Not Contacted",
        assignedTo: "Tayyaba",
        notes: "",
        courseDuration: "",
        education: "",
        cityArea: "",
        enquiryDate: "",
        contactedDate: "",
        nextFollowUpDate: "",
        followUpDate: "",
        feedbackCallRemarks: "",
        centreHeadRemarks: "",
        finalRemark: "",
      });
      setShowCustomEducationInput(false);
      setCustomEducationName("");
      setShowCustomSourceInput(false);
      setCustomSourceName("");
      setShowCustomCourseInput(false);
      setCustomCourseName("");
      setShowCustomAssigneeInput(false);
      setCustomAssigneeName("");
      setCourseOpen(false);
      setCityAreaOpen(false);
      setShowCustomStatusInput(false);
      setCustomStatusName("");
      setShowCustomDurationInput(false);
      setShowCustomCityAreaInput(false);
      setCustomCityAreaName("");
    }
  }, [open, mode, lead?.id, hasDraftData, userProfile?.centreId, userProfile?.firstName, form]);

  const mutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      try {
        // First, clean and validate the form data
        const leadDataToClean: LeadData = {
          leadName: data.name || "",
          contact: data.phone ? data.phone.toString() : "",
          emailId: data.email || "",
          course: data.interestedCourse || "",
          source: data.source || "",
          status: data.status || "Not Contacted",
          counselorName: data.assignedTo || "",
          remark: data.notes || "",
          cityArea: data.cityArea || "",
          enquiryDate: data.enquiryDate ? new Date(data.enquiryDate) : new Date(),
          contactedDate: data.contactedDate && data.contactedDate.trim() !== "" ? new Date(data.contactedDate) : null,
          nextFollowUpDate: data.nextFollowUpDate && data.nextFollowUpDate.trim() !== "" ? new Date(data.nextFollowUpDate) : null,
          followUpDate: data.nextFollowUpDate && data.nextFollowUpDate.trim() !== "" ? new Date(data.nextFollowUpDate) : null,
          feedbackCallRemarks: data.feedbackCallRemarks || "",
          centreHeadRemarks: data.centreHeadRemarks || "",
          finalRemark: data.finalRemark || "",
          courseDuration: data.courseDuration || "",
          education: data.education || "",
          centreId: userProfile?.centreId || 'unknown',
          createdBy: userProfile?.uid || 'unknown',
          updatedBy: userProfile?.uid || 'unknown',
          userRole: userProfile?.role || 'unknown',
          // Preserve creation date for edits
          createdAt: mode === 'edit' && lead?.createdAt ? parseDate(lead.createdAt) : undefined
        };

        // Clean the data
        const cleaningResult = cleanLeadData(leadDataToClean);
        
        // Validate the cleaned data
        const validation = validateCleanedData(cleaningResult.cleanedData);
        
        if (!validation.isValid) {
          throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
        }

        if (cleaningResult.warnings.length > 0) {
          console.warn('Data cleaning warnings:', cleaningResult.warnings);
        }

        // Use the cleaned data for database operations
        const leadData = {
          // Basic information
          leadName: cleaningResult.cleanedData.leadName || "",
          contact: cleaningResult.cleanedData.contact || "",
          emailId: cleaningResult.cleanedData.emailId || "",
          
          // Course information
          course: cleaningResult.cleanedData.course || "",
          courseDuration: cleaningResult.cleanedData.courseDuration || "",
          education: cleaningResult.cleanedData.education || "",
          
          // Lead management
          source: cleaningResult.cleanedData.source || "",
          status: cleaningResult.cleanedData.status || "Not Contacted",
          counselorName: cleaningResult.cleanedData.counselorName || "",
          
          // Location
          cityArea: cleaningResult.cleanedData.cityArea || "",
          
          // Dates
          enquiryDate: cleaningResult.cleanedData.enquiryDate || new Date(),
          contactedDate: cleaningResult.cleanedData.contactedDate || null,
          nextFollowUpDate: cleaningResult.cleanedData.nextFollowUpDate || cleaningResult.cleanedData.followUpDate || null,
          followUpDate: cleaningResult.cleanedData.followUpDate || cleaningResult.cleanedData.nextFollowUpDate || null,
          followUpNotificationDone: (cleaningResult.cleanedData.nextFollowUpDate || cleaningResult.cleanedData.followUpDate) ? false : (lead?.followUpNotificationDone ?? false),
          followUpDoneAt: (cleaningResult.cleanedData.nextFollowUpDate || cleaningResult.cleanedData.followUpDate) ? null : (lead?.followUpDoneAt || null),
          
          // Remarks and notes
          remark: cleaningResult.cleanedData.remark || "",
          feedbackCallRemarks: cleaningResult.cleanedData.feedbackCallRemarks || "",
          centreHeadRemarks: cleaningResult.cleanedData.centreHeadRemarks || "",
          finalRemark: cleaningResult.cleanedData.finalRemark || "",
          
          // Metadata with user context
          createdAt: cleaningResult.cleanedData.createdAt || new Date(),
          updatedAt: cleaningResult.cleanedData.updatedAt || new Date(),
          createdBy: userProfile?.uid || 'unknown',
          updatedBy: userProfile?.uid || 'unknown',
          centreId: userProfile?.centreId || 'unknown',
          userRole: userProfile?.role || 'unknown'
        };

        // NestJS CRM API path (feature-flagged)
        if (isNestLeadsEnabled()) {
          const wantsConvert = leadData.status === 'Admission Done';

          if (mode === 'create') {
            const created = await nestLeadsApi.create(
              buildNestCreatePayload({
                name: leadData.leadName,
                phone: leadData.contact,
                email: leadData.emailId,
                source: leadData.source,
                status: wantsConvert ? 'Hot Lead' : leadData.status,
                notes: leadData.remark,
                nextFollowUpDate: leadData.nextFollowUpDate,
                centreId: userProfile?.centreId,
                courseInterestId:
                  typeof lead?.courseInterestId === 'string'
                    ? lead.courseInterestId
                    : undefined,
              }),
            );

            let finalLead = created;
            if (wantsConvert) {
              await nestLeadsApi.convert(created.id, {
                firstName: created.firstName,
                lastName: created.lastName ?? undefined,
                phone: created.phone,
                email: created.email ?? undefined,
              });
              finalLead = await nestLeadsApi.get(created.id);
            }

            const ui = mapNestLeadToUi(finalLead as Parameters<typeof mapNestLeadToUi>[0]);
            await centreDataStore.refresh();
            return {
              id: ui.id,
              leadName: ui.leadName,
              contact: ui.contact,
              emailId: ui.emailId,
              course: ui.course,
              source: ui.source,
              status: ui.status,
              counselorName: ui.counselorName,
              remark: ui.remark,
              followUpDate: ui.followUpDate,
              cleaningResult,
              nestBacked: true,
              rollNo: wantsConvert ? (finalLead as { rollNo?: string }).rollNo : undefined,
            };
          }

          if (lead?.id && isNestBackedLead(lead)) {
            const updated = await nestLeadsApi.update(
              lead.id,
              buildNestUpdatePayload({
                name: leadData.leadName,
                phone: leadData.contact,
                email: leadData.emailId,
                source: leadData.source,
                notes: leadData.remark,
                nextFollowUpDate: leadData.nextFollowUpDate,
                version: typeof lead.version === 'number' ? lead.version : undefined,
              }),
            );

            let finalLead = updated;
            if (wantsConvert && lead.status !== 'Admission Done') {
              await nestLeadsApi.convert(lead.id, {
                firstName: updated.firstName,
                lastName: updated.lastName ?? undefined,
                phone: updated.phone,
                email: updated.email ?? undefined,
              });
              finalLead = await nestLeadsApi.get(lead.id);
            } else if (
              !wantsConvert &&
              leadData.status &&
              leadData.status !== lead.status
            ) {
              const nestStatus = mapUiStatusToNest(leadData.status);
              if (nestStatus !== 'converted') {
                finalLead = await nestLeadsApi.changeStatus(lead.id, {
                  status: nestStatus,
                  lostReason:
                    nestStatus === 'lost'
                      ? leadData.remark || 'Marked not interested'
                      : undefined,
                });
              }
            }

            const ui = mapNestLeadToUi(finalLead as Parameters<typeof mapNestLeadToUi>[0]);
            await centreDataStore.refresh();
            return {
              id: ui.id,
              leadName: ui.leadName,
              contact: ui.contact,
              emailId: ui.emailId,
              course: ui.course,
              source: ui.source,
              status: ui.status,
              counselorName: ui.counselorName,
              remark: ui.remark,
              followUpDate: ui.followUpDate,
              cleaningResult,
              nestBacked: true,
            };
          }

          throw new Error('Cannot update lead via Nest: missing Nest-backed lead ID');
        }

        if (mode === "create") {
          const leadsSnapshot = await getDocs(collection(db, 'leads'));
          const nextSrNo = getNextSerialNumberFromItems(
            leadsSnapshot.docs.map((d) => ({ ...d.data(), id: d.id }))
          );
          const docRef = await addDoc(collection(db, 'leads'), { ...leadData, srNo: nextSrNo });
          return { id: docRef.id, ...leadData, srNo: nextSrNo, cleaningResult };
        } else if (lead?.id) {
          if (isWebsiteEnquiryLead(lead)) {
            const enquiryId = getEnquiryDocumentId(lead);
            const leadsSnapshot = await getDocs(collection(db, 'leads'));
            const nextSrNo = getNextSerialNumberFromItems(
              leadsSnapshot.docs.map((d) => ({ ...d.data(), id: d.id }))
            );
            const docRef = await addDoc(collection(db, 'leads'), {
              ...leadData,
              srNo: nextSrNo,
              source: leadData.source || 'Website Inquiry',
              migratedFromEnquiryId: enquiryId,
            });
            await deleteDoc(doc(db, 'enquiries', enquiryId));
            return {
              id: docRef.id,
              ...leadData,
              srNo: nextSrNo,
              cleaningResult,
              promotedFromEnquiry: true,
              previousEnquiryId: lead.id,
            };
          }

          const leadRef = getLeadDocRef(db, lead.id, lead);
          const updateData = {
            ...leadData,
            updatedBy: userProfile?.uid || 'unknown',
            updatedAt: new Date()
          };
          await updateDoc(leadRef, updateData);
          return { id: lead.id, ...leadData, cleaningResult };
        } else if (mode === "edit") {
          throw new Error("Cannot update lead: missing lead ID");
        }
        throw new Error("Failed to save lead");
      } catch (error) {
        console.error('Error saving lead:', error);
        throw error instanceof Error ? error : new Error('Failed to save lead');
      }
    },
    onSuccess: async (data: any) => {
      try {
        const leadId = data?.id;
        // Get the cleaned status from the mutation result
        const cleaningResult = data.cleaningResult;
        const finalStatus = cleaningResult?.cleanedData?.status || data.status || '';
        const isConverted = finalStatus === "Admission Done";
        
        // Nest convert already created the student server-side
        if (isConverted && leadId && data?.nestBacked) {
          toast({
            title: "Lead Converted",
            description: data.rollNo
              ? `Student created with roll no ${data.rollNo}`
              : `Lead status updated to ${finalStatus}`,
          });
        } else if (isConverted && leadId) {
          try {
            // Check if student already exists for this lead
            const studentsQuery = query(
              collection(db, 'students'),
              where('leadId', '==', leadId)
            );
            const existingStudents = await getDocs(studentsQuery);
            
            if (existingStudents.empty) {
              // Get the next SR number
              const studentsSnapshot = await getDocs(collection(db, 'students'));
              const nextSrNo = getNextSerialNumberFromItems(
                studentsSnapshot.docs.map((d) => ({ ...d.data(), id: d.id }))
              );
              
              // Map lead data to student data
              const studentData: any = {
                srNo: nextSrNo,
                firstName: data.leadName || data.name || '',
                lastName: '',
                email: data.emailId || data.email || '',
                phone: data.contact || data.phone || '',
                course: data.course || data.interestedCourse || '',
                courseDuration: data.courseDuration ? parseFloat(data.courseDuration.toString()) : null,
                education: data.education || '',
                admissionDate: new Date(),
                admissionMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
                status: 'active',
                centreId: userProfile?.centreId || 'unknown',
                leadId: leadId, // Link student to lead
                source: data.source || '',
                cityArea: data.cityArea || '',
                remarks: data.remark || data.notes || '',
                assignedTo: data.counselorName || data.assignedTo || '',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: userProfile?.uid || 'unknown',
                updatedBy: userProfile?.uid || 'unknown'
              };
              
              // Create student
              const studentId = await firebaseHelpers.saveStudent(studentData);
              
              if (studentId) {
                // Update lead with studentId and convertedAt
                const leadRef = getLeadDocRef(db, leadId);
                await updateDoc(leadRef, {
                  studentId: studentId,
                  convertedAt: new Date(),
                  admissionDate: new Date()
                });
                
                toast({
                  title: "✅ Lead Converted & Student Created",
                  description: `Lead status updated to ${finalStatus} and student entry created successfully!`,
                  variant: "default",
                });
              } else {
                throw new Error('Failed to create student');
              }
            } else {
              // Student already exists, just update the lead
              const leadRef = getLeadDocRef(db, leadId);
              await updateDoc(leadRef, {
                convertedAt: new Date(),
                admissionDate: new Date()
              });
              
              toast({
                title: "✅ Lead Converted",
                description: `Lead status updated to ${finalStatus}. Student entry already exists.`,
                variant: "default",
              });
            }
          } catch (studentError: any) {
            console.error('Error creating student from converted lead:', studentError);
            toast({
              title: "⚠️ Status Updated with Warning",
              description: `Lead status updated to ${finalStatus}, but student creation failed: ${studentError.message}`,
              variant: "default",
            });
          }
        } else {
          // Create or update reminder if follow-up date is set
          if (data.followUpDate) {
            if (mode === "create") {
              await reminderService.createReminderFromLead(data, 'followup');
            } else {
              // For edit mode, try to find existing reminder and update it
              await reminderService.updateReminderFromLead(data);
            }
          }
          
          toast({
            title: "Success",
            description: data.promotedFromEnquiry
              ? "Website enquiry converted to a full lead and saved successfully"
              : `Lead ${mode === "create" ? "created" : "updated"} successfully${data.followUpDate ? ' with reminder' : ''}`,
          });
        }
      } catch (reminderError) {
        console.error('Error in onSuccess handler:', reminderError);
        toast({
          title: "Success with Warning",
          description: `Lead ${mode === "create" ? "created" : "updated"} successfully, but some operations failed`,
          variant: "default",
        });
      }
      
      // Reset form and all states before closing
      const defaultValues = {
        name: "",
        email: "",
        phone: "",
        centreId: userProfile?.centreId || "",
        interestedCourse: "",
        source: "",
        status: "Not Contacted",
        assignedTo: "Tayyaba",
        notes: "",
        courseDuration: "",
        education: "",
        cityArea: "",
        enquiryDate: "",
        contactedDate: "",
        nextFollowUpDate: "",
        followUpDate: "",
        feedbackCallRemarks: "",
        centreHeadRemarks: "",
        finalRemark: ""
      };
      // Reset all form states
      form.reset(defaultValues);
      setShowCustomEducationInput(false);
      setCustomEducationName("");
      setShowCustomSourceInput(false);
      setCustomSourceName("");
      setShowCustomCourseInput(false);
      setCustomCourseName("");
      
      // Close dialog after reset
      setTimeout(() => {
        onOpenChange(false);
      }, 100);
      
      // Trigger comprehensive data refresh events for all components
      if (typeof window !== 'undefined') {
        const leadId = data?.id;
        const previousEnquiryId = data?.previousEnquiryId as string | undefined;
        
        // Dispatch lead data updated event with all field changes
        // Map form fields to database field names
        const updates = mode === 'edit' ? {
          leadName: data.leadName || '',
          contact: data.contact || '',
          emailId: data.emailId || '',
          course: data.course || '',
          source: data.source || '',
          status: data.status || '',
          counselorName: data.counselorName || '',
          remark: data.remark || '',
          cityArea: data.cityArea || '',
          enquiryDate: data.enquiryDate || null,
          contactedDate: data.contactedDate || null,
          nextFollowUpDate: data.nextFollowUpDate || data.followUpDate || null,
          followUpDate: data.followUpDate || null,
          followUpNotificationDone: data.followUpDate ? false : (lead?.followUpNotificationDone ?? false),
          followUpDoneAt: data.followUpDate ? null : (lead?.followUpDoneAt || null),
          courseDuration: data.courseDuration || '',
          education: data.education || '',
          feedbackCallRemarks: data.feedbackCallRemarks || '',
          centreHeadRemarks: data.centreHeadRemarks || '',
          finalRemark: data.finalRemark || '',
          updatedAt: new Date(),
          updatedBy: userProfile?.uid || 'unknown'
        } : {};
        
        window.dispatchEvent(new CustomEvent('leadDataUpdated', {
          detail: {
            leadId,
            action: mode,
            timestamp: Date.now(),
            data: data,
            updates: updates,
            source: 'lead_form',
            preventRefresh: true,
            preventCascade: true,
          }
        }));

        // Dispatch status update if status changed
        if (data.status) {
          window.dispatchEvent(new CustomEvent('statusUpdated', {
            detail: {
              leadId,
              newStatus: data.status,
              timestamp: Date.now(),
              source: 'lead_form',
              preventRefresh: false
            }
          }));
        }

        // Dispatch analytics update
        window.dispatchEvent(new CustomEvent('analyticsDataUpdated', {
          detail: {
            source: mode === 'edit' ? 'lead_edit' : 'lead_create',
            timestamp: Date.now(),
            leadId,
            updates: mode === 'edit' ? data : {},
            preventRefresh: false
          }
        }));

        // Dispatch calendar update if dates changed
        if (data.followUpDate || data.visitDate || data.callDate || data.admissionDate) {
          window.dispatchEvent(new CustomEvent('calendarDataUpdated', {
            detail: {
              leadId,
              followUpDate: data.followUpDate,
              visitDate: data.visitDate,
              callDate: data.callDate,
              admissionDate: data.admissionDate,
              timestamp: Date.now(),
              source: 'lead_form',
              preventRefresh: false
            }
          }));
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} lead`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: LeadFormData) => {
    // Clear saved form data on successful submission
    clearFormData();
    mutation.mutate(data);
  };

  // Auto-save form data when form values change (debounced)
  useEffect(() => {
    if (!open || mode !== 'create') return;
    
    let timeoutId: NodeJS.Timeout;
    
    const subscription = form.watch((value) => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Set new timeout
      timeoutId = setTimeout(() => {
        saveFormData(value);
      }, 1000); // Save after 1 second of no changes
    });
    
    return () => {
      subscription.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [open, mode, saveFormData]); // Add saveFormData to dependencies

  // Initialize reminder service when form opens
  useEffect(() => {
    if (open && userProfile?.centreId) {
      // Initialize reminder service
      if (!reminderService.getStatus().isInitialized) {
        reminderService.init(userProfile.centreId);
      }
      
      // Fetch reminders when form opens in edit mode
      if (mode === 'edit' && lead?.id) {
        fetchReminders();
      }
    }
  }, [open, userProfile?.centreId, mode, lead?.id]);

  // Update reminder leadId when lead is created
  useEffect(() => {
    if (lead?.id && reminders.length > 0) {
      // Update any reminders with temp leadId
      const updatePromises = reminders.map(async (reminder) => {
        if (reminder.leadId === 'temp') {
          try {
            await reminderService.updateReminder(reminder.id, { 
              leadId: lead.id,
              leadName: form.getValues('name') || reminder.leadName,
              leadPhone: form.getValues('phone') || reminder.leadPhone,
              leadEmail: form.getValues('email') || reminder.leadEmail
            });
            
            // Update the reminder in local state
            setReminders(prev => prev.map(r => 
              r.id === reminder.id 
                ? { ...r, leadId: lead.id, leadName: form.getValues('name') || r.leadName, leadPhone: form.getValues('phone') || r.leadPhone, leadEmail: form.getValues('email') || r.leadEmail }
                : r
            ));
            
          } catch (error) {
            console.error('Error updating reminder leadId:', error);
          }
        }
      });
      
      // Wait for all updates to complete
      Promise.all(updatePromises).then(() => {
      });
    }
  }, [lead?.id, reminders.length]);

  // Clear saved data when form is closed
  useEffect(() => {
    if (!open) {
      // Reset all custom input states when dialog closes
      setShowCustomEducationInput(false);
      setCustomEducationName("");
      setShowCustomSourceInput(false);
      setCustomSourceName("");
      setShowCustomCourseInput(false);
      setCustomCourseName("");
      setShowCustomAssigneeInput(false);
      setCustomAssigneeName("");
      setShowCustomCityAreaInput(false);
      setCustomCityAreaName("");
      setCityAreaOpen(false);
      setCourseOpen(false);
      setCityAreaOpen(false);
      setShowCustomStatusInput(false);
      setCustomStatusName("");
      
      // Don't clear immediately, give user a chance to reopen
      const timeoutId = setTimeout(() => {
        clearFormData();
      }, 5000); // Clear after 5 seconds of being closed
      
      return () => clearTimeout(timeoutId);
    }
  }, [open, clearFormData]);

  // Save form data when page becomes hidden (user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && open && mode === 'create') {
        const currentData = form.getValues();
        saveFormData(currentData);
      }
    };

    const handleBeforeUnload = () => {
      if (open && mode === 'create') {
        const currentData = form.getValues();
        saveFormData(currentData);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [open, mode, saveFormData]); // Add saveFormData to dependencies

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-0 shadow-2xl">
        <DialogHeader className="pb-6 border-b border-gray-200/50">
          <DialogTitle className="flex items-center gap-4 text-3xl font-bold text-gray-900">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl shadow-lg">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {mode === "create" ? "Add New Lead" : "Edit Lead"}
              </div>
              <div className="text-sm text-gray-600 font-normal mt-1">
                {mode === "create" ? "Create a new lead entry" : "Update lead information"}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Fill in the lead details below. Required fields are marked with an asterisk (*).

          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(
          (data) => { onSubmit(data); },
          (errors) => {
            const firstErrorKey = Object.keys(errors)[0];
            setTimeout(() => {
              const el = document.querySelector(`[data-field="${firstErrorKey}"]`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          }
        )} className="space-y-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2" data-field="name">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="name" 
                    {...form.register("name")} 
                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    placeholder="Enter full name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2" data-field="phone">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                    Contact Number <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="phone" 
                    {...form.register("phone")} 
                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    placeholder="Enter phone number"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2" data-field="email">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    {...form.register("email")} 
                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    placeholder="Enter email address"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Course Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <GraduationCap className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Course Information</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2" data-field="interestedCourse">
                  <Label htmlFor="interestedCourse" className="text-sm font-medium text-gray-700">
                    Interested Course <span className="text-red-500">*</span>
                  </Label>
                  <input type="hidden" {...form.register("interestedCourse")} />
                  <Popover open={courseOpen} onOpenChange={setCourseOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative w-full cursor-text" onClick={() => setCourseOpen(true)}>
                        <Input
                          id="interestedCourse"
                          type="text"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={courseOpen}
                          value={form.watch("interestedCourse") || ""}
                          onChange={(e) => {
                            form.setValue("interestedCourse", e.target.value, { shouldDirty: true, shouldValidate: true });
                            setShowCustomCourseInput(false);
                            setCourseOpen(true);
                          }}
                          onFocus={() => setCourseOpen(true)}
                          placeholder="Search or select course..."
                          className="h-12 pr-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                        />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0 z-[200] bg-popover border shadow-lg"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <ScrollArea className="h-[280px] w-full" onWheel={(e) => e.stopPropagation()}>
                        <div className="p-1">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2.5 text-sm text-blue-600 font-medium hover:bg-accent hover:text-blue-700 focus:bg-accent focus:text-blue-700 outline-none rounded-sm"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              handleCourseSelection("Others");
                              setCourseOpen(false);
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              handleCourseSelection("Others");
                              setCourseOpen(false);
                            }}
                          >
                            + Add Other Course
                          </button>
                          {(() => {
                            const query = (form.watch("interestedCourse") || "").trim().toLowerCase();
                            const baseList = lead?.course && !courses.includes(lead.course as any)
                              ? [lead.course, ...courses]
                              : courses;
                            const filtered = query
                              ? baseList.filter((course) => course.toLowerCase().includes(query))
                              : baseList;
                            if (filtered.length === 0) {
                              return (
                                <div className="py-6 text-center text-sm text-muted-foreground px-3">
                                  No course found.
                                </div>
                              );
                            }
                            return filtered.map((course, index) => (
                              <button
                                key={`course-option-${index}-${course}`}
                                type="button"
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none rounded-sm"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  handleCourseSelection(course);
                                  setCourseOpen(false);
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleCourseSelection(course);
                                  setCourseOpen(false);
                                }}
                              >
                                {course}
                              </button>
                            ));
                          })()}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Custom Course Input */}
                  {showCustomCourseInput && (
                    <div className="space-y-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Label htmlFor="customCourse" className="text-sm font-medium text-gray-700">
                        Enter Course Name
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="customCourse"
                          value={customCourseName}
                          onChange={(e) => setCustomCourseName(e.target.value)}
                          placeholder="Enter course name..."
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomCourse();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddCustomCourse}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!customCourseName.trim()}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCustomCourseInput(false);
                            setCustomCourseName("");
                            form.setValue("interestedCourse", "");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {form.formState.errors.interestedCourse && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {form.formState.errors.interestedCourse.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="courseDuration" className="text-sm font-medium text-gray-700">Course Duration (Months)</Label>
                  {(() => {
                    const currentDuration = normalizeDurationValue(form.watch("courseDuration"));
                    const isCustomDuration =
                      currentDuration !== "" && !isPresetCourseDuration(currentDuration);
                    const durationSelectValue = isPresetCourseDuration(currentDuration)
                      ? currentDuration
                      : isCustomDuration || showCustomDurationInput
                        ? "Other"
                        : "";

                    return (
                      <>
                        <Select value={durationSelectValue} onValueChange={handleDurationSelection}>
                          <SelectTrigger
                            id="courseDuration"
                            className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                          >
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRESET_COURSE_DURATIONS.map((duration) => (
                              <SelectItem key={duration} value={duration}>
                                {formatDurationLabel(duration)}
                              </SelectItem>
                            ))}
                            <SelectItem value="Other" className="text-blue-600 font-medium">
                              + Add Other
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {(showCustomDurationInput || isCustomDuration) && (
                          <div className="space-y-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <Label htmlFor="customCourseDuration" className="text-sm font-medium text-gray-700">
                              Enter duration in months
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="customCourseDuration"
                                type="text"
                                inputMode="decimal"
                                value={currentDuration}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9.]/g, "");
                                  form.setValue("courseDuration", v);
                                }}
                                placeholder="e.g. 18, 24, 30"
                                className="flex-1 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setShowCustomDurationInput(false);
                                  form.setValue("courseDuration", "");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="education" className="text-sm font-medium text-gray-700">Education</Label>
                  <Select
                    value={showCustomEducationInput ? "Other (please specify)" : (form.watch("education")?.toString() || "")}
                    onValueChange={(value) => {
                      if (value === "Other (please specify)") {
                        setShowCustomEducationInput(true);
                        if (!customEducationName) {
                          form.setValue("education", "");
                        }
                      } else {
                        setShowCustomEducationInput(false);
                        setCustomEducationName("");
                        form.setValue("education", value);
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                      <SelectValue placeholder="Select education" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Below 10th">Below 10th</SelectItem>
                      <SelectItem value="10th / Secondary School">10th / Secondary School</SelectItem>
                      <SelectItem value="12th / Higher Secondary">12th / Higher Secondary</SelectItem>
                      <SelectItem value="Diploma">Diploma</SelectItem>
                      <SelectItem value="Undergraduate (UG)">Undergraduate (UG)</SelectItem>
                      <SelectItem value="Postgraduate (PG)">Postgraduate (PG)</SelectItem>
                      <SelectItem value="Doctorate (PhD)">Doctorate (PhD)</SelectItem>
                      <SelectItem value="Working">Working</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Other (please specify)">Other (please specify)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Custom Education Input */}
                  {showCustomEducationInput && (
                    <div className="space-y-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Label htmlFor="customEducation" className="text-sm font-medium text-gray-700">
                        Please specify education
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="customEducation"
                          value={customEducationName}
                          onChange={(e) => {
                            setCustomEducationName(e.target.value);
                            form.setValue("education", e.target.value);
                          }}
                          className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                          placeholder="Enter education details"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCustomEducationInput(false);
                            setCustomEducationName("");
                            form.setValue("education", "");
                          }}
                          className="h-12"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Lead Management */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Lead Management</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2" data-field="source">
                  <Label htmlFor="source" className="text-sm font-medium text-gray-700">
                    Source <span className="text-red-500">*</span>
                  </Label>
                  <input type="hidden" {...form.register("source")} />
                  <Select
                    value={form.watch("source")}
                    onValueChange={handleSourceSelection}
                  >
                    <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                      <SelectItem value="Add Other Source" className="text-blue-600 font-medium">
                        + Add Other Source
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Custom Source Input */}
                  {showCustomSourceInput && (
                    <div className="space-y-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Label htmlFor="customSource" className="text-sm font-medium text-gray-700">
                        Enter Source Name
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="customSource"
                          value={customSourceName}
                          onChange={(e) => setCustomSourceName(e.target.value)}
                          placeholder="Enter source name..."
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomSource();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddCustomSource}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!customSourceName.trim()}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCustomSourceInput(false);
                            setCustomSourceName("");
                            form.setValue("source", "");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {form.formState.errors.source && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {form.formState.errors.source.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2" data-field="status">
                  <Label htmlFor="status" className="text-sm font-medium text-gray-700">
                    Status <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.watch("status") || ""}
                    onValueChange={handleStatusSelection}
                  >
                    <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusList.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          className={status === "Other" ? "text-blue-600 font-medium" : ""}
                        >
                          {status === "Other" ? "+ Add Other" : status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showCustomStatusInput && (
                    <div className="space-y-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Label htmlFor="customStatus" className="text-sm font-medium text-gray-700">
                        Enter status
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="customStatus"
                          value={customStatusName}
                          onChange={(e) => setCustomStatusName(e.target.value)}
                          placeholder="Enter status..."
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomStatus();
                            }
                          }}
                        />
                        <Button type="button" onClick={handleAddCustomStatus} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!customStatusName.trim()}>
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCustomStatusInput(false);
                            setCustomStatusName("");
                            form.setValue("status", "");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {form.formState.errors.status && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {form.formState.errors.status.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2" data-field="assignedTo">
                  <Label htmlFor="assignedTo" className="text-sm font-medium text-gray-700">Assigned To</Label>
                  <Select
                    value={form.watch("assignedTo") || ""}
                    onValueChange={handleAssigneeSelection}
                  >
                    <SelectTrigger className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {assigneesList.map((name) => (
                        <SelectItem
                          key={name}
                          value={name}
                          className={name === "Other" ? "text-blue-600 font-medium" : ""}
                        >
                          {name === "Other" ? "+ Add Other" : name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showCustomAssigneeInput && (
                    <div className="space-y-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Label htmlFor="customAssignee" className="text-sm font-medium text-gray-700">
                        Enter assignee name
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="customAssignee"
                          value={customAssigneeName}
                          onChange={(e) => setCustomAssigneeName(e.target.value)}
                          placeholder="Enter name..."
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomAssignee();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddCustomAssignee}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!customAssigneeName.trim()}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCustomAssigneeInput(false);
                            setCustomAssigneeName("");
                            form.setValue("assignedTo", "");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enquiryDate" className="text-sm font-medium text-gray-700">Enquiry Date</Label>
                  <Input 
                    id="enquiryDate" 
                    type="date" 
                    {...form.register("enquiryDate")} 
                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactedDate" className="text-sm font-medium text-gray-700">Contacted Date</Label>
                  <Input 
                    id="contactedDate" 
                    type="date" 
                    {...form.register("contactedDate")} 
                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextFollowUpDate" className="text-sm font-medium text-gray-700">Next Follow-up Date</Label>
                  <Input
                    id="nextFollowUpDate"
                    type="date"
                    {...form.register("nextFollowUpDate")}
                    className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2" data-field="cityArea">
                  <Label htmlFor="cityArea" className="text-sm font-medium text-gray-700">City/Area</Label>
                  <Popover open={cityAreaOpen} onOpenChange={setCityAreaOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative w-full cursor-text" onClick={() => setCityAreaOpen(true)}>
                        <Input
                          id="cityArea"
                          type="text"
                          autoComplete="nope"
                          data-1p-ignore
                          data-lpignore="true"
                          data-form-type="other"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={cityAreaOpen}
                          value={form.watch("cityArea") || ""}
                          onChange={(e) => {
                            form.setValue("cityArea", e.target.value);
                            setCityAreaOpen(true);
                          }}
                          onFocus={() => setCityAreaOpen(true)}
                          placeholder="Search or select district..."
                          className="h-12 pr-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                        />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0 z-[200] bg-popover border shadow-lg"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <ScrollArea
                        className="h-[280px] w-full"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <div className="p-1">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2.5 text-sm text-blue-600 font-medium hover:bg-accent hover:text-blue-700 focus:bg-accent focus:text-blue-700 outline-none rounded-sm"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              setShowCustomCityAreaInput(true);
                              setCityAreaOpen(false);
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              setShowCustomCityAreaInput(true);
                              setCityAreaOpen(false);
                            }}
                          >
                            + Add Other
                          </button>
                          {(() => {
                            const query = (form.watch("cityArea") || "").trim().toLowerCase();
                            const filtered = query
                              ? cityAreaOptions.filter((d) => d.toLowerCase().includes(query))
                              : cityAreaOptions;
                            if (filtered.length === 0) {
                              return (
                                <div className="py-6 text-center text-sm text-muted-foreground px-3">
                                  No district found. Use + Add Other to enter a custom city/area.
                                </div>
                              );
                            }
                            return filtered.map((district) => (
                              <button
                                key={district}
                                type="button"
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none rounded-sm"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  form.setValue("cityArea", district);
                                  setShowCustomCityAreaInput(false);
                                  setCityAreaOpen(false);
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  form.setValue("cityArea", district);
                                  setShowCustomCityAreaInput(false);
                                  setCityAreaOpen(false);
                                }}
                              >
                                {district}
                              </button>
                            ));
                          })()}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {showCustomCityAreaInput && (
                    <div className="space-y-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Label htmlFor="customCityArea" className="text-sm font-medium text-gray-700">
                        Enter city / area
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="customCityArea"
                          value={customCityAreaName}
                          onChange={(e) => setCustomCityAreaName(e.target.value)}
                          placeholder="Enter city or area name..."
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomCityArea();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddCustomCityArea}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!customCityAreaName.trim()}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCustomCityAreaInput(false);
                            setCustomCityAreaName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedbackCallRemarks" className="text-sm font-medium text-gray-700">Feedback Call Remarks</Label>
                  <Textarea 
                    id="feedbackCallRemarks" 
                    {...form.register("feedbackCallRemarks")} 
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    placeholder="Call feedback and remarks..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="finalRemark" className="text-sm font-medium text-gray-700">Final Remark</Label>
                  <Textarea 
                    id="finalRemark" 
                    {...form.register("finalRemark")} 
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    placeholder="Final remark..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>



          {/* Form Actions */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200/50">
            <div className="flex space-x-3">
              {hasDraftData && mode === "create" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearFormData();
                    form.reset();
                    setShowCustomEducationInput(false);
                    setCustomEducationName("");
                    toast({
                      title: "Draft Cleared",
                      description: "Draft data has been cleared. Form is now empty.",
                    });
                  }}
                  className="h-10 px-4 rounded-lg border-orange-200 text-orange-600 hover:bg-orange-50"
                >
                  Clear Draft
                </Button>
              )}
            </div>
            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
                className="h-12 px-6 rounded-xl border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="h-12 px-8 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {mode === "create" ? "Creating..." : "Updating..."}
                  </>
                ) : (
                  <>
                    {mode === "create" ? "Create Lead" : "Update Lead"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Reminder Form Dialog */}
        <Dialog open={showReminderForm} onOpenChange={setShowReminderForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-600" />
                {editingReminder ? 'Edit Reminder' : 'Create New Reminder'}
              </DialogTitle>
              <DialogDescription>
                {editingReminder ? 'Update the reminder details' : 'Add a new reminder for this lead'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reminder-title" className="text-sm font-medium text-gray-700">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reminder-title"
                    value={reminderFormData.title}
                    onChange={(e) => setReminderFormData({...reminderFormData, title: e.target.value})}
                    placeholder="Reminder title"
                    className="h-10"
                    maxLength={100}
                  />
                  {reminderFormData.title.length > 80 && (
                    <p className="text-xs text-gray-500 mt-1">{reminderFormData.title.length}/100 characters</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="reminder-type" className="text-sm font-medium text-gray-700">Type</Label>
                  <Select 
                    value={reminderFormData.type} 
                    onValueChange={(value) => setReminderFormData({...reminderFormData, type: value})}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="admission">Admission</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="reminder-description" className="text-sm font-medium text-gray-700">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reminder-description"
                  value={reminderFormData.description}
                  onChange={(e) => setReminderFormData({...reminderFormData, description: e.target.value})}
                  placeholder="Reminder description"
                  rows={3}
                  maxLength={500}
                />
                {reminderFormData.description.length > 400 && (
                  <p className="text-xs text-gray-500 mt-1">{reminderFormData.description.length}/500 characters</p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reminder-dueDate" className="text-sm font-medium text-gray-700">
                    Due Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reminder-dueDate"
                    type="date"
                    value={reminderFormData.dueDate}
                    onChange={(e) => setReminderFormData({...reminderFormData, dueDate: e.target.value})}
                    className="h-10"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {reminderFormData.dueDate && new Date(reminderFormData.dueDate) < new Date() && (
                    <p className="text-xs text-red-500 mt-1">Due date cannot be in the past</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="reminder-priority" className="text-sm font-medium text-gray-700">Priority</Label>
                  <Select 
                    value={reminderFormData.priority} 
                    onValueChange={(value) => setReminderFormData({...reminderFormData, priority: value})}
                  >
                    <SelectTrigger className="h-10">
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
              
              <div>
                <Label htmlFor="reminder-notes" className="text-sm font-medium text-gray-700">Notes</Label>
                <Textarea
                  id="reminder-notes"
                  value={reminderFormData.notes}
                  onChange={(e) => setReminderFormData({...reminderFormData, notes: e.target.value})}
                  placeholder="Additional notes"
                  rows={2}
                  maxLength={200}
                />
                {reminderFormData.notes.length > 150 && (
                  <p className="text-xs text-gray-500 mt-1">{reminderFormData.notes.length}/200 characters</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReminderForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={editingReminder ? updateReminder : createReminder}
                disabled={
                  !reminderFormData.title.trim() || 
                  !reminderFormData.description.trim() || 
                  !reminderFormData.dueDate ||
                  new Date(reminderFormData.dueDate) < new Date()
                }
                className="bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {editingReminder ? 'Update Reminder' : 'Create Reminder'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}