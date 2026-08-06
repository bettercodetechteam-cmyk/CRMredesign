import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {  Table, TableBody, TableCell, TableHead, TableHeader, TableRow  } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import {
  assignContiguousSerialsToOrderedList,
  getNextSerialNumberFromItems,
} from "@/lib/serialNumberUtils";

const STUDENT_DATE_SORT = { key: "admissionDate" as const, direction: "desc" as const };
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import StudentForm from "@/components/StudentForm";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { firebaseHelpers } from "@/lib/firebaseHelpers";
import Loading, { InlineLoading } from "@/components/ui/loading";
import { 
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Upload,
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  RefreshCw,
  Printer,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Bell,
  AlertCircle,
  GraduationCap,
  UserPlus,
  BookOpen,
  School,
  Building2,
  PlayCircle,
  CheckCircle2,
  Tag,
  Award
} from "lucide-react";
import { 
  formatDate, 
  formatDateCompact, 
  formatDateForInput, 
  formatDateTime, 
  parseExcelDate,
  toDateObject,
  isValidDate,
  getRelativeTime,
  getMonthYear,
  getDayOfWeek
} from "@/utils/dateUtils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { cn } from "@/lib/utils";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AnalyticsCategoryBarChart,
  AnalyticsStackedBarChart,
} from "@/components/charts/AnalyticsCharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper to convert Excel serial date to JS date string
function excelDateToJSDate(serial: number) {
  if (!serial || isNaN(serial)) return serial;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  if (date_info.getFullYear() < 1970) return serial;
  return date_info.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Helper to trim string values
function cleanValue(val: any) {
  return typeof val === 'string' ? val.trim() : val;
}

// Using standardized date formatting from dateUtils

// Helper to safely render any value
const safeRender = (value: any) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  // Handle Firestore Timestamp
  if (value && typeof value === 'object' && value.toDate) {
    return formatDate(value);
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return formatDate(value);
  }
  
  // Handle other objects
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  // Handle strings, numbers, booleans
  const stringValue = String(value).trim();
  
  if (stringValue === '-' || stringValue === 'N/A' || stringValue === 'null') {
    return '';
  }
  
  return stringValue;
};

// Using standardized Excel date parsing from dateUtils

// Using standardized date input formatting from dateUtils

// Helper to safely convert numeric values to strings for form inputs
const formatNumericForInput = (value: any) => {
  if (value === null || value === undefined || value === '') return '';
  
  // If it's already a string, return as is
  if (typeof value === 'string') return value;
  
  // If it's a number, convert to string
  if (typeof value === 'number') return value.toString();
  
  // For other types, try to convert to string
  try {
    return String(value);
  } catch (error) {
    console.error('Error converting value to string:', error, value);
    return '';
  }
};

export default function Students() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [deletedStudentName, setDeletedStudentName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  // Debounce search term to reduce re-renders and prepare for server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Test Firebase connection on component mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const isConnected = await firebaseHelpers.checkConnection();
        console.log('🔌 Firebase connection status:', isConnected);
      } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
      }
    };
    testConnection();
  }, []);

  // Check for pre-filled data from other pages (e.g., Lead conversion)
  useEffect(() => {
    if (location.state?.prefillData) {
      console.log('📝 Received prefill data:', location.state.prefillData);
      const prefill = location.state.prefillData;
      
      // Construct a new student object with these defaults
      // The StudentForm component will handle the partial data
      const newStudentData = {
        firstName: prefill.firstName || '',
        lastName: '', // Leave empty for user to fill or split if needed
        email: prefill.email || '',
        phone: prefill.phone || '',
        course: prefill.course || '',
        source: prefill.source || '',
        city: prefill.city || '',
        admissionDate: prefill.admissionDate ? formatDateForInput(prefill.admissionDate) : formatDateForInput(new Date()),
        status: 'active',
        // Default empty values for required fields
        actualFees: '',
        feesPaid: '',
        srNo: '',
        // Add other fields as necessary
      };
      
      setSelectedStudent(newStudentData);
      setFormMode("create");
      setIsFormOpen(true);
      
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
      
      toast({
        title: "Student Form Pre-filled",
        description: "Please complete the remaining details for the student.",
      });
    }
  }, [location, toast]);



  // Enhanced data refresh function
  const refreshStudentData = async () => {
    try {
      console.log('🔄 Refreshing student data...');
      
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await refetch();
      
      toast({
        title: "Data Refreshed",
        description: "Student data has been refreshed successfully",
      });
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh student data",
        variant: "destructive",
      });
    }
  };

  // Enhanced test function to manually fetch and validate students
  const testFetchStudents = async () => {
    try {
      console.log('🧪 Testing manual student fetch...');
      
      // Test connection first
      const isConnected = await firebaseHelpers.checkConnection();
      console.log('🧪 Connection status:', isConnected);
      
      if (!isConnected) {
        toast({
          title: "Connection Error",
          description: "Firebase connection failed. Please check your internet connection.",
          variant: "destructive",
        });
        return;
      }
      
      // Fetch all students
      const allStudents = await firebaseHelpers.getAllStudents();
      console.log('🧪 Manual fetch result:', allStudents);
      
            // Fetch centre-specific students
      const centreId = userProfile?.centreId;
      if (centreId) {
        const centreStudents = await firebaseHelpers.getStudents(centreId);
        console.log('🧪 Centre fetch result:', centreStudents);
      } else {
        console.log('🧪 No centreId available for testing');
      }
      
      // Validate data structure
      if (allStudents.length > 0) {
        const sampleStudent = allStudents[0];
        console.log('🧪 Sample student structure:', Object.keys(sampleStudent));
        console.log('🧪 Sample student data:', sampleStudent);
        
        // Check for required fields
        const requiredFields = ['id', 'firstName', 'course', 'actualFees', 'feesPaid'];
        const missingFields = requiredFields.filter(field => !sampleStudent[field]);
        
        if (missingFields.length > 0) {
          console.warn('🧪 Missing required fields:', missingFields);
          toast({
            title: "Data Structure Warning",
            description: `Some required fields are missing: ${missingFields.join(', ')}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Data Validation Success",
            description: `Found ${allStudents.length} students with proper structure`,
          });
        }
      } else {
        toast({
          title: "No Data Found",
          description: "No students found in the database",
          variant: "destructive",
        });
      }
      
      // Force refresh the query
      refetch();
      
    } catch (error) {
      console.error('🧪 Manual fetch error:', error);
      toast({
        title: "Fetch Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const ITEMS_PER_PAGE = 25;

  // Fetch students from Firebase with enhanced data processing
  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ['students', userProfile?.centreId],
    queryFn: async () => {
      try {
        let rawStudents;
        const centreId = userProfile?.centreId;
        console.log('🔍 Fetching students for centreId:', centreId);
        
        if (!centreId) {
          console.log('🔍 No centreId available, cannot fetch students');
          return [];
        }
        
        console.log('🔍 Using centreId:', centreId);
        rawStudents = await firebaseHelpers.getStudents(centreId);
        
        // Transform and clean the data with enhanced processing
        console.log('🔍 Raw students data:', rawStudents);
        const processedStudents = rawStudents.map((student: any, index: number) => {
          // Enhanced Firestore Timestamp conversion
          const convertTimestamp = (timestamp: any) => {
            if (!timestamp) return null;
            if (timestamp.toDate && typeof timestamp.toDate === 'function') {
              return timestamp.toDate();
            }
            if (timestamp instanceof Date) {
              return timestamp;
            }
            if (typeof timestamp === 'string') {
              return new Date(timestamp);
            }
            return timestamp;
          };

          // Convert all timestamp fields
          const processed = {
            ...student,
            createdAt: convertTimestamp(student.createdAt),
            updatedAt: convertTimestamp(student.updatedAt),
            admissionDate: convertTimestamp(student.admissionDate),
            courseStartDate: convertTimestamp(student.courseStartDate),
            feesPaidDate: convertTimestamp(student.feesPaidDate),
            dueDate: convertTimestamp(student.dueDate),
            followUpDate: convertTimestamp(student.followUpDate),
          };
          
          // Enhanced data cleaning with better field mapping
          const cleanedStudent = {
            id: processed.id || `student-${index + 1}`,
            srNo: processed.srNo || processed.id || `SR${index + 1}`,
            firstName: processed.firstName || processed.leadName || processed.studentName || '',
            lastName: processed.lastName || '',
            email: processed.email || processed.emailId || '',
            phone: processed.phone || processed.contact || '',
            parentsContactNumber: processed.parentsContactNumber || processed.parentContact || processed.parentsPhone || processed.parentPhone || '',
            admissionMonth: processed.admissionMonth || '',
            admissionDate: processed.admissionDate || processed.enquiryDate || processed.createdAt,
            zicaZima: processed.zicaZima || processed.category || processed.type || '',
            zicaSubCategory: processed.zicaSubCategory || '',
            feesStructure: processed.feesStructure || '',
            course: processed.course || processed.courseInterest || processed.program || '',
            courseDuration: processed.courseDuration || processed.duration || '',
            courseStartDate: processed.courseStartDate || processed.startDate || processed.admissionDate,
            actualFees: processed.actualFees || processed.fees || processed.totalFees || '0',
            discountedFees: processed.discountedFees || processed.discount || '0',
            feesPaid: processed.feesPaid || processed.paidAmount || processed.amountPaid || '0',
            feesPaidDate: processed.feesPaidDate || processed.paymentDate || processed.lastPaymentDate,
            feesBalance: processed.feesBalance || processed.balance || processed.remainingBalance || '0',
            paymentMode: processed.paymentMode || processed.paymentMethod || processed.paymentType || '',
            chequeNumber: processed.chequeNumber || '',
            noOfInstallments: processed.noOfInstallments || processed.installments || '0',
            installmentsPaid: processed.installmentsPaid || processed.paidInstallments || '0',
            remainingInstallments: processed.remainingInstallments || '',
            dueDate: processed.dueDate || processed.nextPayment || processed.paymentDue,
            remarks: processed.remarks || processed.notes || processed.comments || processed.feedback || '',
            status: processed.status || 'active',
            centreId: processed.centreId || userProfile?.centreId,
            createdAt: processed.createdAt || new Date(),
            updatedAt: processed.updatedAt || new Date(),
            // Additional fields that might be present
            source: processed.source || processed.leadSource || '',
            area: processed.area || processed.cityArea || processed.location || '',
            education: processed.education || processed.qualification || '',
            assignedTo: processed.assignedTo || processed.counselorName || processed.counselor || '',
            priority: processed.priority || 'medium',
            type: processed.type || 'student',
          };
          
          // Validate and format numeric fields
          const formatNumericField = (value: any) => {
            if (value === null || value === undefined || value === '') return '0';
            const numValue = parseFloat(String(value).replace(/[^\d.]/g, ''));
            return isNaN(numValue) ? '0' : numValue.toString();
          };

          // Format numeric fields
          cleanedStudent.actualFees = formatNumericField(cleanedStudent.actualFees);
          cleanedStudent.discountedFees = formatNumericField(cleanedStudent.discountedFees);
          cleanedStudent.feesPaid = formatNumericField(cleanedStudent.feesPaid);
          cleanedStudent.feesBalance = formatNumericField(cleanedStudent.feesBalance);
          cleanedStudent.noOfInstallments = formatNumericField(cleanedStudent.noOfInstallments);
          cleanedStudent.installmentsPaid = formatNumericField(cleanedStudent.installmentsPaid);

          // Calculate remaining installments if not present
          if (!cleanedStudent.remainingInstallments) {
            const total = parseInt(cleanedStudent.noOfInstallments) || 0;
            const paid = parseInt(cleanedStudent.installmentsPaid) || 0;
            cleanedStudent.remainingInstallments = Math.max(0, total - paid).toString();
          }
          
          // Debug: Log the cleaned student data
          console.log('✅ Enhanced cleaned student:', cleanedStudent);
          
          return cleanedStudent;
        });
        
        console.log('🎯 Final processed students:', processedStudents);
        return processedStudents;
      } catch (error) {
        console.error('❌ Error fetching students:', error);
        return [];
      }
    },
    enabled: !!userProfile?.centreId, // Only enable when we have a centreId
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3, // Retry failed requests
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });



  // Delete student mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return firebaseHelpers.deleteStudent(id);
    },
    onSuccess: (_, studentId) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      
      // Show success popup
      if (studentToDelete) {
        setDeletedStudentName(`${studentToDelete.firstName || ''} ${studentToDelete.lastName || ''}`.trim());
        setShowSuccessPopup(true);
        setStudentToDelete(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete student",
        variant: "destructive",
      });
    }
  });

  // Bulk upload mutation
          const bulkUploadMutation = useMutation({
          mutationFn: async (studentsData: any[]) => {
            const results = [];
            for (let i = 0; i < studentsData.length; i++) {
              const studentData = studentsData[i];
              
              const result = await firebaseHelpers.saveStudent({
                ...studentData,
                      centreId: userProfile?.centreId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({
        title: "Upload Successful",
        description: "Students uploaded successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "An error occurred during upload.",
        variant: "destructive",
      });
    }
  });

  // Inline update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      return firebaseHelpers.updateStudent(id, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const filteredStudents = useMemo(() => {
    const filtered = students.filter((student: any) => {
      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(debouncedSearchTerm.toLowerCase()) ||
                           student.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           student.course?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchesSearch;
    });
    return filtered;
  }, [students, debouncedSearchTerm]);

  const [activeTab, setActiveTab] = useState<"overview" | "students">("students");
  


  // Enhanced data validation - check if students have the required fields
  useEffect(() => {
    if (students.length > 0) {
      console.log("=== ENHANCED DATA VALIDATION ===");
      console.log("Total students:", students.length);
      
      // Check first student for all required fields
      const firstStudent = students[0];
      console.log("First student data:", firstStudent);
      
      // Only check truly required fields (firstName, phone, course are required)
      // lastName and remarks are optional according to the form schema
      const requiredFields = [
        'srNo', 'firstName', 'phone', 'course', 'status'
      ];
      
      const missingFields: string[] = [];
      const fieldTypes: Record<string, string> = {};
      
      requiredFields.forEach(field => {
        const value = firstStudent[field];
        fieldTypes[field] = typeof value;
        
        if (value === null || value === undefined || value === '') {
          missingFields.push(field);
        }
        
        console.log(`${field}:`, value, typeof value);
      });
      
      console.log("Field types:", fieldTypes);
      console.log("Missing fields:", missingFields);
      
      // Show validation results in toast if there are issues
      if (missingFields.length > 0) {
        console.warn("⚠️ Missing required fields:", missingFields);
        toast({
          title: "Data Validation Warning",
          description: `Missing fields: ${missingFields.join(', ')}`,
          variant: "destructive",
        });
      } else {
        console.log("✅ All required fields present");
      }
      
      // Validate data types
      const expectedTypes = {
        'actualFees': 'string',
        'discountedFees': 'string', 
        'feesPaid': 'string',
        'feesBalance': 'string',
        'noOfInstallments': 'string',
        'installmentsPaid': 'string'
      };
      
      Object.entries(expectedTypes).forEach(([field, expectedType]) => {
        const actualType = fieldTypes[field];
        if (actualType !== expectedType) {
          console.warn(`⚠️ Field ${field} has type ${actualType}, expected ${expectedType}`);
        }
      });
    }
  }, [students, toast]);

  // Pagination logic
  const { sortedData: sortedFilteredStudents, requestSort, sortConfig } = useTableSort(
    filteredStudents,
    STUDENT_DATE_SORT
  );

  const numberedStudents = useMemo(
    () => assignContiguousSerialsToOrderedList(sortedFilteredStudents),
    [sortedFilteredStudents]
  );

  const totalPages = Math.ceil(numberedStudents.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentStudents = numberedStudents.slice(startIndex, endIndex);

  // Calculate next serial number for new students (highest existing + 1)
  const nextSrNo = getNextSerialNumberFromItems(students);

  // Helper function to calculate remaining installments
  const calculateRemainingInstallments = (student: any) => {
    const totalInstallments = parseInt(student.noOfInstallments) || 0;
    const paidInstallments = parseInt(student.installmentsPaid) || 0;
    return Math.max(0, totalInstallments - paidInstallments);
  };

  // Analytics data preparation
  const analyticsData = useMemo(() => {
    // Current month and year for "New Admissions" calculation
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const stats = students.reduce((acc: any, student: any) => {
      // New Admissions (This Month)
      const admDate = student.admissionDate ? new Date(student.admissionDate) : null;
      if (admDate && admDate.getMonth() === currentMonth && admDate.getFullYear() === currentYear) {
        acc.newAdmissions++;
      }

      // Unique Courses
      if (student.course) {
        acc.courses.add(student.course);
      }

      // ZICA vs AIGT vs Non-Zica (Bettercode umbrella)
      const zz = (student.zicaZima || '').toString().toLowerCase();
      const isAigt = zz === 'aigt' || zz === 'bettercode';
      const isNonZica = student.zicaSubCategory === 'Non-ZICA';
      if (isAigt) {
        acc.aigtCount++;
      } else if (isNonZica) {
        acc.nonZicaCount++;
      } else {
        acc.zicaCount++;
      }

      // Active Students
      if ((student.status || '').toLowerCase() === 'active') {
        acc.activeCount++;
      }

      // Graduated (completed course)
      const statusLower = (student.status || '').toLowerCase();
      if (statusLower === 'graduated' || statusLower === 'completed') {
        acc.graduatedCount++;
      }

      return acc;
    }, {
      newAdmissions: 0,
      courses: new Set(),
      zicaCount: 0,
      aigtCount: 0,
      nonZicaCount: 0,
      activeCount: 0,
      graduatedCount: 0
    });

    const courseData = filteredStudents.reduce((acc: Record<string, number>, student: any) => {
      const course = student.course || 'Unknown';
      acc[course] = (acc[course] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const monthlyAdmissions = filteredStudents.reduce((acc: Record<string, number>, student: any) => {
      const month = student.admissionMonth || 'Unknown';
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const feeProgress = filteredStudents.reduce((acc: { totalActual: number; totalPaid: number }, student: any) => {
      const actualFees = parseFloat(student.actualFees) || 0;
      const feesPaid = parseFloat(student.feesPaid) || 0;
      acc.totalActual += actualFees;
      acc.totalPaid += feesPaid;
      return acc;
    }, { totalActual: 0, totalPaid: 0 });

    // Admission trend: last 6 months (count by admissionDate)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const admissionTrendData: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = `${monthNames[month]} ${year}`;
      const count = students.filter((s: any) => {
        const ad = s.admissionDate;
        if (!ad) return false;
        const date = ad?.toDate ? ad.toDate() : new Date(ad);
        return date.getFullYear() === year && date.getMonth() === month;
      }).length;
      admissionTrendData.push({ month: label, count });
    }

    // Course-wise distribution for column chart: [{ course, count }]
    const courseDistributionChartData = Object.entries(courseData)
      .filter(([name]) => name.trim().toLowerCase() !== 'other' && name !== 'Unknown')
      .map(([name, value]) => ({ course: name, count: value as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Business-wise for pie: ZICA, Non-ZICA, AIGT
    const businessDistributionPieData = [
      { name: "ZICA", value: stats.zicaCount, fill: "hsl(262, 83%, 58%)" },
      { name: "Non-ZICA", value: stats.nonZicaCount, fill: "hsl(25, 95%, 53%)" },
      { name: "AIGT", value: stats.aigtCount, fill: "hsl(346, 77%, 50%)" },
    ].filter((d) => d.value > 0);

    // Course duration stacked: by course, then by duration
    const durationByCourse: Record<string, Record<string, number>> = {};
    const allDurations = new Set<string>();
    students.forEach((s: any) => {
      const course = s.course || "Unknown";
      const durRaw = s.courseDuration != null && s.courseDuration !== "" ? String(s.courseDuration).replace(/\s*(months?|m|mo)\s*/i, "").trim() : "";
      const dur = durRaw || "Not specified";
      if (!durationByCourse[course]) durationByCourse[course] = {};
      durationByCourse[course][dur] = (durationByCourse[course][dur] || 0) + 1;
      allDurations.add(dur);
    });
    const durationKeys = Array.from(allDurations)
      .filter((k) => k.toLowerCase() !== "other")
      .sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a).localeCompare(b);
    });
    const courseDurationStackData = Object.entries(durationByCourse)
      .filter(([course]) => course.trim().toLowerCase() !== "other")
      .map(([course, durCounts]) => {
      const row: Record<string, string | number> = { name: course, course };
      durationKeys.forEach((k) => { row[k] = durCounts[k] || 0; });
      return row;
    }).sort((a, b) => {
      const totalA = durationKeys.reduce((sum, k) => sum + (Number(a[k]) || 0), 0);
      const totalB = durationKeys.reduce((sum, k) => sum + (Number(b[k]) || 0), 0);
      return totalB - totalA;
    }).slice(0, 10);

    return {
      totalStudents: students.length,
      newAdmissions: stats.newAdmissions,
      totalCourses: stats.courses.size,
      zicaCount: stats.zicaCount,
      aigtCount: stats.aigtCount,
      nonZicaCount: stats.nonZicaCount,
      activeCount: stats.activeCount,
      graduatedCount: stats.graduatedCount,
      admissionTrendData,
      courseDistributionChartData,
      businessDistributionPieData,
      courseDurationStackData,
      courseDurationKeys: durationKeys,
      courseData: Object.entries(courseData).map(([name, value]) => ({ name, value: value as number })),
      monthlyAdmissions: Object.entries(monthlyAdmissions).map(([name, value]) => ({ name, value: value as number })),
      feeProgress,
    };
  }, [students, filteredStudents]);

  const handleAddStudent = () => {
    setSelectedStudent(null);
    setFormMode("create");
    setIsFormOpen(true);
  };

  const handleEditStudent = (student: any) => {
    // Helper function to format numeric values for form inputs
    const formatNumericForForm = (value: any) => {
      if (value === null || value === undefined || value === '') return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number') return value.toString();
      try {
        return String(value).trim();
      } catch (error) {
        console.error('Error converting value to string:', error, value);
        return '';
      }
    };

    // Format dates and ensure all form fields are explicitly set for the edit form
    const formattedStudent = {
      ...student,
      id: student.id,
      srNo: student.srNo,
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email: student.email || student.emailId || '',
      phone: formatNumericForForm(student.phone),
      parentsContactNumber: student.parentsContactNumber || student.parentContact || student.parentsPhone || student.parentPhone || '',
      source: student.source || student.leadSource || '',
      admissionDate: formatDateForInput(student.admissionDate),
      courseStartDate: formatDateForInput(student.courseStartDate),
      feesPaidDate: formatDateForInput(student.feesPaidDate),
      dueDate: formatDateForInput(student.dueDate),
      actualFees: formatNumericForForm(student.actualFees),
      discountedFees: formatNumericForForm(student.discountedFees),
      feesPaid: formatNumericForForm(student.feesPaid),
      feesBalance: formatNumericForForm(student.feesBalance),
      noOfInstallments: formatNumericForForm(student.noOfInstallments),
      installmentsPaid: formatNumericForForm(student.installmentsPaid),
      remainingInstallments: formatNumericForForm(student.remainingInstallments),
      course: student.course || '',
      courseDuration: formatNumericForForm(student.courseDuration),
      zicaZima: student.zicaZima || '',
      feesStructure: student.feesStructure || '',
      paymentMode: student.paymentMode || student.paymentMethod || student.paymentType || '',
      status: student.status || 'active',
      remarks: student.remarks || '',
      centreId: student.centreId || userProfile?.centreId,
      chequeNumber: student.chequeNumber || '',
      zicaSubCategory: student.zicaSubCategory || '',
    };

    setSelectedStudent(formattedStudent);
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const handleDeleteStudent = (student: any) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (studentToDelete) {
      deleteMutation.mutate(studentToDelete.id);
      setDeleteDialogOpen(false);
    }
  };

  const handleUploadSheet = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.xlsx,.xls';
    fileInput.style.display = 'none';
    
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          // Import XLSX dynamically
          const XLSX = await import('xlsx');
          const reader = new FileReader();
          
          reader.onload = async (event) => {
            try {
              const data = event.target?.result;
              if (!data) {
                toast({
                  title: 'Error',
                  description: 'Failed to read file',
                  variant: 'destructive',
                });
                return;
              }

              const workbook = XLSX.read(data, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

              if (rows.length < 2) {
                toast({
                  title: 'Error',
                  description: 'Excel file must have at least a header row and one data row',
                  variant: 'destructive',
                });
                return;
              }

              const excelHeaders = rows[0];
              const dataRows = rows.slice(1);
              const studentsData: any[] = [];

              // Debug: Log the actual headers from Excel
              console.log('=== EXCEL UPLOAD DEBUG ===');
              console.log('Excel Headers:', excelHeaders);
              console.log('Sample data row:', dataRows[0]);
              console.log('All data rows:', dataRows.slice(0, 3));
              
              // Show each header with its index and sample value
              excelHeaders.forEach((header, index) => {
                const sampleValue = dataRows[0]?.[index];
                console.log(`Header ${index}: "${header}" = "${sampleValue}"`);
              });
              
              

              // Map Excel headers to student fields - comprehensive mapping based on actual Excel structure
              const headerMap: Record<string, string> = {
                // Row Number variations
                'Sr.': 'srNo',
                'Sr No.': 'srNo',
                'Sr no.': 'srNo',
                'Serial No.': 'srNo',
                'Serial Number': 'srNo',
                'No.': 'srNo',
                'Row Number': 'srNo',
                
                // Name variations
                'Name': 'firstName',
                'Student Name': 'firstName',
                'Full Name': 'firstName',
                'Lead Name': 'firstName',
                'Student': 'firstName',
                
                // Phone variations (including Phone & Month format)
                'Phone': 'phone',
                'Contact': 'phone',
                'Phone Number': 'phone',
                'Contact Number': 'phone',
                'Mobile': 'phone',
                'Phone & Month': 'phone',
                'Phone and Month': 'phone',
                
                // Date & Identifier variations
                'Date & Identifier': 'admissionDate',
                'Date and Identifier': 'admissionDate',
                'Date': 'admissionDate',
                'Admission Date': 'admissionDate',
                'Date of Admission': 'admissionDate',
                'Enquiry Date': 'admissionDate',
                'Created Date': 'admissionDate',
                
                // Category/Status variations
                'Category': 'zicaZima',
                'Category/Status': 'zicaZima',
                'Category and Status': 'zicaZima',
                'ZICA/ZIMA': 'zicaZima',
                'Type': 'zicaZima',
                'Student Type': 'zicaZima',
                // Course/Program variations
                'Course': 'course',
                'Course ': 'course', // Handle trailing space
                'Course/Program': 'course',
                'Course and Program': 'course',
                'Interested Course': 'course',
                'Program': 'course',
                'Course Name': 'course',
                
                // Duration variations
                'Duration': 'courseDuration',
                'Course Duration': 'courseDuration',
                'Duration (Months)': 'courseDuration',
                'Course Duration (Months)': 'courseDuration',
                
                // Admission/Start Date variations
                'Admission/Start Date': 'courseStartDate',
                'Admission and Start Date': 'courseStartDate',
                'Start Date': 'courseStartDate',
                'Course Start Date': 'courseStartDate',
                
                // Actual Fees variations
                'Actual Fees': 'actualFees',
                'Fees': 'actualFees',
                'Total Fees': 'actualFees',
                'Course Fees': 'actualFees',
                'Numeric Value 1': 'actualFees',
                
                // Discounted Fees variations
                'Discounted Fees': 'discountedFees',
                'Discounted': 'discountedFees',
                'Numeric Value 2': 'discountedFees',
                
                // Paid Amount variations
                'Paid Amount': 'feesPaid',
                'Paid': 'feesPaid',
                'Fees Paid': 'feesPaid',
                'Amount Paid': 'feesPaid',
                'Numeric Value 3': 'feesPaid',
                
                // Payment Date variations
                'Payment Date': 'feesPaidDate',
                'Fees Paid Date': 'feesPaidDate',
                'Last Payment Date': 'feesPaidDate',
                'Payment/Last Payment Date': 'feesPaidDate',
                
                // Balance & Payment Method variations
                'Balance & Payment Method': 'feesBalance',
                'Balance and Payment Method': 'feesBalance',
                'Balance': 'feesBalance',
                'Fees Balance': 'feesBalance',
                'Remaining Balance': 'feesBalance',
                'Due Amount': 'feesBalance',
                'Numeric Value 4': 'feesBalance',
                
                // Payment Mode extraction (from Balance & Payment Method)
                'Payment Mode': 'paymentMode',
                'Payment Method': 'paymentMode',
                'Payment Type': 'paymentMode',
                
                // Remarks/Payment Type variations
                'Remarks/Payment Type': 'remarks',
                'Remarks and Payment Type': 'remarks',
                'Remarks': 'remarks',
                'Notes': 'remarks',
                'Comments': 'remarks',
                'Feedback': 'remarks',
                
                // Installments/Count variations
                'Installments/Count': 'noOfInstallments',
                'Installments and Count': 'noOfInstallments',
                'No. of Installments': 'noOfInstallments',
                'Installments': 'noOfInstallments',
                'Numeric Value 5': 'noOfInstallments',
                
                // Date & Status/Remarks variations
                'Date & Status/Remarks': 'dueDate',
                'Date and Status/Remarks': 'dueDate',
                'Due Date': 'dueDate',
                'Status/Remarks': 'remarks',
                
                // Additional Remarks
                'Additional Remarks': 'remarks',
                'Extra Remarks': 'remarks',
                
                // Additional fields that might be in your Excel
                'Email': 'email',
                'Email ID': 'email',
                'Email Address': 'email',
                
                // Common variations that might appear in Excel files
                'Fees Structure': 'feesStructure',
                'FEES STRUCTURE': 'feesStructure', // Handle uppercase
                'Fee Structure': 'feesStructure',
                'Structure': 'feesStructure',
                'Fee Details': 'feesStructure',
                'Payment Structure': 'feesStructure',
                'Fees Structure/Type': 'feesStructure',
                'Fee Structure/Type': 'feesStructure',
                'Payment Structure/Type': 'feesStructure',
                
                'Admission Month': 'admissionMonth',
                'ADMISSION MONTH': 'admissionMonth', // Handle uppercase
                'Month': 'admissionMonth',
                'Enrollment Month': 'admissionMonth',
                
                'Course Start': 'courseStartDate',
                'Course Beginning': 'courseStartDate',
                
                'Payment Due': 'dueDate',
                'Next Payment': 'dueDate',
                
                'Source': 'source',
                'Lead Source': 'source',
                'Source of Lead': 'source',
                
                'Area': 'area',
                'Location': 'area',
                'City': 'area',
                
                'Education': 'education',
                'Education Level': 'education',
                'Qualification': 'education',
                
                'Assigned To': 'assignedTo',
                'Counselor': 'assignedTo',
                'Counselor Name': 'assignedTo',
                'Assigned Counselor': 'assignedTo',
                
                'Follow Up Date': 'followUpDate',
                'Next Follow Up': 'followUpDate',
                'Follow Up': 'followUpDate'
              };

              // Auto-detect and map any unmapped headers
              const unmappedHeaders = excelHeaders.filter(header => !headerMap[header]);
              if (unmappedHeaders.length > 0) {
                console.log('Unmapped headers found:', unmappedHeaders);
                
                // Try to auto-map based on content analysis
                unmappedHeaders.forEach(header => {
                  const sampleValue = dataRows[0]?.[excelHeaders.indexOf(header)];
                  console.log(`Header: "${header}", Sample value: "${sampleValue}"`);
                  
                                      // Auto-map based on content patterns
                    if (sampleValue) {
                      const valueStr = String(sampleValue).toLowerCase();
                      const headerLower = header.toLowerCase();
                      
                      // More comprehensive auto-mapping
                      if (valueStr.includes('month') || valueStr.match(/[a-z]{3,4}/i) || headerLower.includes('month')) {
                        headerMap[header] = 'admissionMonth';
                        console.log(`Auto-mapped "${header}" to admissionMonth`);
                      } else if (valueStr.match(/\d{1,2}-\d{1,2}-\d{4}/) || headerLower.includes('date')) {
                        // Date pattern like "12-05-2025"
                        if (headerLower.includes('start') || headerLower.includes('course')) {
                          headerMap[header] = 'courseStartDate';
                          console.log(`Auto-mapped "${header}" to courseStartDate`);
                        } else if (headerLower.includes('paid') || headerLower.includes('payment')) {
                          headerMap[header] = 'feesPaidDate';
                          console.log(`Auto-mapped "${header}" to feesPaidDate`);
                        } else if (headerLower.includes('due')) {
                          headerMap[header] = 'dueDate';
                          console.log(`Auto-mapped "${header}" to dueDate`);
                        } else {
                          headerMap[header] = 'admissionDate';
                          console.log(`Auto-mapped "${header}" to admissionDate`);
                        }
                      } else if (valueStr.match(/^\d+$/) && parseInt(valueStr) > 0) {
                        // Numeric values
                        if (headerLower.includes('installment')) {
                          headerMap[header] = 'noOfInstallments';
                          console.log(`Auto-mapped "${header}" to noOfInstallments`);
                        } else if (headerLower.includes('structure')) {
                          headerMap[header] = 'feesStructure';
                          console.log(`Auto-mapped "${header}" to feesStructure`);
                        }
                      } else if (headerLower.includes('structure') || headerLower.includes('fee') || headerLower.includes('amount')) {
                        // Try to map based on header name
                        if (headerLower.includes('structure')) {
                          headerMap[header] = 'feesStructure';
                          console.log(`Auto-mapped "${header}" to feesStructure based on header name`);
                        } else if (headerLower.includes('discount')) {
                          headerMap[header] = 'discountedFees';
                          console.log(`Auto-mapped "${header}" to discountedFees based on header name`);
                        } else if (headerLower.includes('paid')) {
                          headerMap[header] = 'feesPaid';
                          console.log(`Auto-mapped "${header}" to feesPaid based on header name`);
                        } else if (headerLower.includes('balance') || headerLower.includes('due')) {
                          headerMap[header] = 'feesBalance';
                          console.log(`Auto-mapped "${header}" to feesBalance based on header name`);
                        }
                      } else if (headerLower.includes('course') || headerLower.includes('program')) {
                        // Handle course/program headers
                        headerMap[header] = 'course';
                        console.log(`Auto-mapped "${header}" to course based on header name`);
                      }
                    }
                });
              }
              
              // Final header mapping log
              console.log('Final header mapping:', headerMap);

              for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                // Skip row if all cells are empty or whitespace
                const isEmpty = row.every((cell: any) => !cell || String(cell).trim() === '');
                if (isEmpty) continue;

              const studentData: any = {};
              
                // Map row data to object using Excel headers
                excelHeaders.forEach((header: string, index: number) => {
                  const fieldName = headerMap[header];
                  if (fieldName) {
                    let value = row[index] || '';
                    
                    // Handle different field types
                    if (fieldName === 'phone') {
                      // Extract phone number from "Phone & Month" format (e.g., "7020794078 MAY")
                      if (header === 'Phone & Month' || header === 'Phone and Month') {
                        const phoneMatch = String(value).match(/^(\d+)/);
                        value = phoneMatch ? phoneMatch[1] : String(value).replace(/[^\d]/g, '');
                        
                        // Also extract admission month
                        const monthMatch = String(row[index]).match(/([A-Z]+)$/);
                        if (monthMatch && !studentData.admissionMonth) {
                          studentData.admissionMonth = monthMatch[1];
                        }
                } else {
                        value = String(value).replace(/[^\d]/g, ''); // Remove non-digits
                      }
                    } else if (fieldName === 'actualFees' || fieldName === 'feesPaid' || fieldName === 'feesBalance' || fieldName === 'discountedFees') {
                      // Handle fee fields - extract numeric values
                      if (typeof value === 'string') {
                        // Remove currency symbols and commas
                        value = value.replace(/[₹,]/g, '').replace(/[^\d.]/g, '');
                      }
                      value = String(value).replace(/[^\d.]/g, ''); // Keep only digits and decimal
                    } else if (fieldName === 'admissionDate' || fieldName === 'courseStartDate' || fieldName === 'feesPaidDate' || fieldName === 'dueDate') {
                      // Handle date fields - try multiple formats
                      if (typeof value === 'string' && value.includes('-')) {
                        // Handle DD-MM-YYYY format
                        const dateParts = value.split('-');
                        if (dateParts.length === 3) {
                          const [day, month, year] = dateParts;
                          value = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        }
                      } else {
                        value = parseExcelDate(value);
                      }
                    } else if (fieldName === 'feesBalance') {
                      // Extract balance from "Balance & Payment Method" format (e.g., "0 UPI")
                      if (header === 'Balance & Payment Method' || header === 'Balance and Payment Method') {
                        const balanceMatch = String(value).match(/^([\d.]+)/);
                        value = balanceMatch ? balanceMatch[1] : String(value).replace(/[^\d.]/g, '');
                        
                        // Also extract payment method
                        const paymentMatch = String(row[index]).match(/([A-Z]+)$/);
                        if (paymentMatch && !studentData.paymentMode) {
                          studentData.paymentMode = paymentMatch[1];
                        }
                      }
                    } else if (fieldName === 'zicaZima') {
                      // Extract ZICA/OLD from "Date & Identifier" format (e.g., "08-05-2025 ZICA")
                      if (header === 'Date & Identifier' || header === 'Date and Identifier') {
                        const zicaMatch = String(value).match(/(ZICA|OLD)$/);
                        value = zicaMatch ? zicaMatch[1] : value;
                      }
                    } else if (fieldName === 'noOfInstallments') {
                      // Handle installment count (e.g., "1", "2", "20", "7", "4-")
                      value = String(value).replace(/[^\d]/g, ''); // Keep only digits
                    } else if (fieldName === 'feesStructure') {
                      // Handle fees structure - keep as is
                      value = String(value).trim();
                    } else if (fieldName === 'admissionMonth') {
                      // Handle admission month - extract from various formats
                      if (typeof value === 'string') {
                        const monthMatch = value.match(/([A-Z]{3,4})/);
                        value = monthMatch ? monthMatch[1] : value;
                      }
                    } else if (fieldName === 'firstName') {
                      // Handle full name - split into first and last name
                      const fullName = String(value).trim();
                      if (fullName) {
                        const nameParts = fullName.split(' ');
                        studentData['firstName'] = nameParts[0] || '';
                        studentData['lastName'] = nameParts.slice(1).join(' ') || '';
                      }
                      return; // Skip the default assignment below
                    }
                    
                    studentData[fieldName] = value;
                  }
                });
                
                // Set default values for required fields
                studentData['status'] = studentData['status'] || 'active';
                studentData['centreId'] = userProfile?.centreId;
                studentData['createdAt'] = new Date();
                studentData['updatedAt'] = new Date();
                
                // Fallback: capture any unmapped data that might be important
                excelHeaders.forEach((header, index) => {
                  if (!headerMap[header] && row[index]) {
                    const value = row[index];
                    console.log(`Unmapped data found: "${header}" = "${value}"`);
                    
                    // Store unmapped data in a special field for debugging
                    if (!studentData.unmappedData) {
                      studentData.unmappedData = {};
                    }
                    studentData.unmappedData[header] = value;
                  }
                });
                
                // Log the processed student data for debugging
                console.log(`Student ${i + 1} processed:`, {
                  originalRow: row,
                  processedData: studentData,
                  headerMapping: Object.fromEntries(
                    excelHeaders.map((header, idx) => [header, headerMap[header]])
                  )
                });
                
                
                
                studentsData.push(studentData);
              }

              if (studentsData.length > 0) {
                console.log('Processed students data:', studentsData);
                console.log('Sample processed student:', studentsData[0]);
          bulkUploadMutation.mutate(studentsData);
              } else {
                console.log('No valid data found. Headers:', excelHeaders);
                console.log('First few rows:', dataRows.slice(0, 3));
                console.log('Header mapping used:', headerMap);
                toast({
                  title: 'No Data',
                  description: 'No valid student data found in the file. Check console for details.',
                  variant: 'destructive',
                });
              }
            } catch (error: any) {
              console.error('Error processing Excel file:', error);
              toast({
                title: 'Error',
                description: 'Failed to process Excel file',
                variant: 'destructive',
              });
            }
          };
          
          reader.readAsBinaryString(file);
        } catch (error: any) {
          toast({
            title: "Upload Failed",
            description: error.message || "An error occurred during upload.",
            variant: "destructive",
          });
        }
      }
    };
    
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

  const handleExportData = async () => {
    try {
      const headers = [
        'Sr No.', 'Student Name', 'Contact Number', 'Email', 'Date of Admission',
        'ZICA/ZIMA', 'Fees Structure', 'Course', 'Course Duration', 'Course Start Date',
        'Actual Fees', 'Discounted Fees', 'Fees Paid', 'Fees Paid Date', 'Fees Balance',
        'Payment Mode', 'No. of Installments', 'Installments Paid', 'Remaining Installments',
        'Remarks', 'Centre ID', 'Created At', 'Updated At'
      ];

      const csvContent = [
        headers.join(','),
        ...filteredStudents.map((student: any) => [
          student.srNo || '',
          `${student.firstName || ''} ${student.lastName || ''}`,
          student.phone || '',
          student.email || '',
          formatDate(student.admissionDate) || '',
          student.zicaZima || '',
          student.feesStructure || '',
          student.course || '',
          student.courseDuration || '',
          formatDate(student.courseStartDate) || '',
          student.actualFees || '',
          student.discountedFees || '',
          student.feesPaid || '',
          formatDate(student.feesPaidDate) || '',
          student.feesBalance || '',
          student.paymentMode || '',
          student.noOfInstallments || '',
          student.installmentsPaid || '',
          calculateRemainingInstallments(student),
          student.remarks || '',
          student.centreId || '',
          formatDate(student.createdAt) || '',
          formatDate(student.updatedAt) || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `students_data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Successful",
        description: `Exported ${filteredStudents.length} student records successfully!`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "An error occurred during export.",
        variant: "destructive",
      });
    }
  };

  if (!userProfile?.centreId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-600 text-lg font-medium">No Centre ID Available</p>
          <p className="text-sm text-gray-500 mt-2">Please ensure your user profile has a valid centre ID</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Loading 
        fullScreen={true} 
        text="Loading students from Firebase..." 
        size="lg"
        color="primary"
      />
    );
  }

  return (
    <div>
      <div className="min-h-screen bg-slate-50">
        {/* Enhanced Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm mb-6">
          <div className="max-w-10xl mx-auto px-4 sm:px-6 py-4 lg:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Student Management</h1>
                  <p className="text-sm text-slate-500">Manage all student records and their details.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search students..."
                    className="pl-9 pr-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddStudent} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Add New Student
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-10xl mx-auto px-4 sm:px-6 pb-8">
          <div className="mb-1">
            <div className="rounded-lg p-1">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "students" | "overview")} className="w-full">
                <TabsList className="grid w-full grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg">
                  <TabsTrigger 
                    value="students" 
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                  >
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Student List</span>
                    <span className="sm:hidden">List</span>
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="overview" 
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                  >
                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Analytics</span>
                    <span className="sm:hidden">Analytics</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="students">
                  <Card className="border border-slate-200/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-3 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">Student List</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleUploadSheet}>
                    <Upload className="w-4 h-4 mr-2" /> Import
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportData}>
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="border-collapse min-w-[2500px]">
                      <TableHeader className="sticky top-0 z-30">
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                          <SortableTableHead className="w-[64px] min-w-[64px] sticky left-0 z-40 font-semibold text-slate-700 py-3 text-xs sm:text-sm bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]" sortConfig={sortConfig} sortKey="srNo" requestSort={requestSort}>Sr No.</SortableTableHead>
                          <SortableTableHead className="min-w-[200px] sticky left-[64px] z-40 font-semibold text-slate-700 py-3 text-xs sm:text-sm bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" sortConfig={sortConfig} sortKey="firstName" requestSort={requestSort}>Student Name</SortableTableHead>
                          <SortableTableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="phone" requestSort={requestSort}>Contact</SortableTableHead>
                          <SortableTableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="admissionDate" requestSort={requestSort}>Date of Admission</SortableTableHead>
                          <SortableTableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="zicaZima" requestSort={requestSort}>Business</SortableTableHead>
                          <SortableTableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="feesStructure" requestSort={requestSort}>Fees Structure</SortableTableHead>
                          <SortableTableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="course" requestSort={requestSort}>Course</SortableTableHead>
                          <SortableTableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfig} sortKey="courseDuration" requestSort={requestSort}>Duration</SortableTableHead>
                          <SortableTableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="courseStartDate" requestSort={requestSort}>Start Date</SortableTableHead>
                          <SortableTableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="actualFees" requestSort={requestSort}>Actual Fees</SortableTableHead>
                          <SortableTableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="discountedFees" requestSort={requestSort}>Discounted</SortableTableHead>
                          <SortableTableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="feesPaid" requestSort={requestSort}>Paid Fees</SortableTableHead>
                          <SortableTableHead className="min-w-[120px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="feesPaidDate" requestSort={requestSort}>Paid Date</SortableTableHead>
                          <SortableTableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="feesBalance" requestSort={requestSort}>Balance</SortableTableHead>
                          <SortableTableHead className="min-w-[120px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="paymentMode" requestSort={requestSort}>Payment Mode</SortableTableHead>
                          <SortableTableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfig} sortKey="noOfInstallments" requestSort={requestSort}>Inst. Total</SortableTableHead>
                          <SortableTableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfig} sortKey="installmentsPaid" requestSort={requestSort}>Inst. Paid</SortableTableHead>
                          <SortableTableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfig} sortKey="remainingInstallments" requestSort={requestSort}>Inst. Rem.</SortableTableHead>
                          <TableHead className="w-24 font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentStudents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={19} className="h-32 text-center text-slate-500">
                              No students found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          currentStudents.map((student: any, idx: number) => (
                            <TableRow key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                              <TableCell className="w-[64px] min-w-[64px] sticky left-0 z-20 bg-white group-hover:bg-slate-50 font-medium text-slate-600 shadow-[1px_0_0_0_#e2e8f0]">
                                {safeRender(student.srNo ?? "—")}
                              </TableCell>
                              <TableCell className="min-w-[200px] sticky left-[64px] z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <div className="font-semibold text-slate-900 leading-none mb-1">
                                  {`${safeRender(student.firstName || '')} ${safeRender(student.lastName || '')}`}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                  {safeRender(student.email || '-')}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-600">{safeRender(student.phone)}</TableCell>
                              <TableCell className="text-slate-600">{formatDate(student.admissionDate)}</TableCell>
                              <TableCell className="text-slate-600">
                                <Badge variant="outline" className={cn("text-[10px] bg-slate-50", student.zicaSubCategory === 'Non-ZICA' ? "border-orange-500 text-orange-600" : "")}>
                                  {safeRender(student.zicaZima)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-600">{safeRender(student.feesStructure)}</TableCell>
                              <TableCell className="text-slate-900 font-medium">{safeRender(student.course)}</TableCell>
                              <TableCell className="text-center text-slate-600">{safeRender(student.courseDuration)} m</TableCell>
                              <TableCell className="text-slate-600">{formatDate(student.courseStartDate)}</TableCell>
                              <TableCell className="text-right font-medium text-slate-900">
                                {student.actualFees ? `₹${parseFloat(safeRender(student.actualFees)).toLocaleString()}` : '₹0'}
                              </TableCell>
                              <TableCell className="text-right font-medium text-slate-600">
                                {student.discountedFees ? `₹${parseFloat(safeRender(student.discountedFees)).toLocaleString()}` : '₹0'}
                              </TableCell>
                              <TableCell className="text-right font-medium text-emerald-600">
                                {student.feesPaid ? `₹${parseFloat(safeRender(student.feesPaid)).toLocaleString()}` : '₹0'}
                              </TableCell>
                              <TableCell className="text-slate-600">{formatDate(student.feesPaidDate)}</TableCell>
                              <TableCell className="text-right font-medium text-red-600">
                                {student.feesBalance ? `₹${parseFloat(safeRender(student.feesBalance)).toLocaleString()}` : '₹0'}
                              </TableCell>
                              <TableCell className="text-slate-600">{safeRender(student.paymentMode)}</TableCell>
                              <TableCell className="text-center text-slate-600">{safeRender(student.noOfInstallments)}</TableCell>
                              <TableCell className="text-center text-slate-600">{safeRender(student.installmentsPaid)}</TableCell>
                              <TableCell className="text-center text-slate-600">{calculateRemainingInstallments(student)}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditStudent(student)}
                                    className="h-8 w-8 p-0 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteStudent(student)}
                                    className="h-8 w-8 p-0 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                <div className="flex justify-between items-center p-4 border-t border-slate-100">
                  <div className="text-sm text-slate-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length} students
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-slate-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="overview" className="mt-0">
                  <div className="px-1 py-4 md:px-2 md:py-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
                      {/* Total Students */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <GraduationCap className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-blue-100/90 text-xs font-medium uppercase tracking-wider mb-2">Total Students</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.totalStudents}</p>
                          <p className="text-blue-100/80 text-xs mt-1">Overall</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-blue-100/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span>Manage All Records</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* New Admissions */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <UserPlus className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-emerald-100/90 text-xs font-medium uppercase tracking-wider mb-2">New Admissions</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.newAdmissions}</p>
                          <p className="text-emerald-100/80 text-xs mt-1">This Month</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-100/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                            <span>Growth Tracking</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Total Courses */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <BookOpen className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-amber-100/90 text-xs font-medium uppercase tracking-wider mb-2">Total Courses</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.totalCourses}</p>
                          <p className="text-amber-100/80 text-xs mt-1">Active</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-amber-100/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Curriculum Scope</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* ZICA Students */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-purple-600 to-fuchsia-700 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <School className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-purple-100/90 text-xs font-medium uppercase tracking-wider mb-2">Students in ZICA</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.zicaCount}</p>
                          <p className="text-purple-100/80 text-xs mt-1">Zica Franchise · Core Program</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-purple-100/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <Activity className="w-3.5 h-3.5 shrink-0" />
                            <span>Core Program</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* AIGT Students */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-rose-500 to-red-600 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <Building2 className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-rose-100/90 text-xs font-medium uppercase tracking-wider mb-2">AIGT Students</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.aigtCount}</p>
                          <p className="text-rose-100/80 text-xs mt-1">AIGT · Internal Courses</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-rose-100/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Internal Courses</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Non-Zica Students */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <Tag className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-orange-100/90 text-xs font-medium uppercase tracking-wider mb-2">Non-Zica Students</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.nonZicaCount}</p>
                          <p className="text-orange-100/80 text-xs mt-1">ZICA subcategory · BTC</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-orange-100/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                            <span>Non-Zica</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Active Students */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <Clock className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-cyan-100/90 text-xs font-medium uppercase tracking-wider mb-2">Active Students</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.activeCount}</p>
                          <p className="text-cyan-100/80 text-xs mt-1">In Progress</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-cyan-100/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                            <span>Ongoing Education</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Graduated Students */}
                      <Card className="relative overflow-hidden border border-slate-200/80 shadow-sm bg-gradient-to-br from-slate-600 to-slate-800 text-white">
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                          <Award className="w-16 h-16" />
                        </div>
                        <CardContent className="p-5 md:p-6">
                          <p className="text-slate-200/90 text-xs font-medium uppercase tracking-wider mb-2">Graduated Students</p>
                          <p className="text-3xl md:text-4xl font-bold tracking-tight">{analyticsData.graduatedCount}</p>
                          <p className="text-slate-200/80 text-xs mt-1">Completed Course</p>
                          <div className="mt-4 flex items-center gap-2 text-xs text-slate-200/90 bg-white/10 w-fit px-3 py-1.5 rounded-full">
                            <Award className="w-3.5 h-3.5 shrink-0" />
                            <span>Course Completed</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Admission Trend - Last 6 Months */}
                    <Card className="mt-6 border border-slate-200/80 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          Admission Trend
                          <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-200 font-normal">
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span>Last 6 months</span>
                          </Badge>
                        </CardTitle>
                        <CardDescription>Count of students by admission month</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer
                          config={{
                            count: {
                              label: "Students",
                              color: "hsl(220, 70%, 50%)",
                            },
                          } satisfies ChartConfig}
                          className="h-[280px] w-full"
                        >
                          <LineChart
                            data={analyticsData.admissionTrendData}
                            margin={{ left: 12, right: 12, top: 8, bottom: 8 }}
                          >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              dataKey="month"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tickFormatter={(value) => value.split(" ")[0]}
                            />
                            <YAxis
                              allowDecimals={false}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              domain={[0, (() => {
                                const maxCount = Math.max(...analyticsData.admissionTrendData.map((d) => d.count), 0);
                                const minScale = 10;
                                const ceiling = Math.max(minScale, Math.ceil((maxCount + 1) / 10) * 10);
                                return ceiling;
                              })()]}
                            />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                            <Line
                              dataKey="count"
                              type="monotone"
                              stroke="hsl(220, 70%, 50%)"
                              strokeWidth={2.5}
                              dot={{ fill: "hsl(220, 70%, 50%)", r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>

                    {/* Course-wise Student Distribution - Column Chart */}
                    <Card className="mt-6 border border-slate-200/80 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Course-wise Student Distribution</CardTitle>
                        <CardDescription>Count of students by course</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {analyticsData.courseDistributionChartData.length > 0 ? (
                          <AnalyticsCategoryBarChart
                            data={analyticsData.courseDistributionChartData.map((d) => ({
                              name: d.course,
                              count: d.count,
                            }))}
                            dataKey="count"
                            fill="hsl(220, 70%, 50%)"
                            valueLabel="Students"
                          />
                        ) : (
                          <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">No course data</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Business-wise Distribution - Pie Chart */}
                    <Card className="mt-6 border border-slate-200/80 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Business-wise Distribution</CardTitle>
                        <CardDescription>ZICA, Non-ZICA, AIGT student count</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {analyticsData.businessDistributionPieData.length > 0 ? (
                          <ChartContainer
                            config={{
                              zica: { label: "ZICA", color: "hsl(262, 83%, 58%)" },
                              nonZica: { label: "Non-ZICA", color: "hsl(25, 95%, 53%)" },
                              aigt: { label: "AIGT", color: "hsl(346, 77%, 50%)" },
                            } satisfies ChartConfig}
                            className="h-[280px] w-full"
                          >
                            <RechartsPieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                              <Pie
                                data={analyticsData.businessDistributionPieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                                label={({ name, percent, value }) => `${name} ${(percent * 100).toFixed(0)}% (${value})`}
                              >
                                {analyticsData.businessDistributionPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                            </RechartsPieChart>
                          </ChartContainer>
                        ) : (
                          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No business distribution data</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Course Duration Analysis - Stacked Bar Chart */}
                    <Card className="mt-6 border border-slate-200/80 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Course Duration Analysis</CardTitle>
                        <CardDescription>Student count by course and duration</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {analyticsData.courseDurationStackData.length > 0 && analyticsData.courseDurationKeys.length > 0 ? (
                          <AnalyticsStackedBarChart
                            data={analyticsData.courseDurationStackData}
                            series={analyticsData.courseDurationKeys.map((k, i) => ({
                              dataKey: k,
                              fill: ["hsl(220, 70%, 50%)", "hsl(160, 60%, 45%)", "hsl(30, 80%, 55%)", "hsl(280, 65%, 60%)", "hsl(340, 75%, 55%)"][i % 5],
                              name: k === "Not specified" ? k : `${k}m`,
                            }))}
                          />
                        ) : (
                          <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">No course duration data</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

  {/* Student Form Dialog - key forces remount so form gets fresh defaultValues (email, parentsContactNumber) */}
  <StudentForm
    key={isFormOpen ? (selectedStudent?.id ?? "create") : "closed"}
    open={isFormOpen}
    onOpenChange={setIsFormOpen}
    student={selectedStudent}
    mode={formMode}
    nextSrNo={nextSrNo}
  />

  {/* Delete Confirmation Dialog */}
  <DeleteConfirmationDialog
    open={deleteDialogOpen}
    onOpenChange={setDeleteDialogOpen}
    onConfirm={confirmDelete}
    title="Delete Student"
    description="Are you sure you want to delete"
    itemName={studentToDelete ? `${studentToDelete.firstName || ''} ${studentToDelete.lastName || ''}`.trim() : 'this student'}
    isLoading={deleteMutation.isPending}
    loadingText="Deleting..."
    confirmText="Delete Student"
  />

  {/* Success Popup */}
  <DeleteConfirmationDialog
    open={showSuccessPopup}
    onOpenChange={setShowSuccessPopup}
    onConfirm={() => setShowSuccessPopup(false)}
    title="Student Deleted Successfully"
    description="has been successfully deleted from the system."
    itemName={deletedStudentName || 'The student'}
    variant="success"
  />
  </div>
  </div>
);
}
