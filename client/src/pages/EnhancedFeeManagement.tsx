import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {  Table, TableBody, TableCell, TableHead, TableHeader, TableRow  } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import {
  assignContiguousSerialsToOrderedList,
  getNextSerialNumberFromItems,
  parseSerialNumber,
  DEFAULT_DATE_SORT,
} from "@/lib/serialNumberUtils";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AnalyticsCategoryBarChart } from '@/components/charts/AnalyticsCharts';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ComposedChart,
} from 'recharts';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  Clock,
  Users,
  FileText,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Save,
  X,
  RefreshCw,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Receipt,
  Send,
  Bell,
  User,
  Phone,
  Mail,
  MapPin,
  Calculator,
  Target,
  Award,
  Star,
  Bookmark,
  Share2,
  Copy,
  Archive,
  Tag,
  History,
  Settings,
  FileDown,
  CalendarDays,
  Wallet,
  Banknote,
  Coins,
  Percent,
  Minus,
  Plus as PlusIcon,
  ChevronDown,
  FileSpreadsheet,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Building2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { 
  collection, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  limit,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseListenerManager } from '@/lib/firebaseListenerManager';
import { FirebaseService } from '@/lib/firebaseService';
import { firebaseHelpers } from '@/lib/firebaseHelpers';
import { resolveOrGenerateReceiptNumber, getReceiptFieldName, isUsableReceiptNumber, resolveReceiptBrand } from '@/lib/receiptCounterService';
import {
  createGstRecordIfNotExists,
  isLegacyRandomGstInvoiceNumber,
  isValidReceiptOrInvoiceNumber,
} from '@/lib/gstRecordService';
import { INSTALLMENT_AMOUNT_FIELDS, INSTALLMENT_DUE_DATE_FIELDS, INSTALLMENT_RECEIPT_FIELDS, MAX_INSTALLMENTS } from '@/constants/feeInstallments';
import { 
  ALL_STANDARDIZED_COURSES, 
  MODULAR_PROGRAMS 
} from "@/lib/leadDataCleaningService";
import { 
  formatDate, 
  formatDateForInput 
} from '@/utils/dateUtils';
import { buildThisMonthDueEntries } from '@/utils/feeInstallmentSchedule';
import Loading, { InlineLoading } from '@/components/ui/loading';
import FeeDetailsDialog from '@/components/fee-management/FeeDetailsDialog';
import * as XLSX from 'xlsx';
import ManualReceiptGenerator from '@/components/fee-management/ManualReceiptGenerator';
import { resetBettercodeReceiptCounter, renumberBettercodeReceipts, decrementReceiptCounter, resetZicaReceiptCounter } from '@/lib/receiptCounterService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import whatsappIcon from '@/assets/whatsapp-color-svgrepo-com.svg';

const AnnualGst = lazy(() => import('@/components/fee-management/AnnualGst'));

interface FeeRecord {
  id: string;
  srNo: number;
  studentName: string;
  source: string;
  parentsContactNumber?: string;
  contactNumber: string;
  admissionMonth: string;
  dateOfAdmission: string;
  zicaBettercode?: 'Zica' | 'AIGT' | 'ZICA' | 'BETTERCODE' | 'Non-ZICA';
  feesStructure?: 'OLD' | 'NEW';
  course: string;
  courseDuration: string;
  courseStartDate: string;
  actualFees: number;
  discountedFees: number;
  feesPaid: number;
  feesPaidDate?: string;
  feesBalance: number;
  registrationAmount: number;
  installment01?: number;
  installment02?: number;
  installment03?: number;
  installment04?: number;
  installment05?: number;
  installment06?: number;
  installment07?: number;
  installment08?: number;
  installment09?: number;
  installment10?: number;
  installment11?: number;
  installment12?: number;
  registrationReceiptNumber?: string;
  installment01ReceiptNumber?: string;
  installment02ReceiptNumber?: string;
  installment03ReceiptNumber?: string;
  installment04ReceiptNumber?: string;
  installment05ReceiptNumber?: string;
  installment06ReceiptNumber?: string;
  installment07ReceiptNumber?: string;
  installment08ReceiptNumber?: string;
  installment09ReceiptNumber?: string;
  installment10ReceiptNumber?: string;
  installment11ReceiptNumber?: string;
  installment12ReceiptNumber?: string;
  fullPaymentReceiptNumber?: string;
  receiptNumber?: string;
  paymentMode: 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Cheque';
  numberOfInstallments: number;
  balanceInstallments: number;
  dueDate?: string;
  remarks?: string;
  installmentDetails?: string;
  chequeNumber?: string;
  studentId?: string;
  centreId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  /** Dynamic installment fields (installment13..installment36, receipt numbers, due dates) */
  [key: string]: unknown;
}

interface GSTInvoice {
  id: string;
  studentName: string;
  course: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  invoiceDate: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid';
}

interface GSTInvoiceRecord {
  id: string;
  date: string;
  partyName: string;
  totalInvoice: number;
  basicAmount: number;
  gst: number;
  invoiceNumbers: string[]; // Changed to array to support multiple invoice numbers
  hsn: string;
  b2bB2c: 'B2B' | 'B2C';
  companyName: string;
  month: string;
  year: number;
  studentId: string;
  installmentType: string;
  uniqueKey?: string; // Optional unique identifier for duplicate detection
  createdAt: Date;
  updatedAt: Date;
  centreId: string;
}

// ZICA/ZIMA Courses - All standardized courses
const zicaZimaCourses = Array.from(new Set([...ALL_STANDARDIZED_COURSES, ...MODULAR_PROGRAMS]));

// Bettercode Courses
const bettercodeCourses = [
  "AI/ML",
  "Javascript",
  "Full Stack",
  "Gen AI",
  "PowerBI",
  "SQL",
  "MYSQL",
  "C",
  "C++",
  "HTML",
  "CSS",
  "Data Analytics",
  "Java",
  "Flutter",
  "ETL/Informatica",
  "Python",
  "School Python",
  "Web Development",
  "School AI",
  "School Java",
  "Testing/Automation",
  "Adv. Excel",
  "Tableau",
  "ReactJS"
];

/** Remark tooltip content for This Month's Due rows (remark + Edit only) */
function RemarkTooltipContent({
  record,
  onEditRemark,
}: {
  record: { remarks?: string };
  onEditRemark: () => void;
}) {
  return (
    <div className="space-y-2 py-1">
      <p className="text-sm font-medium">Remark</p>
      <p className="text-sm whitespace-pre-wrap">{record.remarks?.trim() || 'No remark added.'}</p>
      <Button size="sm" variant="secondary" className="w-full mt-2 bg-violet-200 hover:bg-violet-300 text-violet-900 border-0" onClick={onEditRemark}>
        <Edit className="w-3 h-3 mr-1" /> Edit
      </Button>
    </div>
  );
}

export default function EnhancedFeeManagement() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  // Course selection state
  const [courses, setCourses] = useState<string[]>([]);
  const [customCourses, setCustomCourses] = useState<string[]>([]);
  const [showCustomCourseInput, setShowCustomCourseInput] = useState(false);
  const [customCourseInput, setCustomCourseInput] = useState("");
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [installmentsPaidInput, setInstallmentsPaidInput] = useState(0);
  const [feeActiveTab, setFeeActiveTab] = useState<'records' | 'analytics' | 'monthly-due' | 'annual-gst'>('records');

  // Helper function to safely convert any value to a renderable string
  const safeRender = (value: any): string => {
    // Handle null/undefined
    if (value === null || value === undefined) return '-';
    
    // Handle Firestore Timestamp with toDate method
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      try {
        return formatDate(value.toDate());
      } catch (e) {
        return '-';
      }
    }
    
    // Handle Firestore Timestamp with seconds and nanoseconds (serialized format)
    if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
      try {
        const date = new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
        if (!isNaN(date.getTime())) {
          return formatDate(date);
        }
      } catch (e) {
        // Fall through to default handling
      }
    }
    
    // Handle Date object
    if (value instanceof Date) {
      return formatDate(value);
    }
    
    // If it's a string that looks like a date YYYY-MM-DD, format it
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatDate(value);
    }
    
    // Handle primitive types
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    
    // For any other object, try to convert to string safely
    // This prevents React error #31 by never rendering objects directly
    try {
      if (typeof value === 'object') {
        // If it's an object that might be a Timestamp but wasn't caught above, return '-'
        return '-';
      }
      return String(value);
    } catch (e) {
      return '-';
    }
  };
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [gstRecords, setGstRecords] = useState<GSTInvoiceRecord[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<FeeRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isGSTDialogOpen, setIsGSTDialogOpen] = useState(false);
  const [expandedGstMonths, setExpandedGstMonths] = useState<Set<string>>(new Set());
  const gstMonthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [isGSTEditDialogOpen, setIsGSTEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FeeRecord | null>(null);
  const [isRemarkEditDialogOpen, setIsRemarkEditDialogOpen] = useState(false);
  const [editingRemarkRecordId, setEditingRemarkRecordId] = useState<string | null>(null);
  const [remarkEditValue, setRemarkEditValue] = useState('');

  // Sync viewingRecord and editingRecord with feeRecords when it updates
  useEffect(() => {
    if (viewingRecord) {
      const updated = feeRecords.find(r => r.id === viewingRecord.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(viewingRecord)) {
        setViewingRecord(updated);
      }
    }
    if (editingRecord) {
      const updated = feeRecords.find(r => r.id === editingRecord.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(editingRecord)) {
        setEditingRecord(updated);
      }
    }
  }, [feeRecords]);
  const [editingGSTRecord, setEditingGSTRecord] = useState<GSTInvoiceRecord | null>(null);
  const [gstEditFormData, setGstEditFormData] = useState({
    invoiceNumbers: [] as string[],
    b2bB2c: 'B2C' as 'B2B' | 'B2C',
    companyName: '',
    date: '' as string
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    admissionMonth: 'all',
    source: 'all',
    paymentMode: 'all',
    feesBalance: 'all',
    zicaBettercode: 'all',
    feesStructure: 'all'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [gstInvoices, setGstInvoices] = useState<GSTInvoice[]>([]);
  const [creatingGSTRecord, setCreatingGSTRecord] = useState(false);
  const [gstCreationLock, setGstCreationLock] = useState(new Set<string>());
  const [numberOfInstallments, setNumberOfInstallments] = useState(0);
  const [gstProcessingQueue, setGstProcessingQueue] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState<{ fee?: string; gst?: string } | null>(null);
  const errorLoggedRef = useRef<{ fee: boolean; gst: boolean }>({ fee: false, gst: false });
  
  // Persistent lock for GST creation that survives re-renders (prevents StrictMode duplicates)
  const gstCreationLockRef = useRef<Set<string>>(new Set());

  // Student suggestions when no fee records exist for current search
  interface StudentSuggestion {
    id: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    admissionMonth?: string;
    admissionDate?: any;
    zicaZima?: string;
    feesStructure?: string;
    course?: string;
    courseDuration?: string;
    courseStartDate?: any;
    actualFees?: number | string;
    discountedFees?: number | string;
    feesPaid?: number | string;
    feesPaidDate?: any;
    feesBalance?: number | string;
    paymentMode?: string;
    noOfInstallments?: number | string;
    installmentsPaid?: number | string;
    dueDate?: any;
    remarks?: string;
    centreId?: string;
    [key: string]: any;
  }

  const [studentSuggestions, setStudentSuggestions] = useState<StudentSuggestion[]>([]);
  const [isStudentSearchLoading, setIsStudentSearchLoading] = useState(false);

  // Manual Receipt State
  const [isManualReceiptDialogOpen, setIsManualReceiptDialogOpen] = useState(false);
  const [selectedReceiptBrand, setSelectedReceiptBrand] = useState<'Zica' | 'AIGT' | 'ZICA' | 'BETTERCODE' | null>(null);

  // Debounce search term to reduce re-renders and prepare for server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const feeForm = useForm<FeeRecord>({
    defaultValues: {
      studentName: '',
      contactNumber: '',
      parentsContactNumber: '',
      source: '',
      admissionMonth: '',
      dateOfAdmission: '',
      zicaBettercode: undefined,
      feesStructure: undefined,
      course: '',
      courseDuration: '',
      courseStartDate: '',
      actualFees: '' as any, // Use empty string to show empty field
      discountedFees: '' as any,
      feesPaid: '' as any,
      feesPaidDate: '',
      feesBalance: '' as any,
      registrationAmount: '' as any,
      installment01: '' as any,
      installment02: '' as any,
      installment03: '' as any,
      installment04: '' as any,
      installment05: '' as any,
      installment06: '' as any,
      installment07: '' as any,
      installment08: '' as any,
      installment09: '' as any,
      installment10: '' as any,
      installment11: '' as any,
      installment12: '' as any,
      paymentMode: 'UPI',
      numberOfInstallments: 0,
      balanceInstallments: '' as any,
      dueDate: '',
      remarks: '',
      installmentDetails: '',
      chequeNumber: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: ''
    }
  });

  // Load custom courses from Firestore
  useEffect(() => {
    const loadCustomCourses = async () => {
      try {
        const customCoursesQuery = query(collection(db, 'customCourses'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(customCoursesQuery);
        const loadedCourses = snapshot.docs.map(doc => doc.data().courseName);
        setCustomCourses(loadedCourses);
      } catch (error) {
        console.error('Error loading custom courses:', error);
      }
    };
    loadCustomCourses();
  }, []);

  // Update courses based on selected program
  const zicaBettercode = feeForm.watch('zicaBettercode');
  useEffect(() => {
    let baseCourses: string[] = [];
    
    if (zicaBettercode === 'Zica' || zicaBettercode === 'ZICA' || zicaBettercode === 'BETTERCODE' || zicaBettercode === 'AIGT') {
        if (zicaBettercode === 'Zica' || zicaBettercode === 'ZICA') {
             baseCourses = [...zicaZimaCourses];
        } else {
             baseCourses = [...bettercodeCourses];
        }
    } else {
      // Default to all courses if no program selected
      baseCourses = [...zicaZimaCourses, ...bettercodeCourses];
    }
    
    // Add custom courses and "Other" option
    const allCourses = [...baseCourses, ...customCourses, "Other"];
    setCourses(Array.from(new Set(allCourses)));
  }, [zicaBettercode, customCourses]);

  // Calculate fees balance
  const actualFees = parseFloat(feeForm.watch("actualFees")?.toString() || "0");
  const discountedFees = parseFloat(feeForm.watch("discountedFees")?.toString() || "0");
  const feesPaid = parseFloat(feeForm.watch("feesPaid")?.toString() || "0");
  const payableFees = Math.round(((discountedFees > 0 ? discountedFees : actualFees) + Number.EPSILON) * 100) / 100;
  const feesBalance = Math.round((Math.max(0, payableFees - feesPaid) + Number.EPSILON) * 100) / 100;

  useEffect(() => {
    if (actualFees > 0 || discountedFees > 0 || feesPaid > 0) {
      feeForm.setValue("feesBalance", feesBalance);
    }
  }, [actualFees, discountedFees, feesPaid, feesBalance, feeForm]);

  // Calculate balance installments
  const noOfInstallments = parseInt(feeForm.watch("numberOfInstallments")?.toString() || "0");
  
  useEffect(() => {
    if (noOfInstallments > 0) {
      const balance = Math.max(0, noOfInstallments - installmentsPaidInput);
      feeForm.setValue("balanceInstallments", balance);
    }
  }, [noOfInstallments, installmentsPaidInput, feeForm]);
  
  // Watch installment fields to auto-update number of installments
  const watchedInstallments = feeForm.watch([
    'installment01', 'installment02', 'installment03', 'installment04',
    'installment05', 'installment06', 'installment07', 'installment08',
    'installment09', 'installment10', 'installment11', 'installment12'
  ]);
  
  // Auto-update number of installments when installment values change
  // DISABLED: This was causing the Number of Installments to change automatically
  // when users filled individual installment fields, which was not desired behavior
  // useEffect(() => {
  //   const filledInstallments = watchedInstallments.filter(value => 
  //     value && value > 0
  //   ).length;
    
  //   // Only auto-update if there are filled installments
  //   // This helps when user fills installment fields manually
  //   if (filledInstallments > 0) {
  //     setNumberOfInstallments(filledInstallments);
  //     feeForm.setValue('numberOfInstallments', filledInstallments);
  //   }
  // }, [watchedInstallments, feeForm]);

  // Ensure form is populated when editingRecord changes
  useEffect(() => {
    if (editingRecord && isEditDialogOpen) {
      // Always reset form and set numberOfInstallments when editing
      feeForm.reset(editingRecord);
      const installments = editingRecord.numberOfInstallments || 0;
      setNumberOfInstallments(installments);
      
      // Recalculate feesBalance from discountedFees - feesPaid
      const discountedFees = Number(editingRecord.discountedFees) || 0;
      const feesPaid = Number(editingRecord.feesPaid) || 0;
      const calculatedBalance = discountedFees - feesPaid;
      feeForm.setValue('feesBalance', calculatedBalance);
    } else if (!isEditDialogOpen) {
      // Reset numberOfInstallments when dialog closes
      setNumberOfInstallments(0);
    }
  }, [editingRecord, isEditDialogOpen, feeForm]);

  // Sync numberOfInstallments state with form value
  useEffect(() => {
    const subscription = feeForm.watch((value, { name }) => {
      if (name === 'numberOfInstallments') {
        const formValue = Number(value.numberOfInstallments) || 0;
        if (formValue !== numberOfInstallments) {
          setNumberOfInstallments(formValue);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [feeForm, numberOfInstallments]);

  // Auto-calculate feesBalance = discountedFees - feesPaid
  useEffect(() => {
    const subscription = feeForm.watch((value, { name }) => {
      // Only recalculate when discountedFees or feesPaid changes
      if (name === 'discountedFees' || name === 'feesPaid') {
        const discountedFees = Number(value.discountedFees) || 0;
        const feesPaid = Number(value.feesPaid) || 0;
        const calculatedBalance = discountedFees - feesPaid;
        
        // Only update if the calculated value is different from current value
        const currentBalance = Number(feeForm.getValues('feesBalance')) || 0;
        if (calculatedBalance !== currentBalance) {
          feeForm.setValue('feesBalance', calculatedBalance);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [feeForm]);

  // Live calculation of remaining installment balance to show as hint in UI
  const watchedFieldsForDist = feeForm.watch([...INSTALLMENT_AMOUNT_FIELDS, 'feesBalance', 'balanceInstallments'] as any);
  const balanceInstallmentsLive = Number(feeForm.getValues('balanceInstallments')) || 0;
  const paidCountLive = Math.max(0, numberOfInstallments - balanceInstallmentsLive);
  const firstUnpaidIndexLive = paidCountLive;
  // When some installments are paid, show only the sum of UNPAID installment amounts (do not use full target)
  const useUnpaidOnly = balanceInstallmentsLive > 0 && balanceInstallmentsLive < numberOfInstallments;
  // Use Fees Balance (amount left to pay) for installment target, not Discounted Fees
  const targetForInstallmentsLive = Number(feeForm.getValues('feesBalance')) || 0;
  const currentInstallmentsSumLive = INSTALLMENT_AMOUNT_FIELDS.slice(0, numberOfInstallments).reduce((sum, field) => {
    return sum + (Number(feeForm.getValues(field as any)) || 0);
  }, 0);
  const unpaidSumLive = useUnpaidOnly
    ? INSTALLMENT_AMOUNT_FIELDS.slice(firstUnpaidIndexLive, numberOfInstallments).reduce((sum, field) => sum + (Number(feeForm.getValues(field as any)) || 0), 0)
    : 0;
  const remainingDistributableLive = useUnpaidOnly
    ? parseFloat(unpaidSumLive.toFixed(2))
    : parseFloat((targetForInstallmentsLive - currentInstallmentsSumLive).toFixed(2));

  // Function to update student record when fee record is updated
  const updateStudentRecord = async (feeRecord: FeeRecord) => {
    try {
      if (!feeRecord.studentId) {
        // No studentId link, skip update
        return;
      }
      
      // Find the student record by studentId
      const studentDocRef = doc(db, 'students', feeRecord.studentId);
      const studentDoc = await getDoc(studentDocRef);
      
      if (!studentDoc.exists()) {
        // Student record not found, skip update
        return;
      }
      
      // Convert fee record data to student format
      const studentNameParts = feeRecord.studentName.trim().split(' ');
      const firstName = studentNameParts[0] || '';
      const lastName = studentNameParts.slice(1).join(' ') || '';
      
      // Convert zicaBettercode to zicaZima format
      let zicaZima = '';
      let zicaSubCategory = '';
      
      if (feeRecord.zicaBettercode === 'AIGT' || feeRecord.zicaBettercode === 'BETTERCODE') {
        zicaZima = 'AIGT';
      } else if (feeRecord.zicaBettercode === 'ZICA' || feeRecord.zicaBettercode === 'Non-ZICA') {
        zicaZima = 'ZICA';
        if (feeRecord.zicaBettercode === 'Non-ZICA') {
          zicaSubCategory = 'Non-ZICA';
        }
      }
      
      // Convert feesStructure to student format
      let feesStructure = '';
      if (feeRecord.feesStructure === 'OLD') {
        feesStructure = 'Full Payment';
      } else if (feeRecord.feesStructure === 'NEW') {
        feesStructure = feeRecord.numberOfInstallments > 0 ? 'Installment' : 'Partial';
      }
      
      // Convert admission month from format like "JANUARY" to "January YYYY"
      let admissionMonth = feeRecord.admissionMonth || '';
      if (admissionMonth && !admissionMonth.includes(' ')) {
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthIndex = monthNames.findIndex(m => m.toUpperCase() === admissionMonth);
        if (monthIndex !== -1) {
          admissionMonth = `${monthNames[monthIndex]} ${new Date().getFullYear()}`;
        }
      }
      
      // Convert dateOfAdmission to Date
      let admissionDate: Date | null = null;
      const dateOfAdmission = feeRecord.dateOfAdmission as any;
      if (dateOfAdmission) {
        if (dateOfAdmission instanceof Date) {
          admissionDate = dateOfAdmission;
        } else if (typeof dateOfAdmission === 'string') {
          admissionDate = new Date(dateOfAdmission);
        } else if (typeof dateOfAdmission === 'object' && 'toDate' in dateOfAdmission) {
          admissionDate = dateOfAdmission.toDate();
        }
      }
      
      // Convert courseStartDate to Date
      let courseStartDate: Date | null = null;
      const courseStartDateVal = feeRecord.courseStartDate as any;
      if (courseStartDateVal) {
        if (courseStartDateVal instanceof Date) {
          courseStartDate = courseStartDateVal;
        } else if (typeof courseStartDateVal === 'string') {
          courseStartDate = new Date(courseStartDateVal);
        } else if (typeof courseStartDateVal === 'object' && 'toDate' in courseStartDateVal) {
          courseStartDate = courseStartDateVal.toDate();
        }
      }
      
      // Convert feesPaidDate to Date
      let feesPaidDate: Date | null = null;
      const feesPaidDateVal = feeRecord.feesPaidDate as any;
      if (feesPaidDateVal) {
        if (feesPaidDateVal instanceof Date) {
          feesPaidDate = feesPaidDateVal;
        } else if (typeof feesPaidDateVal === 'string') {
          feesPaidDate = new Date(feesPaidDateVal);
        } else if (typeof feesPaidDateVal === 'object' && 'toDate' in feesPaidDateVal) {
          feesPaidDate = feesPaidDateVal.toDate();
        }
      }
      
      // Convert dueDate to Date
      let dueDate: Date | null = null;
      const dueDateVal = feeRecord.dueDate as any;
      if (dueDateVal) {
        if (dueDateVal instanceof Date) {
          dueDate = dueDateVal;
        } else if (typeof dueDateVal === 'string') {
          dueDate = new Date(dueDateVal);
        } else if (typeof dueDateVal === 'object' && 'toDate' in dueDateVal) {
          dueDate = dueDateVal.toDate();
        }
      }
      
      // Prepare student update data
      const studentUpdateData: any = {
        firstName: firstName,
        lastName: lastName,
        phone: feeRecord.contactNumber,
        course: feeRecord.course,
        courseDuration: feeRecord.courseDuration ? parseFloat(feeRecord.courseDuration) : null,
        courseStartDate: courseStartDate,
        admissionMonth: admissionMonth,
        admissionDate: admissionDate,
        zicaZima: zicaZima,
        zicaSubCategory: zicaSubCategory,
        feesStructure: feesStructure,
        actualFees: feeRecord.actualFees || 0,
        discountedFees: feeRecord.discountedFees || feeRecord.actualFees || 0,
        feesPaid: feeRecord.feesPaid || 0,
        feesPaidDate: feesPaidDate,
        feesBalance: feeRecord.feesBalance || 0,
        paymentMode: feeRecord.paymentMode || 'Cash',
        chequeNumber: feeRecord.chequeNumber || '',
        noOfInstallments: feeRecord.numberOfInstallments || 0,
        balanceInstallments: feeRecord.balanceInstallments || 0,
        remainingInstallments: feeRecord.balanceInstallments || 0,
        dueDate: dueDate,
        remarks: feeRecord.remarks || '',
        updatedAt: new Date(),
      };
      
      // Update the student record using firebaseHelpers which handles cache invalidation
      await firebaseHelpers.updateStudent(feeRecord.studentId, studentUpdateData);
    } catch (error: any) {
      // Handle quota errors gracefully
      if (error?.code === 'resource-exhausted' || 
          error?.code === 'quota-exceeded' ||
          error?.message?.toLowerCase().includes('quota') ||
          error?.message?.toLowerCase().includes('resource exhausted')) {
        console.warn('⚠️ Firebase quota limit reached. Student sync skipped to prevent quota issues.');
        // Don't throw - fee update should still succeed
        return;
      }
      console.error('Error updating student record:', error);
      // Don't throw error, just log it - fee update should still succeed
    }
  };

  // Handle admission month change to auto-update date of admission
  const handleQuickUpdate = async (updatedRecord: FeeRecord, paymentDetails?: { amount: number; installmentType: string; paymentMode: string; receiptType?: string; feesPaidDate?: string }) => {
    try {
      // Receipt number should already be set in updatedRecord from FeeDetailsDialog
      // Just extract it for GST record creation
      let receiptNumber = '';
      let fieldName: string | null = null;

      if (paymentDetails?.receiptType) {
        fieldName = getReceiptFieldName(paymentDetails.receiptType);
        
        // 1. Try to get from updatedRecord (passed from FeeDetailsDialog)
        if (fieldName && isUsableReceiptNumber((updatedRecord as any)[fieldName])) {
          receiptNumber = (updatedRecord as any)[fieldName];
          console.log('✅ Using receipt number from updatedRecord:', receiptNumber, 'for field:', fieldName);
        } 
        
        // 2. Fallback: try to generate via service if not already set
        if (!isUsableReceiptNumber(receiptNumber)) {
          try {
            const result = await resolveOrGenerateReceiptNumber(
              db,
              updatedRecord.id,
              paymentDetails.receiptType,
              updatedRecord as Record<string, unknown>
            );
            receiptNumber = result.receiptNumber;
            if (fieldName) {
              (updatedRecord as any)[fieldName] = receiptNumber;
            }
            console.log('⚠️ Generated receipt number in fallback:', receiptNumber);
          } catch (e) {
            console.warn('Could not generate receipt number via service:', e);
            toast({
              title: "Receipt number unavailable",
              description: "Could not generate receipt. Please try again or use Receipt button later. ZICA/BTC logic is used by the service.",
              variant: "destructive",
            });
          }
        }
      }

      // Calculate new balance
      const feesPaid = Number(updatedRecord.feesPaid) || 0;
      const discountedFees = Number(updatedRecord.discountedFees) || 0;
      updatedRecord.feesBalance = Math.max(0, discountedFees - feesPaid);
      updatedRecord.updatedAt = new Date();
      // Always use Fees Paid Date from Mark Payment dialog when provided (so receipt and GST use entered date, not today)
      if (paymentDetails?.feesPaidDate && /^\d{4}-\d{2}-\d{2}/.test(String(paymentDetails.feesPaidDate).trim())) {
        (updatedRecord as any).feesPaidDate = String(paymentDetails.feesPaidDate).trim().split('T')[0];
      } else if (paymentDetails?.receiptType && !(updatedRecord as any).feesPaidDate) {
        const d = new Date();
        (updatedRecord as any).feesPaidDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      // Update Firestore with ALL relevant fields from the updatedRecord
      // This ensures receipt numbers and other fields updated in the dialog are saved
      const feeDocRef = doc(db, 'fees', updatedRecord.id);
      
      // Prepare a clean update object by removing non-serializable or ID fields
      const { id, ...updateData } = updatedRecord;
      
      // Filter out functions or large nested objects if any
      const cleanUpdateData: any = {};
      Object.keys(updateData).forEach(key => {
        const val = (updateData as any)[key];
        if (typeof val !== 'function' && key !== 'id') {
          cleanUpdateData[key] = val === undefined ? null : val;
        }
      });

      await updateDoc(feeDocRef, {
        ...cleanUpdateData,
        updatedAt: updatedRecord.updatedAt
      });
      
      // Update local state immediately so This Month's Due reflects due-date / payment changes
      setFeeRecords((prev) =>
        prev.map((r) =>
          r.id === updatedRecord.id ? ({ ...r, ...updatedRecord } as FeeRecord) : r
        )
      );
      
      // If viewing this record, update the view state too
      if (viewingRecord && viewingRecord.id === updatedRecord.id) {
        setViewingRecord(updatedRecord);
      }

      // Sync student record when fee record is updated
      const studentId = (updatedRecord as any).studentId;
      if (studentId) {
        try {
          await updateStudentRecord({ ...updatedRecord, id: updatedRecord.id, studentId });
        } catch (studentError) {
          console.warn("Failed to sync student record:", studentError);
          // Don't fail the whole update if student sync fails
        }
      }

      // NOTE: GST record creation has been REMOVED from payment confirmation flow
      // GST records should ONLY be created when the user clicks the "Receipt" button
      // This prevents duplicate GST entries with different logic
      // The Receipt button handler in FeeDetailsDialog.tsx will create the GST record

      toast({ title: "Success", description: "Payment status updated successfully!" });
    } catch (error) {
      console.error("Error updating fee record:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleAdmissionMonthChange = (month: string) => {
    if (month && month !== 'all') {
      const currentYear = new Date().getFullYear();
      const monthIndex = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'].indexOf(month);
      
      if (monthIndex !== -1) {
        // Set to the 1st day of the selected month
        const defaultDate = new Date(currentYear, monthIndex, 1);
        const formattedDate = defaultDate.toISOString().split('T')[0];
        
        feeForm.setValue('dateOfAdmission', formattedDate);
        feeForm.setValue('admissionMonth', month);
      }
    }
  };

  const handleNumberOfInstallmentsChange = (value: number) => {
    // This is the ONLY place where numberOfInstallments should change
    // It should only be triggered by manual user input in the Number of Installments field
    
    // Ensure value is within valid range
    const validValue = Math.max(0, Math.min(12, value));
    
    // Update state (this will trigger re-render)
    setNumberOfInstallments(validValue);
    
    // Clear installment fields and due dates that are beyond the new number
    for (let i = validValue; i < MAX_INSTALLMENTS; i++) {
        if (i < INSTALLMENT_AMOUNT_FIELDS.length) {
            feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[i] as any, '');
        }
        if (i < INSTALLMENT_DUE_DATE_FIELDS.length) {
            feeForm.setValue(INSTALLMENT_DUE_DATE_FIELDS[i] as any, '');
        }
    }
    
    // If setting to 0, clear all installment fields and due dates
    if (validValue === 0) {
      INSTALLMENT_AMOUNT_FIELDS.forEach(field => {
        feeForm.setValue(field as any, '');
      });
      INSTALLMENT_DUE_DATE_FIELDS.forEach(field => {
        feeForm.setValue(field as any, '');
      });
      return;
    }
    
    // Auto-distribute installments: (feesBalance - 5900) / numberOfInstallments
    const feesBalance = Number(feeForm.getValues('feesBalance')) || 0;
    const registrationFee = 5900;
    const balanceForInstallments = feesBalance - registrationFee;
    
    // Get base date for due dates (Admission Date or Today)
    const admissionDateVal = feeForm.getValues('dateOfAdmission');
    const baseDate = admissionDateVal ? new Date(admissionDateVal) : new Date();

    if (balanceForInstallments > 0 && validValue > 0) {
      // Calculate equal distribution
      const equalAmount = parseFloat((balanceForInstallments / validValue).toFixed(2));
      const totalDistributed = parseFloat((equalAmount * (validValue - 1)).toFixed(2));
      const lastAmount = parseFloat((balanceForInstallments - totalDistributed).toFixed(2));
      
      // Distribute amounts and set due dates
      for (let i = 0; i < validValue && i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
        const installmentAmount = i === validValue - 1 ? lastAmount : equalAmount;
        feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[i] as any, installmentAmount);
        
        // Set default due dates (1 month apart)
        if (i < INSTALLMENT_DUE_DATE_FIELDS.length) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(baseDate.getMonth() + (i + 1));
            // Default to same day of month or 15th if today is after 28th? 
            // Let's just use same day of month for consistency with FeeDetailsDialog setup
            const y = dueDate.getFullYear();
            const m = String(dueDate.getMonth() + 1).padStart(2, '0');
            const d = String(dueDate.getDate()).padStart(2, '0');
            feeForm.setValue(INSTALLMENT_DUE_DATE_FIELDS[i] as any, `${y}-${m}-${d}`);
        }
      }
    } else if (validValue > 0) {
        // Even if balance is 0, still set the due dates
        for (let i = 0; i < validValue && i < INSTALLMENT_DUE_DATE_FIELDS.length; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(baseDate.getMonth() + (i + 1));
            const y = dueDate.getFullYear();
            const m = String(dueDate.getMonth() + 1).padStart(2, '0');
            const d = String(dueDate.getDate()).padStart(2, '0');
            feeForm.setValue(INSTALLMENT_DUE_DATE_FIELDS[i] as any, `${y}-${m}-${d}`);
        }
    }
  };

  const handleManualInstallmentChange = (index: number, value: string) => {
    const newValue = parseFloat(value) || 0;
    const fieldName = INSTALLMENT_AMOUNT_FIELDS[index] as any;
    const numInstallments = Number(feeForm.getValues('numberOfInstallments')) || 0;
    const currentValues = feeForm.getValues();
    const balanceInstallments = Number(currentValues.balanceInstallments) || 0;
    const paidCount = Math.max(0, numInstallments - balanceInstallments);

    // Set the edited installment's new value first
    feeForm.setValue(fieldName, newValue);

    // --- Smart mode: there are both paid AND unpaid installments ---
    // Only redistribute the remaining balance among the SUBSEQUENT unpaid installments
    if (balanceInstallments > 0 && index >= paidCount) {
      // Sum of ALL unpaid installment amounts (before this edit) is our "pool"
      // But we need to figure out what's left after this installment for subsequent ones
      const feesBalance = Number(currentValues.feesBalance) || 0;

      // Calculate total already filled in unpaid slots before this index (paidCount..index-1)
      let sumBeforeIndex = 0;
      for (let i = paidCount; i < index; i++) {
        sumBeforeIndex += Number(currentValues[INSTALLMENT_AMOUNT_FIELDS[i] as any]) || 0;
      }

      // Remaining to distribute to slots AFTER this one = feesBalance - sumBeforeIndex - newValue
      const remainingAfterThisSlot = feesBalance - sumBeforeIndex - newValue;

      // Collect subsequent UNPAID slot indices (after this edited slot)
      const subsequentUnpaidIndices: number[] = [];
      for (let i = index + 1; i < numInstallments; i++) {
        subsequentUnpaidIndices.push(i);
      }

      if (remainingAfterThisSlot <= 0) {
        // No remaining amount — zero out all subsequent unpaid slots
        subsequentUnpaidIndices.forEach(i => {
          feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[i] as any, 0);
        });
      } else if (subsequentUnpaidIndices.length > 0) {
        // Distribute remaining evenly across subsequent unpaid slots
        const count = subsequentUnpaidIndices.length;
        const equalAmount = parseFloat((remainingAfterThisSlot / count).toFixed(2));
        const totalDistributed = parseFloat((equalAmount * (count - 1)).toFixed(2));
        const lastAmount = parseFloat((remainingAfterThisSlot - totalDistributed).toFixed(2));
        subsequentUnpaidIndices.forEach((idx, pos) => {
          const amount = pos === count - 1 ? lastAmount : equalAmount;
          feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[idx] as any, amount);
        });
      } else if (remainingAfterThisSlot > 0 && numInstallments < MAX_INSTALLMENTS) {
        // This was the last unpaid slot — add a new extra installment for the remainder
        const newTotalInstallments = numInstallments + 1;
        setNumberOfInstallments(newTotalInstallments);
        feeForm.setValue('numberOfInstallments', newTotalInstallments);
        feeForm.setValue('balanceInstallments', balanceInstallments + 1);
        feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[numInstallments] as any, parseFloat(remainingAfterThisSlot.toFixed(2)));
        const admissionDateVal = feeForm.getValues('dateOfAdmission');
        const baseDate = admissionDateVal ? new Date(admissionDateVal) : new Date();
        const dueDate = new Date(baseDate);
        dueDate.setMonth(baseDate.getMonth() + newTotalInstallments);
        const y = dueDate.getFullYear();
        const m = String(dueDate.getMonth() + 1).padStart(2, '0');
        const d = String(dueDate.getDate()).padStart(2, '0');
        feeForm.setValue(INSTALLMENT_DUE_DATE_FIELDS[numInstallments] as any, `${y}-${m}-${d}`);
      }
      return;
    }

    // --- Default mode: all installments are unpaid (no paid ones) ---
    // Use Fees Balance as the target total; redistribute from this slot onwards
    const targetTotal = Number(currentValues.feesBalance) || 0;
    let sumUpToHere = 0;
    for (let i = 0; i < index; i++) {
      sumUpToHere += Number(currentValues[INSTALLMENT_AMOUNT_FIELDS[i] as any]) || 0;
    }
    sumUpToHere += newValue;

    const remainingToDistribute = targetTotal - sumUpToHere;
    const remainingCount = numInstallments - (index + 1);

    if (remainingCount > 0) {
      if (remainingToDistribute <= 0) {
        for (let i = index + 1; i < numInstallments; i++) {
          feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[i] as any, 0);
        }
      } else {
        const equalAmount = parseFloat((remainingToDistribute / remainingCount).toFixed(2));
        const totalDistributed = parseFloat((equalAmount * (remainingCount - 1)).toFixed(2));
        const lastAmount = parseFloat((remainingToDistribute - totalDistributed).toFixed(2));
        for (let i = index + 1; i < numInstallments; i++) {
          const amount = i === numInstallments - 1 ? lastAmount : equalAmount;
          feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[i] as any, amount);
        }
      }
    } else if (index === numInstallments - 1 && remainingToDistribute > 0 && numInstallments < MAX_INSTALLMENTS) {
      // Last installment and balance remains — add new installment
      const newTotalInstallments = numInstallments + 1;
      setNumberOfInstallments(newTotalInstallments);
      feeForm.setValue('numberOfInstallments', newTotalInstallments);
      feeForm.setValue(INSTALLMENT_AMOUNT_FIELDS[numInstallments] as any, parseFloat(remainingToDistribute.toFixed(2)));
      const admissionDateVal = feeForm.getValues('dateOfAdmission');
      const baseDate = admissionDateVal ? new Date(admissionDateVal) : new Date();
      const dueDate = new Date(baseDate);
      dueDate.setMonth(baseDate.getMonth() + newTotalInstallments);
      const y = dueDate.getFullYear();
      const m = String(dueDate.getMonth() + 1).padStart(2, '0');
      const d = String(dueDate.getDate()).padStart(2, '0');
      feeForm.setValue(INSTALLMENT_DUE_DATE_FIELDS[numInstallments] as any, `${y}-${m}-${d}`);
    }
  };


  // GST Calculation Functions
  const calculateGST = (amount: number): { basicAmount: number; gst: number; total: number } => {
    const gstRate = 0.18; // 18% GST
    const basicAmount = amount / (1 + gstRate);
    const gst = amount - basicAmount;
    return {
      basicAmount: Math.round(basicAmount * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      total: amount
    };
  };

  const createGSTRecord = async (feeRecord: FeeRecord, installmentAmount: number, installmentType: string, receiptNumber?: string, feesPaidDate?: string | Date): Promise<boolean> => {
    const lockKey = `${feeRecord.id}-${installmentType}-${receiptNumber || 'no-receipt'}`;

    if (gstCreationLockRef.current.has(lockKey)) {
      return false;
    }

    gstCreationLockRef.current.add(lockKey);

    try {
      if (!validateGSTRecord(feeRecord, installmentAmount, installmentType)) {
        return false;
      }

      if (!isValidReceiptOrInvoiceNumber(receiptNumber || '')) {
        return false;
      }

      const studentId = feeRecord.studentId || feeRecord.id;
      const companyName =
        resolveReceiptBrand(feeRecord as Record<string, unknown>) === 'ZICA' ? 'ZICA' : 'BETTERCODE';

      const result = await createGstRecordIfNotExists(db, {
        studentId,
        partyName: feeRecord.studentName,
        receiptNumber,
        totalAmount: installmentAmount,
        installmentType,
        feesPaidDate,
        companyName,
        centreId: feeRecord.centreId || userProfile?.centreId || '',
      });

      if (result.created && result.record) {
        setGstRecords((prev) => [...prev, result.record as unknown as GSTInvoiceRecord]);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error creating GST record:', error);
      if ((error as { code?: string })?.code === 'resource-exhausted') {
        toast({
          title: 'Quota Exceeded',
          description: 'Daily quota limit reached. Please try again tomorrow.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Error', description: 'Failed to create GST record', variant: 'destructive' });
      }
      return false;
    } finally {
      gstCreationLockRef.current.delete(lockKey);
    }
  };
      


  

  // Load data from Firebase (centre-scoped listeners only when Fee Management page is open)
  useEffect(() => {
    const centreId = userProfile?.centreId?.trim();
    if (!centreId) {
      setFeeRecords([]);
      setGstRecords([]);
      setIsLoading(false);
      return;
    }

    let unsubscribeFees: (() => void) | undefined;
    let unsubscribeGST: (() => void) | undefined;

    errorLoggedRef.current = { fee: false, gst: false };
    setLoadError(null);

    const loadFeeRecords = () => {
      unsubscribeFees = firebaseListenerManager.subscribe('fees', (data) => {
        try {
          const processedRecords = data.map(record => {
            const convertTimestamp = (value: any): any => {
              if (!value) return value;
              if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
                return value.toDate();
              }
              if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
                return new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
              }
              return value;
            };

            const safeData: any = { ...record };
            const numericFields = [
              'actualFees', 'discountedFees', 'feesPaid', 'feesBalance',
              'registrationAmount', 'numberOfInstallments', 'balanceInstallments',
              ...INSTALLMENT_AMOUNT_FIELDS,
            ];
            numericFields.forEach(field => {
              if (safeData[field] !== undefined) {
                safeData[field] = Number(safeData[field]) || 0;
              }
            });

            safeData.createdAt = convertTimestamp(record.createdAt) || new Date();
            safeData.updatedAt = convertTimestamp(record.updatedAt) || new Date();
            if (record.dueDate != null) {
              const d = convertTimestamp(record.dueDate);
              safeData.dueDate = d instanceof Date ? d : record.dueDate;
            }
            if (record.dateOfAdmission != null) {
              const d = convertTimestamp(record.dateOfAdmission);
              safeData.dateOfAdmission = d instanceof Date ? d : record.dateOfAdmission;
            }
            if (record.courseStartDate != null) {
              const d = convertTimestamp(record.courseStartDate);
              safeData.courseStartDate = d instanceof Date ? d : record.courseStartDate;
            }
            INSTALLMENT_DUE_DATE_FIELDS.forEach((field) => {
              if (record[field] != null) {
                const d = convertTimestamp(record[field]);
                safeData[field] = d instanceof Date ? d : record[field];
              }
            });
            safeData.srNo = parseSerialNumber(record.srNo) || 0;
            return safeData as FeeRecord;
          });

          setFeeRecords(processedRecords);
          setIsLoading(false);
        } catch (error) {
          console.error('Error processing fee records:', error);
        }
      }, { limit: 500, centreId });
    };

    const loadGSTRecords = () => {
      unsubscribeGST = firebaseListenerManager.subscribe('gstRecords', (data) => {
        try {
          const centreScoped = data.filter(
            (record) => !centreId || record.centreId === centreId
          );
          const processedGST = centreScoped.map(record => {
            const convertTimestamp = (value: any): any => {
              if (!value) return value;
              if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
                return value.toDate();
              }
              if (value && typeof value === 'object' && typeof value.seconds === 'number') {
                return new Date(value.seconds * 1000);
              }
              return value;
            };
            // Normalize date to YYYY-MM-DD (Fees Paid Date) so GST list shows according to fees paid date
            let dateStr = '';
            const d = record.date;
            if (typeof d === 'string' && /^\d{4}-\d{2}/.test(d)) {
              dateStr = d.split('T')[0];
            } else if (d && typeof d === 'object' && 'toDate' in d && typeof d.toDate === 'function') {
              const dt = d.toDate();
              dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            } else if (d && typeof d === 'object' && typeof (d as any).seconds === 'number') {
              const dt = new Date((d as any).seconds * 1000);
              dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            } else if (record.month && record.year != null) {
              const m = String(record.month).trim().toUpperCase();
              const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
              const mi = monthNames.indexOf(m);
              const y = typeof record.year === 'number' ? record.year : parseInt(String(record.year), 10) || new Date().getFullYear();
              if (mi >= 0) dateStr = `${y}-${String(mi + 1).padStart(2, '0')}-01`;
            }
            return {
              ...record,
              date: dateStr || record.date,
              month: record.month,
              year: record.year,
              createdAt: convertTimestamp(record.createdAt) || new Date(),
              updatedAt: convertTimestamp(record.updatedAt) || new Date(),
            };
          });
          setGstRecords(processedGST);
        } catch (error) {
          console.error('Error processing GST records:', error);
        }
      }, { limit: 500, centreId });
    };

    loadFeeRecords();
    loadGSTRecords();
    
    // Cleanup function
    return () => {
      if (unsubscribeFees) {
        unsubscribeFees();
      }
      if (unsubscribeGST) {
        unsubscribeGST();
      }
    };
  }, [userProfile?.centreId]);

  // Calculate statistics (aligned with card labels)
  const totalActualFees = feeRecords.reduce((sum, record) => sum + (Number(record.actualFees) || 0), 0);
  const totalDiscountedFees = feeRecords.reduce((sum, record) => sum + (Number(record.discountedFees) || 0), 0);
  const totalFeesCollected = feeRecords.reduce((sum, record) => sum + (Number(record.feesPaid) || 0), 0);
  const totalFeesPending = feeRecords.reduce((sum, record) => sum + (Number(record.feesBalance) || 0), 0);
  const totalStudents = feeRecords.length;
  // Keep for download/other use if needed
  const totalRevenue = totalFeesCollected;
  const totalPending = totalFeesPending;


  // Helper: get canonical sort key (YYYY-MM) and display label from a record.
  // Prefer record.date (Fees Paid Date / receipt date) so invoice list is according to Fees Paid Date.
  const getMonthKeyAndLabel = (record: GSTInvoiceRecord): { sortKey: string; label: string } => {
    const parseRecordDate = (r: GSTInvoiceRecord): Date | null => {
      const d = r.date;
      if (typeof d === 'string' && /^\d{4}-\d{2}/.test(d)) {
        const parsed = new Date(d.split('T')[0]);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      if (d && typeof d === 'object') {
        if (typeof (d as any).toDate === 'function') return (d as any).toDate();
        if (typeof (d as any).seconds === 'number') return new Date((d as any).seconds * 1000);
      }
      if (d) {
        const parsed = new Date(d as string);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      return null;
    };
    const dateFromReceipt = parseRecordDate(record);
    if (dateFromReceipt) {
      const sortKey = `${dateFromReceipt.getFullYear()}-${String(dateFromReceipt.getMonth() + 1).padStart(2, '0')}`;
      const label = dateFromReceipt.toLocaleString('default', { month: 'long', year: 'numeric' });
      return { sortKey, label };
    }
    // Fallback for legacy records: use record.month and record.year
    let m = String(record.month ?? '').trim();
    let y = record.year ?? new Date().getFullYear();
    if (/^\d{4}$/.test(m) && /^\d{1,2}$/.test(String(y))) {
      [m, y] = [String(y), parseInt(m, 10)];
    }
    const yearNum = typeof y === 'number' ? y : parseInt(String(y), 10) || new Date().getFullYear();
    if (/^\d{4}-\d{2}$/.test(m)) {
      const [yr, mo] = m.split('-');
      const date = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1);
      const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      return { sortKey: m, label };
    }
    if (/^\d{1,2}$/.test(m)) {
      const monthNum = parseInt(m, 10);
      const date = new Date(yearNum, monthNum - 1, 1);
      const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { sortKey, label };
    }
    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const monthIndex = monthNames.indexOf(m.toUpperCase());
    const date = new Date(yearNum, monthIndex >= 0 ? monthIndex : 0, 1);
    const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { sortKey, label };
  };

  // Group GST records by month — newest month first, newest record first within each month.
  const gstRecordsByMonth = useMemo(() => {
    const parseRecordDate = (record: GSTInvoiceRecord): number => {
      const d = record.date;
      if (typeof d === 'string') {
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      }
      if (d && (d as any).toDate) return (d as any).toDate().getTime();
      return d ? new Date(d as any).getTime() : 0;
    };
    const grouped = gstRecords.reduce((acc, record) => {
      const { sortKey, label } = getMonthKeyAndLabel(record);
      if (!acc[sortKey]) acc[sortKey] = { records: [] as GSTInvoiceRecord[], label };
      acc[sortKey].records.push(record);
      return acc;
    }, {} as Record<string, { records: GSTInvoiceRecord[]; label: string }>);

    return Object.entries(grouped)
      .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
      .map(([sortKey, { records, label }]) => {
        const sortedRecords = [...records].sort((a, b) => parseRecordDate(b) - parseRecordDate(a));
        return {
          sortKey,
          month: label,
          records: sortedRecords,
          totalInvoice: records.reduce((sum, r) => sum + r.totalInvoice, 0),
          totalBasic: records.reduce((sum, r) => sum + r.basicAmount, 0),
          totalGST: records.reduce((sum, r) => sum + r.gst, 0)
        };
      })
      .slice(0, 6); // Only show last 6 months
  }, [gstRecords]);

  // GST Statistics (Last 6 Months)
  const gstTotalInvoice = useMemo(() => gstRecordsByMonth.reduce((sum, month) => sum + month.totalInvoice, 0), [gstRecordsByMonth]);
  const gstTotalBasic = useMemo(() => gstRecordsByMonth.reduce((sum, month) => sum + month.totalBasic, 0), [gstRecordsByMonth]);
  const gstTotalGST = useMemo(() => gstRecordsByMonth.reduce((sum, month) => sum + month.totalGST, 0), [gstRecordsByMonth]);

  useEffect(() => {
    if (isGSTDialogOpen && gstRecordsByMonth.length > 0) {
      setExpandedGstMonths(new Set([gstRecordsByMonth[0].sortKey]));
    }
    if (!isGSTDialogOpen) {
      setExpandedGstMonths(new Set());
    }
  }, [isGSTDialogOpen, gstRecordsByMonth]);

  const toggleGstMonthExpanded = (sortKey: string) => {
    setExpandedGstMonths((prev) => {
      const next = new Set(prev);
      if (next.has(sortKey)) next.delete(sortKey);
      else next.add(sortKey);
      return next;
    });
  };

  const scrollToGstMonth = (sortKey: string) => {
    setExpandedGstMonths((prev) => new Set(prev).add(sortKey));
    requestAnimationFrame(() => {
      gstMonthSectionRefs.current[sortKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const clearedFees = feeRecords.filter(r => r.feesBalance === 0).length;
  const pendingFees = feeRecords.filter(r => r.feesBalance > 0).length;

  // Fee analytics data for charts (from feeRecords — no extra Firebase reads)
  const feeAnalytics = useMemo(() => {
    const monthOrder = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

    // 1. Fees Collected vs Pending by Admission Month (stacked)
    const byAdmissionMonth: Record<string, { feesPaid: number; feesBalance: number }> = {};
    feeRecords.forEach((r) => {
      const m = r.admissionMonth || 'Unknown';
      if (!byAdmissionMonth[m]) byAdmissionMonth[m] = { feesPaid: 0, feesBalance: 0 };
      byAdmissionMonth[m].feesPaid += Number(r.feesPaid) || 0;
      byAdmissionMonth[m].feesBalance += Number(r.feesBalance) || 0;
    });
    const feesCollectedVsPendingByMonth = Object.entries(byAdmissionMonth)
      .map(([month, v]) => ({ month, feesPaid: v.feesPaid, feesBalance: v.feesBalance }))
      .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));

    // 2. Course-wise Revenue (total fees paid per course)
    const byCourse: Record<string, number> = {};
    feeRecords.forEach((r) => {
      const c = r.course || 'Unknown';
      byCourse[c] = (byCourse[c] || 0) + (Number(r.feesPaid) || 0);
    });
    const courseWiseRevenue = Object.entries(byCourse)
      .filter(([course]) => course.trim().toLowerCase() !== 'other')
      .map(([course, totalFeesPaid]) => ({ course, totalFeesPaid }))
      .sort((a, b) => b.totalFeesPaid - a.totalFeesPaid)
      .slice(0, 12);

    // 3. Discount by Course (actual - discounted)
    const discountByCourse: Record<string, number> = {};
    feeRecords.forEach((r) => {
      const c = r.course || 'Unknown';
      const actual = Number(r.actualFees) || 0;
      const disc = Number(r.discountedFees) || 0;
      discountByCourse[c] = (discountByCourse[c] || 0) + Math.max(0, actual - disc);
    });
    const discountAnalysisData = Object.entries(discountByCourse)
      .filter(([course]) => course.trim().toLowerCase() !== 'other')
      .map(([course, totalDiscount]) => ({ course, totalDiscount }))
      .sort((a, b) => b.totalDiscount - a.totalDiscount)
      .slice(0, 12);

    // 4. Payment Trend Over Time (by fees paid date month)
    const byPaidMonth: Record<string, number> = {};
    feeRecords.forEach((r) => {
      const d = r.feesPaidDate;
      if (!d) return;
      const date = typeof d === 'string' ? new Date(d) : ((d as any)?.toDate ? (d as any).toDate() : new Date(d as any));
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byPaidMonth[key] = (byPaidMonth[key] || 0) + (Number(r.feesPaid) || 0);
    });
    const paymentTrendData = Object.entries(byPaidMonth)
      .map(([dateKey, sumFeesPaid]) => {
        const [y, m] = dateKey.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return { dateKey, monthLabel: `${monthNames[parseInt(m, 10) - 1]} ${y}`, sumFeesPaid };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(-12);

    // 5. Business Analytics (ZICA, Non-ZICA, AIGT) — revenue
    const businessRevenue: Record<string, number> = { ZICA: 0, 'Non-ZICA': 0, AIGT: 0 };
    feeRecords.forEach((r) => {
      const rev = Number(r.feesPaid) || 0;
      const z = r.zicaBettercode;
      if (z === 'ZICA' || z === 'Zica') businessRevenue.ZICA += rev;
      else if (z === 'Non-ZICA') businessRevenue['Non-ZICA'] += rev;
      else if (z === 'AIGT' || z === 'BETTERCODE') businessRevenue.AIGT += rev;
    });
    const businessPieData = Object.entries(businessRevenue)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, fill: name === 'ZICA' ? 'hsl(262, 83%, 58%)' : name === 'Non-ZICA' ? 'hsl(25, 95%, 53%)' : 'hsl(346, 77%, 50%)' }));

    // 6. Combo: Revenue & Count by Month (from fees paid date)
    const comboByMonth: Record<string, { revenue: number; count: number }> = {};
    feeRecords.forEach((r) => {
      const d = r.feesPaidDate;
      if (!d) return;
      const date = typeof d === 'string' ? new Date(d) : ((d as any)?.toDate ? (d as any).toDate() : new Date(d as any));
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!comboByMonth[key]) comboByMonth[key] = { revenue: 0, count: 0 };
      comboByMonth[key].revenue += Number(r.feesPaid) || 0;
      comboByMonth[key].count += 1;
    });
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const installmentComboData = Object.entries(comboByMonth)
      .map(([dateKey, v]) => {
        const [y, m] = dateKey.split('-');
        return { dateKey, month: `${monthNames[parseInt(m, 10) - 1]} ${y}`, revenue: v.revenue, count: v.count };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(-12);

    return {
      feesCollectedVsPendingByMonth,
      courseWiseRevenue,
      discountAnalysisData,
      paymentTrendData,
      businessPieData,
      installmentComboData,
    };
  }, [feeRecords]);

  // Filter records
  const filteredRecords = useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase();
    const filtered = feeRecords.filter(record => {
      const matchesSearch = 
        record.studentName.toLowerCase().includes(searchLower) ||
        record.contactNumber.includes(debouncedSearchTerm) ||
        record.course.toLowerCase().includes(searchLower) ||
        record.source.toLowerCase().includes(searchLower) ||
        [
          record.registrationReceiptNumber,
          record.fullPaymentReceiptNumber,
          record.receiptNumber,
          record.installment01ReceiptNumber,
          record.installment02ReceiptNumber,
          record.installment03ReceiptNumber,
          record.installment04ReceiptNumber,
          record.installment05ReceiptNumber,
          record.installment06ReceiptNumber,
          record.installment07ReceiptNumber,
          record.installment08ReceiptNumber,
          record.installment09ReceiptNumber,
          record.installment10ReceiptNumber,
          record.installment11ReceiptNumber,
          record.installment12ReceiptNumber
        ].some(rn => rn && rn.toLowerCase().includes(searchLower));
      
      const matchesFilters = 
        (filters.admissionMonth === 'all' || record.admissionMonth === filters.admissionMonth) &&
        (filters.source === 'all' || record.source === filters.source) &&
        (filters.paymentMode === 'all' || record.paymentMode === filters.paymentMode) &&
        (filters.zicaBettercode === 'all' || record.zicaBettercode === filters.zicaBettercode) &&
        (filters.feesStructure === 'all' || record.feesStructure === filters.feesStructure) &&
        (filters.feesBalance === 'all' || 
          (filters.feesBalance === 'cleared' && record.feesBalance === 0) ||
          (filters.feesBalance === 'pending' && record.feesBalance > 0));
      
      return matchesSearch && matchesFilters;
    });
    return filtered;
  }, [feeRecords, debouncedSearchTerm, filters]);

  const { sortedData: sortedFilteredFeeRecords, requestSort, sortConfig } = useTableSort(
    filteredRecords,
    DEFAULT_DATE_SORT
  );

  const numberedFeeRecords = useMemo(
    () => assignContiguousSerialsToOrderedList(sortedFilteredFeeRecords),
    [sortedFilteredFeeRecords]
  );

  // This month's due: every fee record checked (same logic as Fee Details); refreshes when feeRecords updates
  const thisMonthDueRecords = useMemo(() => {
    const now = new Date();
    const { entries } = buildThisMonthDueEntries(
      feeRecords as unknown as Record<string, unknown>[],
      now
    );
    return entries.map(({ record, dueDateParsed, expectedAmount, status }) => ({
      ...(record as FeeRecord),
      dueDateParsed,
      expectedAmount,
      status,
    }));
  }, [feeRecords]);

  const { sortedData: sortedDueBase, requestSort: requestSortDue, sortConfig: sortConfigDue } = useTableSort(
    thisMonthDueRecords,
    DEFAULT_DATE_SORT
  );

  const sortedThisMonthDueRecords = useMemo(
    () => assignContiguousSerialsToOrderedList(sortedDueBase),
    [sortedDueBase]
  );

  // This month summary for Analytics (expected, collected, pending)
  const thisMonthStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const expectedThisMonth = thisMonthDueRecords.reduce((sum, r) => sum + (r.expectedAmount ?? 0), 0);
    const pendingThisMonth = thisMonthDueRecords.reduce((sum, r) => sum + Number(r.feesBalance), 0);
    let collectedThisMonth = 0;
    feeRecords.forEach((r) => {
      const d = r.feesPaidDate;
      if (!d) return;
      const date = typeof d === 'string' ? new Date(d) : (d && typeof d === 'object' && 'toDate' in d ? (d as { toDate: () => Date }).toDate() : new Date(d));
      if (isNaN(date.getTime())) return;
      if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
        collectedThisMonth += Number(r.feesPaid) || 0;
      }
    });
    return { expectedThisMonth, collectedThisMonth, pendingThisMonth };
  }, [feeRecords, thisMonthDueRecords]);

  // When no fee records match current search, look up matching students
  useEffect(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();

    if (!term) {
      setStudentSuggestions([]);
      return;
    }

    if (filteredRecords.length > 0) {
      // We already have fee records; no need to suggest students
      setStudentSuggestions([]);
      return;
    }

    let cancelled = false;

    const fetchMatchingStudents = async () => {
      try {
        setIsStudentSearchLoading(true);

        const centreId = userProfile?.centreId;
        const { data: students } = await FirebaseService.getStudents(centreId, 1, 50);

        const matches = (students || []).filter((student: any) => {
          const fullName = `${(student.firstName || '')} ${(student.lastName || '')}`.toLowerCase();
          const phone = (student.phone || student.contactNumber || '').toString();
          const email = (student.email || '').toLowerCase();

          return (
            fullName.includes(term) ||
            phone.includes(debouncedSearchTerm.trim()) ||
            email.includes(term)
          );
        }) as StudentSuggestion[];

        if (!cancelled) {
          setStudentSuggestions(matches);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error searching matching students for fee records:', error);
          setStudentSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsStudentSearchLoading(false);
        }
      }
    };

    fetchMatchingStudents();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm, filteredRecords.length, userProfile?.centreId]);

  // Create a new fee record from a student suggestion
  const handleCreateRecordFromStudent = async (student: StudentSuggestion) => {
    if (!userProfile) {
      toast({
        title: 'Not signed in',
        description: 'Please sign in again to create fee records.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();

      const actualFees = Number(student.actualFees || 0);
      const discountedFees = Number(student.discountedFees || actualFees || 0);
      const feesPaid = Number(student.feesPaid || 0);
      const feesBalance =
        typeof student.feesBalance === 'number'
          ? student.feesBalance
          : discountedFees - feesPaid;

      const dataForFee: FeeRecord = {
        // These will be overridden inside handleCreateRecord
        id: '' as any,
        srNo: 0,
        studentName: (fullName || student.firstName || '') as any,
        source: (student.source || student.leadSource || 'Student') as any,
        parentsContactNumber: (student.parentsContactNumber || '') as any,
        contactNumber: (student.phone || student.contactNumber || '') as any,
        admissionMonth: (student.admissionMonth || '') as any,
        dateOfAdmission: (student.admissionDate || '') as any,
        zicaBettercode:
          (student.zicaZima?.toUpperCase() === 'ZICA' || student.zicaZima?.toUpperCase() === 'ZICA/ZIMA' || student.zicaZima?.toUpperCase() === 'ZIMA'
            ? (student.zicaSubCategory === 'Non-ZICA' ? 'Non-ZICA' : 'ZICA')
            : (student.zicaZima?.toUpperCase() === 'BETTERCODE' || student.zicaZima === 'AIGT')
            ? 'BETTERCODE'
            : 'ZICA') as any,
        feesStructure: (student.feesStructure || undefined) as any,
        course: (student.course || '') as any,
        courseDuration: (student.courseDuration || '') as any,
        courseStartDate: (student.courseStartDate || '') as any,
        actualFees: actualFees as any,
        discountedFees: discountedFees as any,
        feesPaid: feesPaid as any,
        feesPaidDate: (student.feesPaidDate || '') as any,
        feesBalance: feesBalance as any,
        registrationAmount: 0 as any,
        installment01: undefined,
        installment02: undefined,
        installment03: undefined,
        installment04: undefined,
        installment05: undefined,
        installment06: undefined,
        installment07: undefined,
        installment08: undefined,
        installment09: undefined,
        installment10: undefined,
        installment11: undefined,
        installment12: undefined,
        paymentMode: (student.paymentMode || 'Cash') as any,
        numberOfInstallments: Number(student.noOfInstallments || 0) as any,
        balanceInstallments: Number(student.remainingInstallments || 0) as any,
        dueDate: (student.dueDate || '') as any,
        remarks: (student.remarks || '') as any,
        installmentDetails: '' as any,
        chequeNumber: '' as any,
        studentId: (student.id as string) || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userProfile.uid || '',
      };

      // Open the Add Record dialog with pre-filled data instead of creating immediately
      // This allows the user to review and customize the record (e.g., source, installments)
      feeForm.reset(dataForFee);
      setNumberOfInstallments(dataForFee.numberOfInstallments || 0);
      setIsAddDialogOpen(true);

      // After opening, refresh suggestions so the hint disappears
      setStudentSuggestions([]);
    } catch (error) {
      console.error('Error preparing fee record from student:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare fee record from student.',
        variant: 'destructive',
      });
    }
  };

  // CRUD Operations
  const normalizeFeesPaidDateForCompare = (val: unknown): string => {
    if (val == null) return '';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.split('T')[0];
    if (typeof val === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(val)) {
      const [d, m, y] = val.split('-');
      return `${y}-${m}-${d}`;
    }
    if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      const dt = (val as { toDate: () => Date }).toDate();
      if (!isNaN(dt.getTime())) {
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
    }
    return '';
  };

  const handleCreateRecord = async (data: FeeRecord) => {
    try {
      setIsCreating(true);
      
      const newRecord = {
        ...data,
        // Convert empty strings to 0 for numeric fields
        actualFees: Number(data.actualFees) || 0,
        discountedFees: Number(data.discountedFees) || 0,
        feesPaid: Number(data.feesPaid) || 0,
        feesBalance: Number(data.feesBalance) || 0,
        registrationAmount: Number(data.registrationAmount) || 0,
        installment01: Number(data.installment01) || 0,
        installment02: Number(data.installment02) || 0,
        installment03: Number(data.installment03) || 0,
        installment04: Number(data.installment04) || 0,
        installment05: Number(data.installment05) || 0,
        installment06: Number(data.installment06) || 0,
        installment07: Number(data.installment07) || 0,
        installment08: Number(data.installment08) || 0,
        installment09: Number(data.installment09) || 0,
        installment10: Number(data.installment10) || 0,
        installment11: Number(data.installment11) || 0,
        installment12: Number(data.installment12) || 0,
        balanceInstallments: Number(data.balanceInstallments) || 0,
        srNo: getNextSerialNumberFromItems(feeRecords),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userProfile?.uid || '',
        centreId: userProfile?.centreId || ''
      };
      
      // Create the fee record first
      const docRef = await addDoc(collection(db, 'fees'), newRecord);
      
      setIsAddDialogOpen(false);
      setNumberOfInstallments(0);
      feeForm.reset();

      toast({ title: 'Success', description: 'Fee record created successfully!' });
    } catch (error) {
      console.error('Error creating fee record:', error);
      toast({ title: "Error", description: "Failed to create fee record", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRecord = async (data: FeeRecord) => {
    try {
      if (!editingRecord) return;
      
      setIsUpdating(true);
      
      const updatedRecord = {
        ...data,
        // Convert empty strings to 0 for numeric fields
        actualFees: Number(data.actualFees) || 0,
        discountedFees: Number(data.discountedFees) || 0,
        feesPaid: Number(data.feesPaid) || 0,
        feesBalance: Number(data.feesBalance) || 0,
        registrationAmount: Number(data.registrationAmount) || 0,
        installment01: Number(data.installment01) || 0,
        installment02: Number(data.installment02) || 0,
        installment03: Number(data.installment03) || 0,
        installment04: Number(data.installment04) || 0,
        installment05: Number(data.installment05) || 0,
        installment06: Number(data.installment06) || 0,
        installment07: Number(data.installment07) || 0,
        installment08: Number(data.installment08) || 0,
        installment09: Number(data.installment09) || 0,
        installment10: Number(data.installment10) || 0,
        installment11: Number(data.installment11) || 0,
        installment12: Number(data.installment12) || 0,
        balanceInstallments: Number(data.balanceInstallments) || 0,
        chequeNumber: data.chequeNumber || '',
        studentId: editingRecord.studentId, // Preserve studentId
        centreId: editingRecord.centreId || userProfile?.centreId || '', // Preserve centreId
        updatedAt: new Date()
      };
      
      // console.log(`🔄 Starting fee record update for ${editingRecord.studentName}`);
      
      // Collect all GST operations to perform
      const gstStudentId = editingRecord.studentId || editingRecord.id;
      const gstOperations: Array<{
        type: 'create' | 'update' | 'delete';
        installmentType: string;
        amount?: number;
        receiptNumber?: string;
        existingRecord?: GSTInvoiceRecord;
      }> = [];
      
      // Check installment changes
      const installmentFields = [
        'installment01', 'installment02', 'installment03', 'installment04', 
        'installment05', 'installment06', 'installment07', 'installment08',
        'installment09', 'installment10', 'installment11', 'installment12'
      ];
      
      for (let i = 0; i < installmentFields.length; i++) {
        const field = installmentFields[i];
        const oldValue = parseFloat(editingRecord[field as keyof FeeRecord] as string) || 0;
        const newValue = parseFloat(data[field as keyof FeeRecord] as string) || 0;
        
        // console.log(`🔍 Processing ${field}: oldValue=${oldValue}, newValue=${newValue}`);
        
        // Check if there's already a GST record for this installment
        const existingGSTRecord = gstRecords.find(record =>
          (record.studentId === gstStudentId || record.studentId === editingRecord.id) &&
          record.installmentType === `Installment ${i + 1}` &&
          record.partyName === editingRecord.studentName
        );
        
        const installmentReceipt = (data as Record<string, unknown>)[INSTALLMENT_RECEIPT_FIELDS[i]] as string | undefined;

        if (newValue > 0 && newValue !== oldValue) {
          if (oldValue === 0 && !existingGSTRecord) {
            if (!installmentReceipt || !isValidReceiptOrInvoiceNumber(installmentReceipt)) {
              continue;
            }
            console.log(`✅ Queueing NEW GST record creation for ${field}: ${oldValue} -> ${newValue}`);
            gstOperations.push({
              type: 'create',
              installmentType: `Installment ${i + 1}`,
              amount: newValue,
              receiptNumber: installmentReceipt,
            });
          } else if (oldValue > 0 && existingGSTRecord) {
            // Updating existing installment AND GST record exists
            console.log(`🔄 Queueing GST record update for ${field}: ${oldValue} -> ${newValue}`);
            gstOperations.push({
              type: 'update',
              installmentType: `Installment ${i + 1}`,
              amount: newValue,
              existingRecord: existingGSTRecord
            });
          } else if (oldValue === 0 && existingGSTRecord) {
            // First time setting but GST record already exists (shouldn't happen, but handle it)
            console.log(`⚠️ WARNING: GST record already exists for new installment ${field}, skipping creation`);
          } else if (oldValue > 0 && !existingGSTRecord) {
            if (installmentReceipt && isValidReceiptOrInvoiceNumber(installmentReceipt)) {
              console.log(`⚠️ WARNING: No GST record found for existing installment ${field}, creating new one`);
              gstOperations.push({
                type: 'create',
                installmentType: `Installment ${i + 1}`,
                amount: newValue,
                receiptNumber: installmentReceipt,
              });
            }
          }
        } else if (newValue === 0 && oldValue > 0 && existingGSTRecord) {
          // Installment was removed, delete the GST record
          console.log(`🗑️ Queueing GST record deletion for removed installment ${field}`);
          gstOperations.push({
            type: 'delete',
            installmentType: `Installment ${i + 1}`,
            existingRecord: existingGSTRecord
          });
        }
      }
      
      // Check if fees paid has changed
      const oldFeesPaid = editingRecord.feesPaid || 0;
      const newFeesPaid = data.feesPaid || 0;
      if (newFeesPaid > oldFeesPaid) {
        const additionalAmount = newFeesPaid - oldFeesPaid;
        const initialReceipt =
          data.registrationReceiptNumber || data.receiptNumber || editingRecord.registrationReceiptNumber || editingRecord.receiptNumber;
        if (initialReceipt && isValidReceiptOrInvoiceNumber(initialReceipt)) {
          console.log(`✅ Queueing GST record creation for additional payment: ${additionalAmount}`);
          gstOperations.push({
            type: 'create',
            installmentType: 'Initial Payment',
            amount: additionalAmount,
            receiptNumber: initialReceipt,
          });
        }
      }
      
      // Execute all GST operations sequentially
      let gstOperationsCompleted = 0;
      for (const operation of gstOperations) {
        try {
          if (operation.type === 'create' && operation.amount) {
            const feesPaidDate = (updatedRecord as any).feesPaidDate;
            const success = await createGSTRecord(
              updatedRecord,
              operation.amount,
              operation.installmentType,
              operation.receiptNumber,
              feesPaidDate
            );
            if (success) {
              gstOperationsCompleted++;
              console.log(`✅ GST record created successfully for ${operation.installmentType}`);
            } else {
              console.log(`⚠️ GST record creation skipped for ${operation.installmentType} (duplicate detected)`);
            }
          } else if (operation.type === 'update' && operation.amount && operation.existingRecord) {
            const gstCalculation = calculateGST(operation.amount);
            await updateDoc(doc(db, 'gstRecords', operation.existingRecord.id), {
              totalInvoice: gstCalculation.total,
              basicAmount: gstCalculation.basicAmount,
              gst: gstCalculation.gst,
              updatedAt: new Date()
            });
            
            // Update local state
            setGstRecords(prev => prev.map(record => 
              record.id === operation.existingRecord!.id 
                ? { ...record, totalInvoice: gstCalculation.total, basicAmount: gstCalculation.basicAmount, gst: gstCalculation.gst, updatedAt: new Date() }
                : record
            ));
            
            gstOperationsCompleted++;
            console.log(`✅ GST record updated successfully for ${operation.installmentType}`);
          } else if (operation.type === 'delete' && operation.existingRecord) {
            await deleteDoc(doc(db, 'gstRecords', operation.existingRecord.id));
            setGstRecords(prev => prev.filter(record => record.id !== operation.existingRecord!.id));
            gstOperationsCompleted++;
            console.log(`✅ GST record deleted successfully for ${operation.installmentType}`);
          }
        } catch (error) {
          console.error(`Error executing GST operation ${operation.type} for ${operation.installmentType}:`, error);
        }
      }
      
      // Check if the document exists before updating
      const feeDocRef = doc(db, 'fees', editingRecord.id);
      const feeDocSnap = await getDoc(feeDocRef);
      
      if (!feeDocSnap.exists()) {
        console.error(`Fee record with ID ${editingRecord.id} does not exist`);
        toast({ 
          title: "Error", 
          description: "Fee record not found. Please refresh and try again.", 
          variant: "destructive" 
        });
        return;
      }
      
      // Check if update is necessary by comparing with existing record
      const existingData = feeDocSnap.data();
      const existingFeesPaidDate = normalizeFeesPaidDateForCompare(existingData.feesPaidDate);
      const updatedFeesPaidDate = normalizeFeesPaidDateForCompare((updatedRecord as any).feesPaidDate);
      const hasSignificantChanges = 
        existingData.feesPaid !== updatedRecord.feesPaid ||
        existingData.discountedFees !== updatedRecord.discountedFees ||
        existingData.actualFees !== updatedRecord.actualFees ||
        existingData.numberOfInstallments !== updatedRecord.numberOfInstallments ||
        existingData.course !== updatedRecord.course ||
        existingFeesPaidDate !== updatedFeesPaidDate ||
        INSTALLMENT_AMOUNT_FIELDS.some(field => (existingData as any)[field] !== (updatedRecord as any)[field]);
      
      // Only update if there are significant changes
      if (hasSignificantChanges) {
        // Update the fee record
        await updateDoc(feeDocRef, updatedRecord);
        
        // Sync student record when fee record is updated (only if significant changes)
        if (editingRecord.studentId) {
          await updateStudentRecord({ ...updatedRecord, id: editingRecord.id, studentId: editingRecord.studentId });
        }
      } else {
        // No significant changes, skip update to save quota
        toast({ title: "Info", description: "No changes detected. Update skipped." });
        setIsEditDialogOpen(false);
        setEditingRecord(null);
        setNumberOfInstallments(0);
        feeForm.reset();
        setIsUpdating(false);
        return;
      }
      
      // Show success message
      if (gstOperationsCompleted > 0) {
        toast({ 
          title: "Success", 
          description: `Fee record updated successfully! ${gstOperationsCompleted} GST record(s) processed.` 
        });
      } else {
        toast({ title: "Success", description: "Fee record updated successfully!" });
      }
      
      setIsEditDialogOpen(false);
      setEditingRecord(null);
      setNumberOfInstallments(0);
      feeForm.reset();
      
    } catch (error) {
      console.error('Error updating fee record:', error);
      toast({ title: "Error", description: "Failed to update fee record", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveRemarkOnly = async (recordId: string, newRemark: string) => {
    try {
      const feeDocRef = doc(db, 'fees', recordId);
      await updateDoc(feeDocRef, { remarks: newRemark });
      setFeeRecords(prev =>
        prev.map(r => (r.id === recordId ? { ...r, remarks: newRemark } : r))
      );
      setIsRemarkEditDialogOpen(false);
      setEditingRemarkRecordId(null);
      setRemarkEditValue('');
      toast({ title: 'Success', description: 'Remark updated successfully.' });
    } catch (error) {
      console.error('Error updating remark:', error);
      toast({
        title: 'Error',
        description: 'Failed to update remark.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      console.log('🗑️ Starting fee record deletion for ID:', id);
      
      // Optimistically update local state immediately
      setFeeRecords(prev => {
        const filtered = prev.filter(record => record.id !== id);
        console.log('🔄 Updated local state, remaining records:', filtered.length);
        return filtered;
      });

      // Delete from Firebase
      const feeRef = doc(db, 'fees', id);
      
      // Verify the document exists before deleting
      const feeDoc = await getDoc(feeRef);
      if (!feeDoc.exists()) {
        console.warn('⚠️ Fee record not found for deletion:', id);
        toast({
          title: "Warning",
          description: "Fee record not found or already deleted.",
          variant: "destructive",
        });
        // Refresh to sync state
        return;
      }

      console.log('✅ Fee record found, proceeding with deletion');
      
      // Handle receipt counters decrement
      const feeData = feeDoc.data();
      const receiptFields = [
        'registrationReceiptNumber',
        'fullPaymentReceiptNumber',
        'receiptNumber',
        'installment01ReceiptNumber',
        'installment02ReceiptNumber',
        'installment03ReceiptNumber',
        'installment04ReceiptNumber',
        'installment05ReceiptNumber',
        'installment06ReceiptNumber',
        'installment07ReceiptNumber',
        'installment08ReceiptNumber',
        'installment09ReceiptNumber',
        'installment10ReceiptNumber',
        'installment11ReceiptNumber',
        'installment12ReceiptNumber'
      ];
      
      let bettercodeCount = 0;
      const zicaCounts: Record<string, number> = {}; // YYYYMMDD -> count

      receiptFields.forEach(field => {
        const val = feeData[field];
        if (typeof val === 'string' && val) {
          if (val.startsWith('BTC')) {
            bettercodeCount++;
          } else if (val.startsWith('ZICAPCMC')) {
            // Old format: ZICAPCMC + YYYYMMDD (8 chars at index 8)
            if (val.length >= 16) {
              const ymd = val.slice(8, 16);
              if (/^\d{8}$/.test(ymd)) {
                zicaCounts[ymd] = (zicaCounts[ymd] || 0) + 1;
              }
            }
          } else if (val.startsWith('Z') && val.length >= 7 && /^Z\d{6}/.test(val)) {
            // New format: Z + YYMMDD + 001 (e.g. Z260210001) -> counter key is ZICA_YYYYMMDD
            const yymd = val.slice(1, 7);
            if (/^\d{6}$/.test(yymd)) {
              const ymd = `20${yymd}`; // YY -> 20YY for counter document ID
              zicaCounts[ymd] = (zicaCounts[ymd] || 0) + 1;
            }
          }
        }
      });

      // Decrement Bettercode Global Counter
      if (bettercodeCount > 0) {
        console.log(`📉 Decrementing BETTERCODE counter by ${bettercodeCount}`);
        await decrementReceiptCounter(db, 'BETTERCODE', bettercodeCount);
      }

      // Decrement ZICA Daily Counters
      for (const [ymd, count] of Object.entries(zicaCounts)) {
        // Parse YYYYMMDD to Date
        const year = parseInt(ymd.substring(0, 4));
        const month = parseInt(ymd.substring(4, 6)) - 1;
        const day = parseInt(ymd.substring(6, 8));
        const date = new Date(year, month, day);
        console.log(`📉 Decrementing ZICA counter for ${ymd} by ${count}`);
        await decrementReceiptCounter(db, 'ZICA', count, date);
      }
      
      // Delete the document
      await deleteDoc(feeRef);
      console.log('✅ Successfully deleted fee record from Firebase:', id);

      toast({ 
        title: "Success", 
        description: "Fee record deleted successfully!" 
      });
    } catch (error) {
      console.error('❌ Error deleting fee record:', error);
      
      // Revert optimistic update on error
      // The onSnapshot listener will restore the correct state
      
      let errorMessage = "Failed to delete fee record. Please try again.";
      if (error instanceof Error) {
        console.error("❌ Error details:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        if (error.message.includes('permission')) {
          errorMessage = "You don't have permission to delete this fee record.";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('not-found')) {
          errorMessage = "Fee record not found or already deleted.";
        }
      }
      
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  };

  const handleDownloadSheet = () => {
    // Exclude registrationAmount from export data as per user request
    const exportData = filteredRecords.map(({ registrationAmount, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fee Records');
    XLSX.writeFile(workbook, 'fee-records.xlsx');
  };

  const handleShareWhatsApp = () => {
    const message = `Fee Management Report

Total Records: ${filteredRecords.length}
Total Revenue: ₹${totalRevenue.toLocaleString()}
Pending Amount: ₹${totalPending.toLocaleString()}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };


  const handleShareGSTWhatsApp = () => {
    let summary = `GST Invoice Summary:\n\n`;
    summary += `Total Invoice Amount: ₹${gstTotalInvoice.toLocaleString()}\n`;
    summary += `Total Basic Amount: ₹${gstTotalBasic.toLocaleString()}\n`;
    summary += `Total GST: ₹${gstTotalGST.toLocaleString()}\n\n`;
    
    summary += `Monthly Breakdown:\n`;
    gstRecordsByMonth.forEach(monthData => {
      summary += `${monthData.month}: ₹${monthData.totalInvoice.toLocaleString()}\n`;
    });
    
    const message = encodeURIComponent(summary);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  /** Normalize contact for WhatsApp: digits only, India +91 if 10 digits */
  const normalizePhoneForWhatsApp = (contact: string): string => {
    const digits = (contact || '').replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  };

  /** Open WhatsApp with fee reminder message for This Month's Due row */
  const handleWhatsAppFeeReminder = (record: FeeRecord & { dueDateParsed: Date; expectedAmount: number; status: 'Due' | 'Overdue' }) => {
    const contact = (record.contactNumber || record.parentsContactNumber || '').trim();
    if (!contact) {
      toast({ title: 'No contact number', description: 'This student has no phone number.', variant: 'destructive' });
      return;
    }
    const phone = normalizePhoneForWhatsApp(contact);
    if (phone.length < 10) {
      toast({ title: 'Invalid number', description: 'Please add a valid phone number for this student.', variant: 'destructive' });
      return;
    }
    const name = record.studentName || 'Student';
    const dueDateStr = record.dueDateParsed ? formatDate(record.dueDateParsed) : '-';
    const bullet = '\u2022';
    const qrLink = 'https://photos.app.goo.gl/gBxiM8uzs3xUmzJe9';
    const message = `Dear ${name},

This is a gentle reminder regarding your upcoming fee installment.

${bullet} Installment due date: ${dueDateStr}

We request you to complete the payment on or before the due date. If the payment is not received by the due date, a late fee of Rs.100 per day will be applicable as per policy.

Payment options

${bullet} UPI
${bullet} Pay on mobile number: 9823087861
${bullet} UPI ID: 9823087861-7@ybl
${bullet} You may also scan the QR code (image link below).

${bullet} Bank transfer
${bullet} Account name: BETTERCODE TECHNOLOGIES PVT LTD
${bullet} Account number: 50200113251203
${bullet} IFSC code: HDFC0001227

${bullet} UPI QR Code (scan for payment): ${qrLink}

If you have already made the payment, please ignore this message. For any clarification, feel free to contact us.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // CRUD Operations for GST Records
  const handleDeleteGSTRecord = async (gstRecordId: string) => {
    try {
      await deleteDoc(doc(db, 'gstRecords', gstRecordId));
      setGstRecords(prev => prev.filter(record => record.id !== gstRecordId));
      toast({ title: "Success", description: "GST record deleted successfully!" });
    } catch (error) {
      console.error('Error deleting GST record:', error);
      toast({ title: "Error", description: "Failed to delete GST record", variant: "destructive" });
    }
  };

  const handleDeleteAllGSTRecordsForMonth = async (monthData: { month: string; records: GSTInvoiceRecord[] }) => {
    try {
      const deletePromises = monthData.records.map(record => deleteDoc(doc(db, 'gstRecords', record.id)));
      await Promise.all(deletePromises);
      
      const deletedIds = monthData.records.map(r => r.id);
      setGstRecords(prev => prev.filter(record => !deletedIds.includes(record.id)));
      
      toast({ title: "Success", description: `Successfully deleted all GST records for ${monthData.month}!` });
    } catch (error) {
      console.error('Error deleting month GST records:', error);
      toast({ title: "Error", description: "Failed to delete GST records", variant: "destructive" });
    }
  };

  const handleEditGSTRecord = async (gstRecordId: string, updatedData: Partial<GSTInvoiceRecord>) => {
    try {
      await updateDoc(doc(db, 'gstRecords', gstRecordId), {
        ...updatedData,
        updatedAt: new Date()
      });
      setGstRecords(prev => prev.map(record => 
        record.id === gstRecordId ? { ...record, ...updatedData, updatedAt: new Date() } : record
      ));
      toast({ title: "Success", description: "GST record updated successfully!" });
    } catch (error) {
      console.error('Error updating GST record:', error);
      toast({ title: "Error", description: "Failed to update GST record", variant: "destructive" });
    }
  };

  const [isSyncingGstDates, setIsSyncingGstDates] = useState(false);
  const receiptFieldNames = ['registrationReceiptNumber', 'receiptNumber', 'fullPaymentReceiptNumber', ...INSTALLMENT_RECEIPT_FIELDS];
  const syncGstDatesFromFeeRecords = async () => {
    setIsSyncingGstDates(true);
    try {
      let updated = 0;
      for (const gstRecord of gstRecords) {
        const receiptNo = gstRecord.invoiceNumbers?.[0];
        if (!receiptNo || receiptNo.length < 3) continue;
        const feeRecord = feeRecords.find((fee: FeeRecord) => {
          for (const field of receiptFieldNames) {
            const val = (fee as any)[field];
            if (val === receiptNo || (typeof val === 'string' && val.trim() === receiptNo)) return true;
          }
          return false;
        });
        if (!feeRecord) continue;
        const fp = (feeRecord as any).feesPaidDate;
        let dateStr = '';
        if (typeof fp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fp)) dateStr = fp.split('T')[0];
        else if (typeof fp === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fp)) dateStr = fp.split('-').reverse().join('-');
        else if (fp && typeof fp === 'object' && (fp as any).toDate) dateStr = (fp as any).toDate().toISOString().split('T')[0];
        if (!dateStr) continue;
        const gstCurrent = typeof gstRecord.date === 'string' ? gstRecord.date.split('T')[0] : '';
        if (gstCurrent === dateStr) continue;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) continue;
        const month = d.toLocaleString('default', { month: 'long' }).toUpperCase();
        const year = d.getFullYear();
        await updateDoc(doc(db, 'gstRecords', gstRecord.id), { date: dateStr, month, year, updatedAt: new Date() });
        setGstRecords(prev => prev.map(r => r.id === gstRecord.id ? { ...r, date: dateStr, month, year, updatedAt: new Date() } : r));
        updated++;
      }
      if (updated > 0) toast({ title: "Dates updated", description: `${updated} GST record(s) aligned with Fees Paid Date.` });
    } catch (error) {
      console.error('Error syncing GST dates:', error);
      toast({ title: "Error", description: "Failed to sync GST dates from fee records", variant: "destructive" });
    } finally {
      setIsSyncingGstDates(false);
    }
  };

  // When GST dialog opens, align GST dates with Fees Paid Date from fee records (no manual button needed)
  useEffect(() => {
    if (isGSTDialogOpen && gstRecords.length > 0 && !isSyncingGstDates) {
      syncGstDatesFromFeeRecords();
    }
  }, [isGSTDialogOpen]);

  const handleOpenGSTEditDialog = (record: GSTInvoiceRecord) => {
    setEditingGSTRecord(record);
    let dateStr = '';
    // Prefer Fees Paid Date from the linked fee record (always use paid date)
    const receiptNo = record.invoiceNumbers?.[0];
    if (receiptNo && receiptNo.length >= 3) {
      const feeRecord = feeRecords.find((fee: FeeRecord) => {
        for (const field of receiptFieldNames) {
          const val = (fee as any)[field];
          if (val === receiptNo || (typeof val === 'string' && val.trim() === receiptNo)) return true;
        }
        return false;
      });
      if (feeRecord) {
        const fp = (feeRecord as any).feesPaidDate;
        if (typeof fp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fp)) dateStr = fp.split('T')[0];
        else if (typeof fp === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fp)) dateStr = fp.split('-').reverse().join('-');
        else if (fp && typeof fp === 'object' && (fp as any).toDate) dateStr = (fp as any).toDate().toISOString().split('T')[0];
        else if (fp && typeof fp === 'object' && typeof (fp as any).seconds === 'number') dateStr = new Date((fp as any).seconds * 1000).toISOString().split('T')[0];
      }
    }
    if (!dateStr) {
      const d = record.date;
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) dateStr = d.split('T')[0];
      else if (d && typeof d === 'object' && (d as any).toDate) dateStr = (d as any).toDate().toISOString().split('T')[0];
      else if (d && typeof d === 'object' && typeof (d as any).seconds === 'number') dateStr = new Date((d as any).seconds * 1000).toISOString().split('T')[0];
      else if (record.month && record.year != null) {
        const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
        const mi = monthNames.indexOf(String(record.month).trim().toUpperCase());
        if (mi >= 0) dateStr = `${record.year}-${String(mi + 1).padStart(2, '0')}-01`;
      }
    }
    setGstEditFormData({
      invoiceNumbers: [...record.invoiceNumbers],
      b2bB2c: record.b2bB2c,
      companyName: record.companyName,
      date: dateStr
    });
    setIsGSTEditDialogOpen(true);
  };

  const handleCloseGSTEditDialog = () => {
    setIsGSTEditDialogOpen(false);
    setEditingGSTRecord(null);
    setGstEditFormData({
      invoiceNumbers: [],
      b2bB2c: 'B2C',
      companyName: '',
      date: ''
    });
  };

  const handleAddInvoiceNumber = () => {
    setGstEditFormData(prev => ({
      ...prev,
      invoiceNumbers: [...prev.invoiceNumbers, '']
    }));
  };

  const handleRemoveInvoiceNumber = (index: number) => {
    setGstEditFormData(prev => ({
      ...prev,
      invoiceNumbers: prev.invoiceNumbers.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateInvoiceNumber = (index: number, value: string) => {
    setGstEditFormData(prev => ({
      ...prev,
      invoiceNumbers: prev.invoiceNumbers.map((invoiceNumber, i) => 
        i === index ? value : invoiceNumber
      )
    }));
  };

  const handleSaveGSTEdit = async () => {
    if (!editingGSTRecord) return;

    // Filter out empty invoice numbers
    const validInvoiceNumbers = gstEditFormData.invoiceNumbers.filter(num => num.trim() !== '');
    
    if (validInvoiceNumbers.length === 0) {
      toast({ 
        title: "Validation Error", 
        description: "At least one invoice number is required", 
        variant: "destructive" 
      });
      return;
    }

    const invalidInvoiceNumbers = validInvoiceNumbers.filter((n) => !isValidReceiptOrInvoiceNumber(n));
    if (invalidInvoiceNumbers.length > 0) {
      toast({
        title: 'Invalid invoice number',
        description:
          'Use a real receipt number only (e.g. BTC001 or Z260515001). Long auto-generated numbers like Z2605152000002422 are no longer allowed.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let dateStr = gstEditFormData.date && /^\d{4}-\d{2}-\d{2}/.test(gstEditFormData.date) ? gstEditFormData.date : '';
      if (!dateStr && validInvoiceNumbers[0]) {
        const feeRecord = feeRecords.find((fee: FeeRecord) => {
          for (const field of receiptFieldNames) {
            const val = (fee as any)[field];
            if (val === validInvoiceNumbers[0] || (typeof val === 'string' && val.trim() === validInvoiceNumbers[0])) return true;
          }
          return false;
        });
        if (feeRecord) {
          const fp = (feeRecord as any).feesPaidDate;
          if (typeof fp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fp)) dateStr = fp.split('T')[0];
          else if (typeof fp === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fp)) dateStr = fp.split('-').reverse().join('-');
          else if (fp && typeof fp === 'object' && (fp as any).toDate) dateStr = (fp as any).toDate().toISOString().split('T')[0];
          else if (fp && typeof fp === 'object' && typeof (fp as any).seconds === 'number') dateStr = new Date((fp as any).seconds * 1000).toISOString().split('T')[0];
        }
      }
      if (!dateStr) {
        const d = editingGSTRecord.date;
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) dateStr = d.split('T')[0];
        else if (d && typeof d === 'object' && (d as any).seconds != null) dateStr = new Date((d as any).seconds * 1000).toISOString().split('T')[0];
      }
      const editDate = dateStr ? new Date(dateStr.split('T')[0]) : (editingGSTRecord.month && editingGSTRecord.year != null ? new Date(editingGSTRecord.year, ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'].indexOf(String(editingGSTRecord.month).toUpperCase()), 1) : new Date());
      const month = !isNaN(editDate.getTime()) ? editDate.toLocaleString('default', { month: 'long' }).toUpperCase() : editingGSTRecord.month;
      const year = !isNaN(editDate.getTime()) ? editDate.getFullYear() : editingGSTRecord.year;
      await handleEditGSTRecord(editingGSTRecord.id, {
        invoiceNumbers: validInvoiceNumbers,
        b2bB2c: gstEditFormData.b2bB2c,
        companyName: gstEditFormData.companyName,
        date: dateStr || (editingGSTRecord.date as string),
        month,
        year
      });
      handleCloseGSTEditDialog();
    } catch (error) {
      console.error('Error saving GST edit:', error);
    }
  };

  // Function to clean up duplicate GST records
  const handleCleanupDuplicates = async () => {
    try {
      const duplicates = new Map();
      const recordsToDelete: string[] = [];

      console.log('🧹 Starting comprehensive duplicate cleanup...');
      console.log(`Total records to check: ${gstRecords.length}`);

      // Method 0: Remove legacy random auto-GST invoice numbers (e.g. Z2605152000002422)
      gstRecords.forEach((record) => {
        const hasLegacyInvoice = record.invoiceNumbers?.some((n) => isLegacyRandomGstInvoiceNumber(n));
        if (hasLegacyInvoice) {
          recordsToDelete.push(record.id);
          console.log('Marking legacy random GST invoice for deletion:', record);
        }
      });

      // Method 1: Find duplicates based on student ID, installment type, party name, AND amount
      gstRecords.forEach(record => {
        const key = `${record.studentId}-${record.installmentType}-${record.partyName}-${record.totalInvoice}`;
        if (duplicates.has(key)) {
          // Keep the first one, mark others for deletion
          recordsToDelete.push(record.id);
          console.log('Marking duplicate for deletion:', record);
        } else {
          duplicates.set(key, record);
        }
      });

      // Method 2: Check for duplicate invoice numbers
      const invoiceNumbers = new Map();
      gstRecords.forEach(record => {
        if (record.invoiceNumbers && record.invoiceNumbers.length > 0) {
          record.invoiceNumbers.forEach(invoiceNumber => {
            if (invoiceNumbers.has(invoiceNumber)) {
              // Keep the first one, mark others for deletion
              if (!recordsToDelete.includes(record.id)) {
                recordsToDelete.push(record.id);
                console.log('Marking duplicate invoice number for deletion:', record);
              }
            } else {
              invoiceNumbers.set(invoiceNumber, record);
            }
          });
        }
      });

      // Method 3: Check for records with same uniqueKey
      const uniqueKeys = new Map();
      gstRecords.forEach(record => {
        if (record.uniqueKey) {
          if (uniqueKeys.has(record.uniqueKey)) {
            if (!recordsToDelete.includes(record.id)) {
              recordsToDelete.push(record.id);
              console.log('Marking duplicate uniqueKey for deletion:', record);
            }
          } else {
            uniqueKeys.set(record.uniqueKey, record);
          }
        }
      });

      // Method 4: Check for records with same party name and installment type
      const partyInstallmentMap = new Map();
      gstRecords.forEach(record => {
        const key = `${record.partyName}-${record.installmentType}`;
        if (partyInstallmentMap.has(key)) {
          // Keep the first one, mark others for deletion
          if (!recordsToDelete.includes(record.id)) {
            recordsToDelete.push(record.id);
            console.log('Marking duplicate party-installment for deletion:', record);
          }
        } else {
          partyInstallmentMap.set(key, record);
        }
      });

      // Method 5: Check for records with same student ID and installment type
      const studentInstallmentMap = new Map();
      gstRecords.forEach(record => {
        const key = `${record.studentId}-${record.installmentType}`;
        if (studentInstallmentMap.has(key)) {
          // Keep the first one, mark others for deletion
          if (!recordsToDelete.includes(record.id)) {
            recordsToDelete.push(record.id);
            console.log('Marking duplicate student-installment for deletion:', record);
          }
        } else {
          studentInstallmentMap.set(key, record);
        }
      });

      // Method 6: Check for records with same party name, installment type, and student ID
      const partyStudentInstallmentMap = new Map();
      gstRecords.forEach(record => {
        const key = `${record.partyName}-${record.installmentType}-${record.studentId}`;
        if (partyStudentInstallmentMap.has(key)) {
          // Keep the first one, mark others for deletion
          if (!recordsToDelete.includes(record.id)) {
            recordsToDelete.push(record.id);
            console.log('Marking duplicate party-student-installment for deletion:', record);
          }
        } else {
          partyStudentInstallmentMap.set(key, record);
        }
      });

      // Method 7: Check for records with same party name, installment type, student ID, and amount
      const partyStudentInstallmentAmountMap = new Map();
      gstRecords.forEach(record => {
        const key = `${record.partyName}-${record.installmentType}-${record.studentId}-${record.totalInvoice}`;
        if (partyStudentInstallmentAmountMap.has(key)) {
          // Keep the first one, mark others for deletion
          if (!recordsToDelete.includes(record.id)) {
            recordsToDelete.push(record.id);
            console.log('Marking duplicate party-student-installment-amount for deletion:', record);
          }
        } else {
          partyStudentInstallmentAmountMap.set(key, record);
        }
      });

      // Remove duplicates from the array
      const uniqueDuplicatesToDelete = [...new Set(recordsToDelete)];

      console.log(`Found ${uniqueDuplicatesToDelete.length} duplicate records to delete`);

      if (uniqueDuplicatesToDelete.length === 0) {
        toast({
          title: "No Duplicates Found",
          description: "All GST records are unique",
        });
        return;
      }

      // Delete duplicate records from Firebase
      for (const recordId of uniqueDuplicatesToDelete) {
        await deleteDoc(doc(db, 'gstRecords', recordId));
        console.log(`Deleted record with ID: ${recordId}`);
      }

      // Update local state
      setGstRecords(prev => prev.filter(record => !uniqueDuplicatesToDelete.includes(record.id)));

      toast({
        title: "Duplicates Cleaned",
        description: `Removed ${uniqueDuplicatesToDelete.length} duplicate GST records`,
      });

      console.log('✅ Duplicate cleanup completed successfully');
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      toast({
        title: "Error",
        description: "Failed to clean up duplicates",
        variant: "destructive",
      });
    }
  };

  const handleDownloadGSTSheet = () => {
    // Format data to match the expected sheet format
    const formattedData = gstRecords.map((record, index) => {
      // Safely convert date to string format
      const dateStr = typeof record.date === 'string' 
        ? record.date 
        : safeRender(record.date);
      return {
        '#': index + 1,
        'Date': dateStr.split('-').reverse().join('-'), // Convert to DD-MM-YYYY format
      'Party Name': record.partyName,
      'Total Invoice': record.totalInvoice,
      'Basic Amount': record.basicAmount,
      'GST': record.gst,
      'Invoice numbers': record.invoiceNumbers.join(', '),
      'HSN': record.hsn,
      'B2B/B2C': record.b2bB2c,
      'Company na': record.companyName,
      'Installment Type': record.installmentType
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(formattedData);
    
    // Set column widths for better formatting
    const colWidths = [
      { wch: 5 },   // #
      { wch: 12 },  // Date
      { wch: 20 },  // Party Name
      { wch: 15 },  // Total Invoice
      { wch: 15 },  // Basic Amount
      { wch: 10 },  // GST
      { wch: 25 },  // Invoice number
      { wch: 8 },   // HSN
      { wch: 10 },  // B2B/B2C
      { wch: 15 },  // Company na
      { wch: 15 }   // Installment Type
    ];
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GST Records');
    XLSX.writeFile(wb, `GST_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadMonthlyGSTSheet = (monthData: any) => {
    // Format data for specific month
    const formattedData = monthData.records.map((record: any, index: number) => {
      // Safely convert date to string format
      const dateStr = typeof record.date === 'string' 
        ? record.date 
        : safeRender(record.date);
      return {
        '#': index + 1,
        'Date': dateStr.split('-').reverse().join('-'), // Convert to DD-MM-YYYY format
      'Party Name': record.partyName,
      'Total Invoice': record.totalInvoice,
      'Basic Amount': record.basicAmount,
      'GST': record.gst,
      'Invoice numbers': record.invoiceNumbers.join(', '),
      'HSN': record.hsn,
      'B2B/B2C': record.b2bB2c,
      'Company na': record.companyName,
      'Installment Type': record.installmentType
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(formattedData);
    
    // Set column widths for better formatting
    const colWidths = [
      { wch: 5 },   // #
      { wch: 12 },  // Date
      { wch: 20 },  // Party Name
      { wch: 15 },  // Total Invoice
      { wch: 15 },  // Basic Amount
      { wch: 10 },  // GST
      { wch: 25 },  // Invoice number
      { wch: 8 },   // HSN
      { wch: 10 },  // B2B/B2C
      { wch: 15 },  // Company na
      { wch: 15 }   // Installment Type
    ];
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthData.month} GST Records`);
    XLSX.writeFile(wb, `GST_Records_${monthData.month.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <Loading 
        fullScreen={true} 
        text="Loading fee records..." 
        color="primary"
        size="lg"
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Enhanced Modern Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm mb-6">
        <div className="max-w-10xl mx-auto px-4 sm:px-6 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Fee Management</h1>
                <p className="text-sm text-slate-500">Manage student fees, payments, and financial records</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                onClick={() => setIsGSTDialogOpen(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm"
                size="sm"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">GST Invoice</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-10xl mx-auto px-4 sm:px-6 pb-8">
        {/* Modern Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">💰 Total Actual Fees</p>
                  <p className="text-2xl font-bold text-slate-900">₹{totalActualFees.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl shadow-sm">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">💸 Total Discounted Fees</p>
                  <p className="text-2xl font-bold text-violet-600">₹{totalDiscountedFees.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-sm">
                  <Percent className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">💵 Total Fees Collected</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{totalFeesCollected.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">🧾 Total Fees Pending (Balance)</p>
                  <p className="text-2xl font-bold text-amber-600">₹{totalFeesPending.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-sm">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">👨‍🎓 Total Students</p>
                  <p className="text-2xl font-bold text-blue-600">{totalStudents}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={feeActiveTab} onValueChange={(v) => setFeeActiveTab(v as 'records' | 'analytics' | 'monthly-due' | 'annual-gst')} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <TabsTrigger
              value="records"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-slate-50"
            >
              <FileText className="w-4 h-4" />
              Fee Records
            </TabsTrigger>
            <TabsTrigger
              value="monthly-due"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-slate-50"
            >
              <CalendarDays className="w-4 h-4" />
              This Month&apos;s Due
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-slate-50"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="annual-gst"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-slate-50"
            >
              <Receipt className="w-4 h-4" />
              Annual GST
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="mt-0">
        {/* Modern Search and Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search students, courses, or contact numbers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="flex items-center gap-2 border-slate-200 hover:bg-slate-50"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
              <Button
                onClick={handleDownloadSheet}
                variant="outline"
                className="flex items-center gap-2 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </div>

          {/* Collapsible Filters Panel */}
          <div className={`mt-4 overflow-hidden transition-all duration-500 ease-in-out ${
            showFilters ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div>
                  <Label>Admission Month</Label>
                  <Select value={filters.admissionMonth} onValueChange={(value) => setFilters(prev => ({...prev, admissionMonth: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      <SelectItem value="JANUARY">January</SelectItem>
                      <SelectItem value="FEBRUARY">February</SelectItem>
                      <SelectItem value="MARCH">March</SelectItem>
                      <SelectItem value="APRIL">April</SelectItem>
                      <SelectItem value="MAY">May</SelectItem>
                      <SelectItem value="JUNE">June</SelectItem>
                      <SelectItem value="JULY">July</SelectItem>
                      <SelectItem value="AUGUST">August</SelectItem>
                      <SelectItem value="SEPTEMBER">September</SelectItem>
                      <SelectItem value="OCTOBER">October</SelectItem>
                      <SelectItem value="NOVEMBER">November</SelectItem>
                      <SelectItem value="DECEMBER">December</SelectItem>
                </SelectContent>
              </Select>
                </div>
                
                <div>
                  <Label>Source</Label>
                  <Select value={filters.source} onValueChange={(value) => setFilters(prev => ({...prev, source: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="Just dial">Just Dial</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Walk-in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
        </div>

                          <div>
                  <Label>Payment Mode</Label>
                  <Select value={filters.paymentMode} onValueChange={(value) => setFilters(prev => ({...prev, paymentMode: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Modes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modes</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                          </div>
                
                        <div>
                  <Label>Fees Balance</Label>
                  <Select value={filters.feesBalance} onValueChange={(value) => setFilters(prev => ({...prev, feesBalance: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="cleared">Cleared</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                        </div>
                
                        <div>
                  <Label>ZICA/BETTERCODE</Label>
                  <Select value={filters.zicaBettercode} onValueChange={(value) => setFilters(prev => ({...prev, zicaBettercode: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="ZICA">ZICA</SelectItem>
                      <SelectItem value="BETTERCODE">BETTERCODE</SelectItem>
                      <SelectItem value="Non-ZICA">Non-Zica</SelectItem>
                    </SelectContent>
                  </Select>
                      </div>
                      
                            <div>
                  <Label>Fees Structure</Label>
                  <Select value={filters.feesStructure} onValueChange={(value) => setFilters(prev => ({...prev, feesStructure: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="OLD">OLD</SelectItem>
                      <SelectItem value="NEW">NEW</SelectItem>
                    </SelectContent>
                  </Select>
                            </div>
                            </div>
                            </div>
                          </div>
                        </div>
                                                
        {/* Modern Fee Records Table */}
            <Card className="border border-slate-200/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-6">
            <CardTitle className="text-lg font-bold text-slate-800">Fee Records</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-30">
                      <TableRow className="bg-slate-50 border-b border-slate-200">
                    <SortableTableHead className="sticky left-0 z-50 bg-slate-50 w-16 min-w-[64px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200" sortConfig={sortConfig} sortKey="srNo" requestSort={requestSort}>Sr No</SortableTableHead>
                    <SortableTableHead className="sticky left-[64px] z-50 bg-slate-50 min-w-[180px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" sortConfig={sortConfig} sortKey="studentName" requestSort={requestSort}>Student Name</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="source" requestSort={requestSort}>Source</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="parentsContact" requestSort={requestSort}>Parents Contact</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="phone" requestSort={requestSort}>Contact Number</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="admissionMonth" requestSort={requestSort}>Admission Month</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="admissionDate" requestSort={requestSort}>Date of Admission</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="zicaZima" requestSort={requestSort}>ZICA/BETTERCODE</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="course" requestSort={requestSort}>Course</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="courseDuration" requestSort={requestSort}>Course Duration</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="courseStartDate" requestSort={requestSort}>Course Start Date</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfig} sortKey="actualFees" requestSort={requestSort}>Actual Fees</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfig} sortKey="discountedFees" requestSort={requestSort}>Discounted Fees</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfig} sortKey="feesPaid" requestSort={requestSort}>Fees Paid</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfig} sortKey="feesBalance" requestSort={requestSort}>Fees Balance</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="feesPaidDate" requestSort={requestSort}>Fees Paid Date</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfig} sortKey="paymentMode" requestSort={requestSort}>Payment Mode</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfig} sortKey="noOfInstallments" requestSort={requestSort}>No. of Installments</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfig} sortKey="feesBalance" requestSort={requestSort}>Remaining Installments</SortableTableHead>
                        <TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                  {filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={20} className="py-10 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-10 h-10 text-gray-300" />
                          <p className="text-base font-semibold">No fee records found for this search.</p>
                          {searchTerm.trim() && (
                            <div className="mt-2 space-y-2">
                              {isStudentSearchLoading ? (
                                <p className="text-sm text-gray-500">Looking for matching students...</p>
                              ) : studentSuggestions.length > 0 ? (
                                <>
                                  <p className="text-sm text-gray-600">
                                    Found {studentSuggestions.length} student
                                    {studentSuggestions.length > 1 ? 's' : ''} in Students. Add to Fee Management:
                                  </p>
                                  <div className="mt-2 flex flex-col gap-2 items-center">
                                    {studentSuggestions.slice(0, 3).map((student) => (
                                      <div
                                        key={student.id}
                                        className="flex flex-wrap items-center justify-center gap-3 px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm"
                                      >
                                        <span className="font-medium">
                                          {`${student.firstName || ''} ${student.lastName || ''}`.trim() ||
                                            'Unnamed Student'}
                                        </span>
                                        {student.phone && (
                                          <span className="text-xs text-gray-500">📞 {student.phone}</span>
                                        )}
                                        {student.course && (
                                          <span className="text-xs text-gray-500">📚 {student.course}</span>
                                        )}
                                        <Button
                                          size="sm"
                                          className="h-8 px-3"
                                          onClick={() => handleCreateRecordFromStudent(student)}
                                        >
                                          Add to Fee Management
                                        </Button>
                                      </div>
                                    ))}
                                    {studentSuggestions.length > 3 && (
                                      <p className="text-xs text-gray-500">
                                        Showing first 3 matches of {studentSuggestions.length}.
                                      </p>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  No matching students found in Students for this search.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredRecords.length > 0 &&
                  numberedFeeRecords.map((record) => (
                    <TableRow key={record.id} className="group/row">
                      <TableCell className="sticky left-0 z-20 bg-white group-hover/row:bg-slate-50 transition-colors w-16 min-w-[64px] border-r border-slate-100">{record.srNo}</TableCell>
                      <TableCell className="sticky left-[64px] z-20 bg-white group-hover/row:bg-slate-50 transition-colors min-w-[180px] font-medium border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <button 
                          className="hover:underline text-blue-600 font-medium text-left"
                          onClick={() => {
                            setViewingRecord(record);
                            setIsViewDialogOpen(true);
                          }}
                        >
                          {record.studentName}
                        </button>
                      </TableCell>
                      <TableCell>{record.source}</TableCell>
                      <TableCell>{record.parentsContactNumber || '-'}</TableCell>
                      <TableCell>{record.contactNumber}</TableCell>
                      <TableCell>{record.admissionMonth}</TableCell>
                      <TableCell>{safeRender(record.dateOfAdmission)}</TableCell>
                            <TableCell>
                        <Badge 
                          variant={record.zicaBettercode === 'ZICA' ? 'default' : record.zicaBettercode === 'Non-ZICA' ? 'outline' : 'secondary'}
                          className={record.zicaBettercode === 'Non-ZICA' ? 'border-orange-500 text-orange-600' : ''}
                        >
                          {record.zicaBettercode === 'Non-ZICA' ? 'Non-Zica' : 
                           record.zicaBettercode === 'BETTERCODE' ? 'Bettercode' : 
                           record.zicaBettercode === 'ZICA' ? 'Zica' : 
                           record.zicaBettercode}
                        </Badge>
                            </TableCell>
                      <TableCell>{record.course}</TableCell>
                      <TableCell>{record.courseDuration}</TableCell>
                      <TableCell>{safeRender(record.courseStartDate)}</TableCell>
                      <TableCell>₹{record.actualFees.toLocaleString()}</TableCell>
                      <TableCell>₹{record.discountedFees.toLocaleString()}</TableCell>
                      <TableCell>₹{record.feesPaid.toLocaleString()}</TableCell>
                            <TableCell>
                        <Badge variant={record.feesBalance === 0 ? 'default' : 'destructive'}>
                          ₹{record.feesBalance.toLocaleString()}
                              </Badge>
                            </TableCell>
                      <TableCell>{safeRender(record.feesPaidDate) || '-'}</TableCell>
                      <TableCell>{record.paymentMode}</TableCell>
                      <TableCell>{record.numberOfInstallments}</TableCell>
                      <TableCell>{record.balanceInstallments}</TableCell>
                            <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRecord(record);
                              setIsEditDialogOpen(true);
                            }}
                            title="Edit Record"
                          >
                            <Edit className="w-4 h-4" />
                              </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRecord(record.id)}
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                            </TableCell>
                          </TableRow>
                  ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="monthly-due" className="mt-0">
            <TooltipProvider delayDuration={100}>
            <Card className="border border-slate-200/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">
                  {new Date().toLocaleString('default', { month: 'long' })} Expected Installments
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Students with due dates this month. Pay or follow up on these installments.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 border-b border-slate-200">
                        <SortableTableHead className="sticky left-0 z-50 bg-slate-50 w-16 min-w-[64px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200" sortConfig={sortConfigDue} sortKey="srNo" requestSort={requestSortDue}>Sr No</SortableTableHead>
                        <SortableTableHead className="sticky left-[64px] z-50 bg-slate-50 min-w-[180px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" sortConfig={sortConfigDue} sortKey="studentName" requestSort={requestSortDue}>Student Name</SortableTableHead>
                        <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigDue} sortKey="course" requestSort={requestSortDue}>Course</SortableTableHead>
                        <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigDue} sortKey="contact" requestSort={requestSortDue}>Contact</SortableTableHead>
                        <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigDue} sortKey="dueDate" requestSort={requestSortDue}>Due Date</SortableTableHead>
                        <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfigDue} sortKey="expectedAmount" requestSort={requestSortDue}>Expected Amount</SortableTableHead>
                        <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfigDue} sortKey="balanceDue" requestSort={requestSortDue}>Balance Due</SortableTableHead>
                        <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfigDue} sortKey="status" requestSort={requestSortDue}>Status</SortableTableHead>
                        <TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedThisMonthDueRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                              <CalendarDays className="w-10 h-10 text-slate-300" />
                              <p className="text-base font-medium">No installments due this month</p>
                              <p className="text-sm text-slate-400">Students with due dates in {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} will appear here.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedThisMonthDueRecords.map((record, index) => (
                          <TableRow key={record.id} className="group/row border-b border-slate-100 hover:bg-slate-50/50">
                            <TableCell className="sticky left-0 z-20 bg-white group-hover/row:bg-slate-50 transition-colors w-16 min-w-[64px] py-3 text-slate-700 border-r border-slate-100 tabular-nums">{record.srNo ?? "—"}</TableCell>
                            <TableCell className="sticky left-[64px] z-20 bg-white group-hover/row:bg-slate-50 transition-colors min-w-[180px] py-3 font-medium text-slate-800 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{record.studentName}</TableCell>
                            <TableCell className="py-3 text-slate-600">{record.course}</TableCell>
                            <TableCell className="py-3 text-slate-600">{record.contactNumber || record.parentsContactNumber || '-'}</TableCell>
                            <TableCell className="py-3 text-slate-600">{record.dueDateParsed ? formatDate(record.dueDateParsed) : '-'}</TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TableCell className="py-3 text-right font-medium text-slate-800 cursor-default">₹{(record.expectedAmount ?? 0).toLocaleString('en-IN')}</TableCell>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-violet-100 border-2 border-violet-300 text-violet-900 shadow-lg" side="top">
                                <RemarkTooltipContent record={record} onEditRemark={() => { setEditingRemarkRecordId(record.id); setRemarkEditValue(record.remarks?.trim() || ''); setIsRemarkEditDialogOpen(true); }} />
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TableCell className="py-3 text-right font-medium text-amber-600 cursor-default">₹{Number(record.feesBalance).toLocaleString('en-IN')}</TableCell>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-violet-100 border-2 border-violet-300 text-violet-900 shadow-lg" side="top">
                                <RemarkTooltipContent record={record} onEditRemark={() => { setEditingRemarkRecordId(record.id); setRemarkEditValue(record.remarks?.trim() || ''); setIsRemarkEditDialogOpen(true); }} />
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TableCell className="py-3 text-center cursor-default">
                                  <Badge variant={record.status === 'Overdue' ? 'destructive' : 'secondary'} className={record.status === 'Overdue' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}>
                                    {record.status}
                                  </Badge>
                                </TableCell>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-violet-100 border-2 border-violet-300 text-violet-900 shadow-lg" side="top">
                                <RemarkTooltipContent record={record} onEditRemark={() => { setEditingRemarkRecordId(record.id); setRemarkEditValue(record.remarks?.trim() || ''); setIsRemarkEditDialogOpen(true); }} />
                              </TooltipContent>
                            </Tooltip>
                            <TableCell className="py-3 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleWhatsAppFeeReminder(record)}
                                    className="hover:bg-green-50 hover:text-[#25D366] hover:border-[#25D366]/50 transition-all duration-200 p-1 sm:p-2 h-7 sm:h-8 w-7 sm:w-8"
                                  >
                                    <img src={whatsappIcon} alt="WhatsApp" className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Send WhatsApp reminder</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            </TooltipProvider>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <div className="px-1 py-4 md:px-2 md:py-5 space-y-6">
              {/* 1. Fees Collected vs Pending - This month cards + Stacked Column */}
              <Card className="border border-slate-200/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Fees Collected vs Pending</CardTitle>
                  <CardDescription>By admission month. Legend: Fees Paid, Fees Balance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* This month summary cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">This month expected</p>
                      <p className="text-xl font-bold text-slate-800 mt-0.5">₹{thisMonthStats.expectedThisMonth.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                      <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">This month collected</p>
                      <p className="text-xl font-bold text-emerald-700 mt-0.5">₹{thisMonthStats.collectedThisMonth.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
                      <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">This month pending</p>
                      <p className="text-xl font-bold text-amber-700 mt-0.5">₹{thisMonthStats.pendingThisMonth.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  {/* Chart - reduced height */}
                  {feeAnalytics.feesCollectedVsPendingByMonth.length > 0 ? (
                    <ChartContainer config={{ feesPaid: { label: "Fees Paid", color: "hsl(142, 76%, 36%)" }, feesBalance: { label: "Fees Balance", color: "hsl(25, 95%, 53%)" } } satisfies ChartConfig} className="h-[200px] w-full">
                      <BarChart data={feeAnalytics.feesCollectedVsPendingByMonth} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => (v && v.length > 4 ? String(v).slice(0, 3) : v)} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Legend />
                        <Bar dataKey="feesPaid" stackId="a" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} name="Fees Paid" />
                        <Bar dataKey="feesBalance" stackId="a" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} name="Fees Balance" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data by admission month</div>
                  )}
                </CardContent>
              </Card>

              {/* 2. Course-wise Revenue - Clustered Column */}
              <Card className="border border-slate-200/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Course-wise Revenue</CardTitle>
                  <CardDescription>Total fees paid by course.</CardDescription>
                </CardHeader>
                <CardContent>
                  {feeAnalytics.courseWiseRevenue.length > 0 ? (
                    <AnalyticsCategoryBarChart
                      data={feeAnalytics.courseWiseRevenue.map((d) => ({
                        name: d.course,
                        totalFeesPaid: d.totalFeesPaid,
                      }))}
                      dataKey="totalFeesPaid"
                      fill="hsl(220, 70%, 50%)"
                      valueLabel="Fees paid (₹)"
                    />
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">No course revenue data</div>
                  )}
                </CardContent>
              </Card>

              {/* 3. Discount Analysis - Bar Chart */}
              <Card className="border border-slate-200/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Discount Analysis</CardTitle>
                  <CardDescription>Total discount (Actual − Discounted) by course.</CardDescription>
                </CardHeader>
                <CardContent>
                  {feeAnalytics.discountAnalysisData.length > 0 ? (
                    <AnalyticsCategoryBarChart
                      data={feeAnalytics.discountAnalysisData.map((d) => ({
                        name: d.course,
                        totalDiscount: d.totalDiscount,
                      }))}
                      dataKey="totalDiscount"
                      fill="hsl(280, 65%, 60%)"
                      valueLabel="Discount (₹)"
                    />
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">No discount data</div>
                  )}
                </CardContent>
              </Card>

              {/* 4. Payment Trend Over Time - Line Chart */}
              <Card className="border border-slate-200/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Payment Trend Over Time</CardTitle>
                  <CardDescription>Sum of fees paid by fees paid date (month).</CardDescription>
                </CardHeader>
                <CardContent>
                  {feeAnalytics.paymentTrendData.length > 0 ? (
                    <ChartContainer config={{ sumFeesPaid: { label: "Fees Paid (Sum)", color: "hsl(220, 70%, 50%)" } } satisfies ChartConfig} className="h-[300px] w-full">
                      <LineChart data={feeAnalytics.paymentTrendData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Line type="monotone" dataKey="sumFeesPaid" stroke="hsl(220, 70%, 50%)" strokeWidth={2} dot={{ r: 4 }} name="Fees Paid (Sum)" />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No payment trend data (add fees paid dates)</div>
                  )}
                </CardContent>
              </Card>

              {/* 5. Business Analytics - Pie (ZICA, Non-ZICA, AIGT revenue) */}
              <Card className="border border-slate-200/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Business Analytics</CardTitle>
                  <CardDescription>Revenue by ZICA, Non-ZICA, AIGT.</CardDescription>
                </CardHeader>
                <CardContent>
                  {feeAnalytics.businessPieData.length > 0 ? (
                    <ChartContainer config={{ ZICA: { label: "ZICA", color: "hsl(262, 83%, 58%)" }, "Non-ZICA": { label: "Non-ZICA", color: "hsl(25, 95%, 53%)" }, AIGT: { label: "AIGT", color: "hsl(346, 77%, 50%)" } } satisfies ChartConfig} className="h-[280px] w-full">
                      <RechartsPieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']} />
                        <Pie data={feeAnalytics.businessPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} label={({ name, value, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}>
                          {feeAnalytics.businessPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No business revenue data</div>
                  )}
                </CardContent>
              </Card>

              {/* 6. Combo: Revenue (Bar) + Count (Line) by Month */}
              <Card className="border border-slate-200/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Sum of Installments & Count</CardTitle>
                  <CardDescription>Bar: Revenue by month. Line: Payment count (secondary axis).</CardDescription>
                </CardHeader>
                <CardContent>
                  {feeAnalytics.installmentComboData.length > 0 ? (
                    <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(142, 76%, 36%)" }, count: { label: "Count", color: "hsl(220, 70%, 50%)" } } satisfies ChartConfig} className="h-[320px] w-full">
                      <ComposedChart data={feeAnalytics.installmentComboData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis yAxisId="right" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="revenue" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Revenue" />
                        <Line yAxisId="right" type="monotone" dataKey="count" stroke="hsl(220, 70%, 50%)" strokeWidth={2} dot={{ r: 4 }} name="Count" />
                      </ComposedChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">No installment combo data (add fees paid dates)</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="annual-gst" className="mt-0">
            <Suspense fallback={<InlineLoading />}>
              <AnnualGst />
            </Suspense>
          </TabsContent>
        </Tabs>

      </div>

      <FeeDetailsDialog 
        isOpen={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        record={viewingRecord as any}
        onUpdate={handleQuickUpdate as any}
        checkGstExists={(uniqueKey) => gstRecords.some(r => r.uniqueKey === uniqueKey)}
        onGstRecordCreated={(record) => {
          setGstRecords((prev) => {
            const uniqueKey = record.uniqueKey as string | undefined;
            if (uniqueKey && prev.some((r) => r.uniqueKey === uniqueKey)) return prev;
            return [...prev, record as unknown as GSTInvoiceRecord];
          });
        }}
        onGstRecordDeleted={(deletedIds) => {
          if (deletedIds.length === 0) return;
          setGstRecords((prev) => prev.filter((r) => !deletedIds.includes(r.id)));
        }}
      />

      {/* Add Record Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          // Reset form when dialog is closed (use form default values)
          setNumberOfInstallments(0);
          feeForm.reset(); // This will use the defaultValues from useForm
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-0 shadow-2xl">
          <DialogHeader className="pb-6 border-b border-gray-200/50">
            <DialogTitle className="flex items-center gap-4 text-3xl font-bold text-gray-900">
              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-lg">
                <Plus className="w-8 h-8 text-white" />
                        </div>
                        <div>
                <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Add Fee Record
                        </div>
                <div className="text-sm text-gray-600 font-normal mt-1">
                  Create a new fee record for student enrollment
                      </div>
                        </div>
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={feeForm.handleSubmit(handleCreateRecord)} className="space-y-8 pt-6">
            {/* Student Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Student Information</h3>
                        </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Student Name *</Label>
                  <Input 
                    {...feeForm.register('studentName', { required: true })} 
                    placeholder="Enter student full name"
                    className="h-11"
                  />
                      </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Contact Number *</Label>
                  <Input 
                    {...feeForm.register('contactNumber', { required: true })} 
                    placeholder="Enter contact number"
                    className="h-11"
                  />
                    </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Parents Contact</Label>
                  <Input 
                    {...feeForm.register('parentsContactNumber')} 
                    placeholder="Enter parents contact"
                    className="h-11"
                  />
            </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Source *</Label>
                  <Input 
                    {...feeForm.register('source', { required: true })} 
                    placeholder="e.g., Just Dial, Google, Facebook"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Admission Month</Label>
                  <Select 
                    value={feeForm.watch('admissionMonth')} 
                    onValueChange={handleAdmissionMonthChange}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JANUARY">January</SelectItem>
                      <SelectItem value="FEBRUARY">February</SelectItem>
                      <SelectItem value="MARCH">March</SelectItem>
                      <SelectItem value="APRIL">April</SelectItem>
                      <SelectItem value="MAY">May</SelectItem>
                      <SelectItem value="JUNE">June</SelectItem>
                      <SelectItem value="JULY">July</SelectItem>
                      <SelectItem value="AUGUST">August</SelectItem>
                      <SelectItem value="SEPTEMBER">September</SelectItem>
                      <SelectItem value="OCTOBER">October</SelectItem>
                      <SelectItem value="NOVEMBER">November</SelectItem>
                      <SelectItem value="DECEMBER">December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Date of Admission</Label>
                  <Input 
                    type="date"
                    {...feeForm.register('dateOfAdmission')} 
                    className="h-11"
                  />
                </div>
              </div>
      </div>

            {/* Course Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Course Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Course *</Label>
                  {!showCustomCourseInput ? (
                  <Select
                    value={feeForm.watch("course") || undefined}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        setShowCustomCourseInput(true);
                        feeForm.setValue("course", "");
                      } else {
                        setShowCustomCourseInput(false);
                        feeForm.setValue("course", value);
                      }
                    }}
                  >
                    <SelectTrigger id="course-select" className="w-full h-11">
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999] max-h-[300px]">
                      {/* Search Input */}
                      <div className="sticky top-0 bg-white p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search courses..."
                            value={courseSearchTerm}
                            onChange={(e) => setCourseSearchTerm(e.target.value)}
                            className="pl-8 h-9"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      
                      {/* Filtered Course List */}
                      {courses
                        .filter(course => 
                          course.toLowerCase().includes(courseSearchTerm.toLowerCase())
                        )
                        .map((course, index) => (
                          <SelectItem 
                            key={`course-${index}-${course}`} 
                            value={course}
                            className={course === "Other" ? "font-semibold text-blue-600 border-t mt-1" : ""}
                          >
                            {course === "Other" ? (
                              <div className="flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                {course} (Add Custom Course)
                              </div>
                            ) : (
                              course
                            )}
                          </SelectItem>
                        ))}
                      
                      {courses.filter(course => 
                        course.toLowerCase().includes(courseSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No courses found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  /* Custom Course Input */
                  <div className="space-y-2 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-blue-700 font-semibold">Add Custom Course</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowCustomCourseInput(false);
                          setCustomCourseInput("");
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Enter custom course name"
                      value={customCourseInput}
                      onChange={(e) => setCustomCourseInput(e.target.value)}
                      className="w-full"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          if (customCourseInput.trim()) {
                            try {
                              // Save to Firestore
                              await addDoc(collection(db, 'customCourses'), {
                                courseName: customCourseInput.trim(),
                                createdAt: Timestamp.now(),
                                createdBy: userProfile?.uid || 'unknown'
                              });
                              
                              // Update local state
                              setCustomCourses(prev => [...prev, customCourseInput.trim()]);
                              feeForm.setValue("course", customCourseInput.trim());
                              setCustomCourseInput("");
                              setShowCustomCourseInput(false);
                              
                              toast({
                                title: "Success",
                                description: "Custom course added successfully!",
                              });
                            } catch (error) {
                              console.error('Error adding custom course:', error);
                              toast({
                                title: "Error",
                                description: "Failed to add custom course",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 flex-1"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Course
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowCustomCourseInput(false);
                          setCustomCourseInput("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Course Duration *</Label>
                  <Input 
                    {...feeForm.register('courseDuration', { required: true })} 
                    placeholder="e.g., 3 months, 6 months"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Course Start Date</Label>
                  <Input 
                    type="date"
                    {...feeForm.register('courseStartDate')} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Select Business</Label>
                  <Select 
                    value={feeForm.watch('zicaBettercode')} 
                    onValueChange={(value) => feeForm.setValue('zicaBettercode', value as any)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                      <SelectItem value="Zica">Zica</SelectItem>
                      <SelectItem value="AIGT">AIGT</SelectItem>
                      <SelectItem value="Non-ZICA">Non-Zica</SelectItem>
                </SelectContent>
              </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Structure</Label>
                  <Select 
                    value={feeForm.watch('feesStructure')} 
                    onValueChange={(value) => feeForm.setValue('feesStructure', value as any)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select structure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OLD">OLD</SelectItem>
                      <SelectItem value="NEW">NEW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Financial Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Financial Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Actual Fees *</Label>
                <Input
                  type="number"
                    {...feeForm.register('actualFees', { required: true })} 
                    placeholder="Enter actual fees"
                    className="h-11"
                />
              </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Discounted Fees *</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('discountedFees', { required: true })} 
                    placeholder="Enter discounted fees"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Paid *</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('feesPaid', { required: true })} 
                    placeholder="Enter fees paid"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Balance</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('feesBalance', { 
                      valueAsNumber: true
                    })} 
                    readOnly
                    placeholder="Auto-calculated"
                    className="h-11 bg-gray-50 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Registration Amount</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('registrationAmount')} 
                    placeholder="Enter registration amount"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                  <Select 
                    value={feeForm.watch('paymentMode')} 
                    onValueChange={(value) => feeForm.setValue('paymentMode', value as any)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {feeForm.watch('paymentMode') === 'Cheque' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Cheque Number *</Label>
                    <Input 
                      {...feeForm.register('chequeNumber', { required: feeForm.watch('paymentMode') === 'Cheque' })} 
                      placeholder="Enter cheque number"
                      className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Paid Date</Label>
                  <Input 
                    type="date"
                    {...feeForm.register('feesPaidDate')} 
                    className="h-11"
                  />
                </div>
              </div>
            </div>
            
            {/* Installment Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <Calendar className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">Installment Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Number of Installments</Label>
                  <Input
                    type="number" 
                    min="0"
                    step="1"
                    {...feeForm.register('numberOfInstallments', {
                      onChange: (e) => {
                        const value = parseInt(e.target.value) || 0;
                        handleNumberOfInstallmentsChange(value);
                      }
                    })}
                    placeholder="Enter number of installments"
                    className="h-11 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Installments Paid</Label>
                  <Input
                    type="number"
                    min="0"
                    value={installmentsPaidInput}
                    onChange={(e) => setInstallmentsPaidInput(parseInt(e.target.value) || 0)}
                    placeholder="Enter paid installments"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Remaining Installments</Label>
                  <Input
                    type="number" 
                    {...feeForm.register('balanceInstallments')} 
                    placeholder="Enter balance"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Due Date</Label>
                  <Input 
                    type="date"
                    {...feeForm.register('dueDate')} 
                    className="h-11"
                  />
            </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Remarks</Label>
                  <Input 
                    {...feeForm.register('remarks')} 
                    placeholder="Enter remarks"
                    className="h-11"
                  />
                </div>
              </div>
              
              {/* Individual Installment Fields */}
              {numberOfInstallments > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold text-gray-800">Individual Installments</h4>
                    {remainingDistributableLive !== 0 && (
                      <div className={`text-sm font-medium px-3 py-1 rounded-full ${remainingDistributableLive < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        Remaining to Distribute: ₹{remainingDistributableLive.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: numberOfInstallments }, (_, index) => {
                      const installmentNumber = index + 1;
                      const fieldName = `installment${installmentNumber.toString().padStart(2, '0')}` as any;
                      
                      return (
                        <div key={fieldName} className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            Installment {installmentNumber.toString().padStart(2, '0')}
                          </Label>
                          <Input 
                            type="number" 
                            {...feeForm.register(fieldName, {
                              onChange: (e) => handleManualInstallmentChange(index, e.target.value)
                            })} 
                            placeholder="Amount"
                            className="h-10"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                className="h-11 px-8"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isCreating}
                className="h-11 px-8 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <InlineLoading size="sm" color="white" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Fee Record
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-0 shadow-2xl">
          <DialogHeader className="pb-6 border-b border-gray-200/50">
            <DialogTitle className="flex items-center gap-4 text-3xl font-bold text-gray-900">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                <Edit className="w-8 h-8 text-white" />
              </div>
            <div>
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Edit Fee Record
                </div>
                <div className="text-sm text-gray-600 font-normal mt-1">
                  Update fee record information
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={feeForm.handleSubmit(handleUpdateRecord)} className="space-y-8 pt-6">
            {/* Student Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Student Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Student Name *</Label>
                  <Input 
                    {...feeForm.register('studentName', { required: true })} 
                    placeholder="Enter student full name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Contact Number *</Label>
                  <Input 
                    {...feeForm.register('contactNumber', { required: true })} 
                    placeholder="Enter contact number"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Parents Contact</Label>
                  <Input 
                    {...feeForm.register('parentsContactNumber')} 
                    placeholder="Enter parents contact"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Source *</Label>
                  <Input 
                    {...feeForm.register('source', { required: true })} 
                    placeholder="e.g., Just Dial, Google, Facebook"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Admission Month</Label>
                  <Select 
                    value={feeForm.watch('admissionMonth')} 
                    onValueChange={handleAdmissionMonthChange}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                      <SelectItem value="JANUARY">January</SelectItem>
                      <SelectItem value="FEBRUARY">February</SelectItem>
                      <SelectItem value="MARCH">March</SelectItem>
                      <SelectItem value="APRIL">April</SelectItem>
                      <SelectItem value="MAY">May</SelectItem>
                      <SelectItem value="JUNE">June</SelectItem>
                      <SelectItem value="JULY">July</SelectItem>
                      <SelectItem value="AUGUST">August</SelectItem>
                      <SelectItem value="SEPTEMBER">September</SelectItem>
                      <SelectItem value="OCTOBER">October</SelectItem>
                      <SelectItem value="NOVEMBER">November</SelectItem>
                      <SelectItem value="DECEMBER">December</SelectItem>
                </SelectContent>
               </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Date of Admission</Label>
                  <Input 
                    type="date"
                    {...feeForm.register('dateOfAdmission')} 
                    className="h-11"
                  />
                </div>
              </div>
            </div>
            
            {/* Course Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Course Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Course *</Label>
                <Input
                    {...feeForm.register('course', { required: true })} 
                    placeholder="Enter course name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Course Duration *</Label>
                  <Input 
                    {...feeForm.register('courseDuration', { required: true })} 
                    placeholder="e.g., 3 months, 6 months"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Course Start Date</Label>
                  <Input 
                    type="date"
                    {...feeForm.register('courseStartDate')} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Select Business</Label>
                  <Select 
                    value={feeForm.watch('zicaBettercode')} 
                    onValueChange={(value) => feeForm.setValue('zicaBettercode', value as any)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Zica">Zica</SelectItem>
                      <SelectItem value="AIGT">AIGT</SelectItem>
                      <SelectItem value="Non-ZICA">Non-Zica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Structure</Label>
                  <Select 
                    value={feeForm.watch('feesStructure')} 
                    onValueChange={(value) => feeForm.setValue('feesStructure', value as any)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select structure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OLD">OLD</SelectItem>
                      <SelectItem value="NEW">NEW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Financial Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Financial Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Actual Fees *</Label>
                  <Input 
                  type="number"
                    {...feeForm.register('actualFees', { required: true, valueAsNumber: true })} 
                    placeholder="Enter actual fees"
                    className="h-11"
                />
              </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Discounted Fees *</Label>
                <Input
                    type="number" 
                    {...feeForm.register('discountedFees', { required: true })} 
                    placeholder="Enter discounted fees"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Paid *</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('feesPaid', { required: true })} 
                    placeholder="Enter fees paid"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Balance</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('feesBalance', { 
                      valueAsNumber: true
                    })} 
                    readOnly
                    placeholder="Auto-calculated"
                    className="h-11 bg-gray-50 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Registration Amount</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('registrationAmount')} 
                    placeholder="Enter registration amount"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                  <Select 
                    value={feeForm.watch('paymentMode')} 
                    onValueChange={(value) => feeForm.setValue('paymentMode', value as any)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {feeForm.watch('paymentMode') === 'Cheque' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Cheque Number *</Label>
                    <Input 
                      {...feeForm.register('chequeNumber', { required: feeForm.watch('paymentMode') === 'Cheque' })} 
                      placeholder="Enter cheque number"
                      className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Fees Paid Date</Label>
                  <Input 
                  type="date"
                    {...feeForm.register('feesPaidDate')} 
                    className="h-11"
                  />
            </div>
              </div>
            </div>

            {/* Installment Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/50">
                <Calendar className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">Installment Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Number of Installments</Label>
                  <Input
                    type="number" 
                    min="0"
                    step="1"
                    {...feeForm.register('numberOfInstallments', {
                      onChange: (e) => {
                        const value = parseInt(e.target.value) || 0;
                        handleNumberOfInstallmentsChange(value);
                      }
                    })}
                    placeholder="Enter number of installments"
                    className="h-11 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Remaining Installments</Label>
                  <Input 
                    type="number" 
                    {...feeForm.register('balanceInstallments')} 
                    placeholder="Enter balance"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Due Date</Label>
                  <Input 
                    type="date"
                    {...feeForm.register('dueDate')} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Remarks</Label>
                  <Input 
                    {...feeForm.register('remarks')} 
                    placeholder="Enter remarks"
                    className="h-11"
                  />
                </div>
              </div>
              
              {/* Individual Installment Fields */}
              {numberOfInstallments > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold text-gray-800">Individual Installments</h4>
                    {remainingDistributableLive !== 0 && (
                      <div className={`text-sm font-medium px-3 py-1 rounded-full ${remainingDistributableLive < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        Remaining to Distribute: ₹{remainingDistributableLive.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: numberOfInstallments }, (_, index) => {
                      const installmentNumber = index + 1;
                      const fieldName = `installment${installmentNumber.toString().padStart(2, '0')}` as any;
                      
                      return (
                        <div key={fieldName} className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            Installment {installmentNumber.toString().padStart(2, '0')}
                          </Label>
                          <Input 
                            type="number" 
                            {...feeForm.register(fieldName, {
                              onChange: (e) => handleManualInstallmentChange(index, e.target.value)
                            })} 
                            placeholder="Amount"
                            className="h-10"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="h-11 px-8"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isUpdating}
                className="h-11 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <>
                    <InlineLoading size="sm" color="white" />
                    <span className="ml-2">Updating...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Update Record
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enhanced GST Invoice Dialog - Modern Two-Section Layout */}
      <Dialog open={isGSTDialogOpen} onOpenChange={setIsGSTDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[92vh] h-[92vh] flex flex-col p-0 border-0 bg-white shadow-2xl rounded-xl overflow-hidden">
          <DialogTitle className="sr-only">GST Invoice Management</DialogTitle>
          
          {/* Modern Header */}
          <div className="sticky top-0 z-20 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white px-6 py-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">GST Invoice Management</h2>
                  <p className="text-emerald-100 text-xs mt-0.5">Comprehensive invoice tracking and analytics</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGSTDialogOpen(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Two-Section Layout */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            
            {/* LEFT SECTION - Summary Cards + Monthly Breakdown */}
            <div className="w-72 flex flex-col bg-gradient-to-br from-gray-50 to-white border-r border-gray-200 shrink-0 h-full overflow-y-auto custom-scrollbar">
              <div className="p-4 flex-shrink-0">
                {/* Summary Header */}
                <div className="mb-3">
                  <h3 className="text-base font-bold text-gray-900 mb-0.5">Financial Summary</h3>
                  <p className="text-xs text-gray-500">Overview of all GST records</p>
                </div>

                {/* Total Cards */}
                <div className="space-y-2.5">
                  {/* Basic Amount Card */}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm">
                        <Calculator className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[10px] font-semibold text-blue-100 uppercase tracking-wide">Taxable</span>
                    </div>
                    <p className="text-2xl font-bold text-white mb-0.5">₹{gstTotalBasic.toLocaleString()}</p>
                    <p className="text-blue-100 text-[10px]">Pre-tax amount</p>
                  </div>

                  {/* Total Invoice Card */}
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm">
                        <Receipt className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-100 uppercase tracking-wide">Total</span>
                    </div>
                    <p className="text-2xl font-bold text-white mb-0.5">₹{gstTotalInvoice.toLocaleString()}</p>
                    <p className="text-emerald-100 text-[10px]">Including GST</p>
                  </div>

                  {/* GST Amount Card */}
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm">
                        <Percent className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[10px] font-semibold text-purple-100 uppercase tracking-wide">GST</span>
                    </div>
                    <p className="text-2xl font-bold text-white mb-0.5">₹{gstTotalGST.toLocaleString()}</p>
                    <p className="text-purple-100 text-[10px]">18% Tax collected</p>
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown - Scrollable */}
              {gstRecordsByMonth.length > 0 && (
                <div className="px-4 pb-4 border-t border-gray-200/60 pt-3">
                  <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Monthly Breakdown
                  </h4>
                  <div className="space-y-1.5 pr-1">
                    {gstRecordsByMonth.map((monthData, index) => {
                      const colors = [
                        { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                        { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
                        { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
                        { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
                      ];
                      const color = colors[index % colors.length];
                      const isExpanded = expandedGstMonths.has(monthData.sortKey);
                      
                      return (
                        <button
                          key={monthData.sortKey}
                          type="button"
                          onClick={() => scrollToGstMonth(monthData.sortKey)}
                          className={`w-full text-left ${color.bg} ${color.border} border rounded-md p-2.5 flex-shrink-0 transition-all hover:shadow-sm ${isExpanded ? 'ring-2 ring-emerald-400/60' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-bold ${color.text}`}>{monthData.month}</span>
                            <span className="text-[10px] text-gray-500 font-medium">{monthData.records.length} records</span>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-gray-600">Total:</span>
                              <span className={`font-bold ${color.text}`}>₹{monthData.totalInvoice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-gray-600">GST:</span>
                              <span className="font-semibold text-gray-700">₹{monthData.totalGST.toLocaleString()}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SECTION - Data Table (Scrollable) */}
            <div className="flex-1 overflow-hidden flex flex-col bg-white">
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  
                  {gstRecordsByMonth.length === 0 ? (
                    /* Empty State */
                    <div className="flex items-center justify-center h-full min-h-[400px]">
                      <div className="text-center max-w-md">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileSpreadsheet className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No GST Records Yet</h3>
                        <p className="text-gray-500 mb-6">
                          GST records are created when payments are marked as paid or when receipts are generated in Fee Management.
                        </p>
                        <Button 
                          variant="outline" 
                          onClick={() => window.location.reload()}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh Data
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Records Table — newest month first, collapsible sections */
                    <div className="space-y-4">
                      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Jump to month (newest first)</p>
                        <div className="flex flex-wrap gap-2">
                          {gstRecordsByMonth.map((monthData) => (
                            <Button
                              key={monthData.sortKey}
                              type="button"
                              size="sm"
                              variant={expandedGstMonths.has(monthData.sortKey) ? 'default' : 'outline'}
                              className={expandedGstMonths.has(monthData.sortKey) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                              onClick={() => scrollToGstMonth(monthData.sortKey)}
                            >
                              {monthData.month}
                              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                                {monthData.records.length}
                              </Badge>
                            </Button>
                          ))}
                        </div>
                      </div>

                      {gstRecordsByMonth.map((monthData) => (
                        <Collapsible
                          key={monthData.sortKey}
                          open={expandedGstMonths.has(monthData.sortKey)}
                          onOpenChange={() => toggleGstMonthExpanded(monthData.sortKey)}
                        >
                          <div
                            ref={(el) => { gstMonthSectionRefs.current[monthData.sortKey] = el; }}
                            className="space-y-3 scroll-mt-4"
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="w-full bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-emerald-300 hover:shadow-sm transition-all text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-emerald-100 rounded-lg">
                                    <Calendar className="w-5 h-5 text-emerald-600" />
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-bold text-gray-900">{monthData.month}</h4>
                                    <p className="text-sm text-gray-500">{monthData.records.length} Records (by Fees Paid Date)</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="text-right hidden sm:block">
                                    <p className="text-xs text-gray-500 font-medium">Total Invoice</p>
                                    <p className="text-lg font-bold text-gray-900">₹{monthData.totalInvoice.toLocaleString()}</p>
                                  </div>
                                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${expandedGstMonths.has(monthData.sortKey) ? 'rotate-180' : ''}`} />
                                </div>
                              </button>
                            </CollapsibleTrigger>

                            <CollapsibleContent className="space-y-3">
                              <div className="flex justify-end items-center gap-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete all ${monthData.records.length} GST records for ${monthData.month}? This action cannot be undone.`)) {
                                      handleDeleteAllGSTRecordsForMonth(monthData);
                                    }
                                  }}
                                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadMonthlyGSTSheet(monthData)}
                                  className="bg-white hover:bg-gray-50"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export {monthData.month}
                                </Button>
                              </div>

                          {/* Data Table */}
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50 border-b border-gray-200">
                                    <TableHead className="w-12 font-bold text-gray-700 text-xs">#</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-xs">DATE</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-xs">PARTY NAME</TableHead>
                                    <TableHead className="text-right font-bold text-gray-700 text-xs">INVOICE AMT</TableHead>
                                    <TableHead className="text-right font-bold text-gray-700 text-xs">TAXABLE</TableHead>
                                    <TableHead className="text-right font-bold text-gray-700 text-xs">GST (18%)</TableHead>
                                    <TableHead className="text-center font-bold text-gray-700 text-xs">INVOICE NO.</TableHead>
                                    <TableHead className="text-center font-bold text-gray-700 text-xs">TYPE</TableHead>
                                    <TableHead className="text-center font-bold text-gray-700 text-xs w-24">ACTIONS</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {monthData.records.map((record, index) => (
                                    <TableRow key={record.id} className="hover:bg-emerald-50/30 transition-colors border-b border-gray-100">
                                      <TableCell className="font-mono text-xs text-gray-500">{index + 1}</TableCell>
                                      <TableCell className="text-sm text-gray-700 font-medium">
                                        {typeof record.date === 'string' 
                                          ? record.date.split('-').reverse().join('-')
                                          : safeRender(record.date).split('-').reverse().join('-')
                                        }
                                      </TableCell>
                                      <TableCell>
                                        <div>
                                          <p className="font-bold text-gray-900 text-sm">{record.partyName}</p>
                                          {record.companyName && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                              <Building2 className="w-3 h-3" /> {record.companyName}
                                            </p>
                                          )}
                                          <p className="text-xs text-gray-400 font-mono mt-0.5">HSN: {record.hsn}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-mono font-bold text-gray-900">₹{record.totalInvoice.toLocaleString()}</TableCell>
                                      <TableCell className="text-right font-mono text-gray-600 text-sm">₹{record.basicAmount.toLocaleString()}</TableCell>
                                      <TableCell className="text-right font-mono text-gray-600 text-sm">₹{record.gst.toLocaleString()}</TableCell>
                                      <TableCell>
                                        <div className="flex flex-col gap-1 items-center">
                                          {record.invoiceNumbers.map((invoiceNumber, idx) => (
                                            <span key={idx} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                              {invoiceNumber}
                                            </span>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-col gap-1 items-center">
                                          <Badge variant="outline" className={`text-[10px] uppercase font-bold ${record.b2bB2c === 'B2B' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                            {record.b2bB2c}
                                          </Badge>
                                          <span className="text-[10px] text-gray-500">{record.installmentType}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center justify-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleOpenGSTEditDialog(record)}
                                            className="h-8 w-8 p-0 hover:bg-blue-50 text-blue-600"
                                            title="Edit"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              if (confirm('Delete this GST record?')) {
                                                handleDeleteGSTRecord(record.id);
                                              }
                                            }}
                                            className="h-8 w-8 p-0 hover:bg-red-50 text-gray-400 hover:text-red-600"
                                            title="Delete"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GST Edit Dialog */}
      <Dialog open={isGSTEditDialogOpen} onOpenChange={setIsGSTEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-white border-2 border-green-500/20 shadow-[0_0_40px_-5px_rgba(22,163,74,0.15)] rounded-xl">
          <DialogHeader className="border-b border-gray-100 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold text-green-700">
              <div className="p-2 bg-green-100 rounded-lg">
                <Edit className="w-5 h-5 text-green-600" />
              </div>
              Edit GST Record
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Party Name (Read-only) */}
            <div>
              <Label htmlFor="partyName">Party Name</Label>
              <Input
                id="partyName"
                value={editingGSTRecord?.partyName || ''}
                disabled
                className="bg-gray-50"
              />
            </div>

            {/* Fees Paid Date - used for grouping in GST list */}
            <div>
              <Label htmlFor="gstEditDate">Fees Paid Date</Label>
              <Input
                id="gstEditDate"
                type="date"
                value={gstEditFormData.date}
                onChange={(e) => setGstEditFormData(prev => ({ ...prev, date: e.target.value || '' }))}
                className="bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">Uses Fees Paid Date only. This date controls the month in GST. It is filled from the fee record when you open this dialog.</p>
            </div>

            {/* Invoice Numbers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Invoice Numbers</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddInvoiceNumber}
                  className="text-gray-700 border-gray-300"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Invoice Number
                </Button>
              </div>
              
              <div className="space-y-3">
                {gstEditFormData.invoiceNumbers.map((invoiceNumber, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={invoiceNumber}
                      onChange={(e) => handleUpdateInvoiceNumber(index, e.target.value)}
                      placeholder="Enter invoice number"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveInvoiceNumber(index)}
                      className="text-gray-700 border-gray-300"
                      disabled={gstEditFormData.invoiceNumbers.length === 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* B2B/B2C Selection */}
            <div>
              <Label htmlFor="b2bB2c">B2B/B2C</Label>
              <Select
                value={gstEditFormData.b2bB2c}
                onValueChange={(value: 'B2B' | 'B2C') => 
                  setGstEditFormData(prev => ({ ...prev, b2bB2c: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="B2C">B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Company Name */}
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={gstEditFormData.companyName}
                onChange={(e) => setGstEditFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Enter company name"
              />
            </div>

            {/* Amount Information (Read-only) */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Invoice</Label>
                <p className="text-lg font-bold text-gray-900 font-mono">
                  ₹{editingGSTRecord?.totalInvoice.toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Taxable Amount</Label>
                <p className="text-lg font-bold text-blue-600 font-mono">
                  ₹{editingGSTRecord?.basicAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">GST (18%)</Label>
                <p className="text-lg font-bold text-purple-600 font-mono">
                  ₹{editingGSTRecord?.gst.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={handleCloseGSTEditDialog}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGSTEdit}
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm font-medium px-6"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Manual Receipt Generator Dialog */}
      <Dialog open={isManualReceiptDialogOpen} onOpenChange={(open) => {
        setIsManualReceiptDialogOpen(open);
        if (!open) setSelectedReceiptBrand(null);
      }}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full overflow-y-auto bg-gray-50/50 backdrop-blur-sm">
          <DialogTitle className="sr-only">Manual Receipt Branding Selection</DialogTitle>
          {!selectedReceiptBrand ? (
             <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-gray-900">Select Receipt Branding</h2>
                    <p className="text-gray-500 text-lg">Choose the template you want to use for this receipt</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
                    {/* ZICA Card */}
                    <div 
                        onClick={() => setSelectedReceiptBrand('Zica')}
                        className="group relative bg-white rounded-2xl shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-2 border-transparent hover:border-orange-500"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 group-hover:from-orange-500/10 group-hover:to-red-500/10 transition-all duration-300"></div>
                        <div className="p-8 flex flex-col items-center gap-6 relative z-10">
                            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                                <span className="text-4xl font-bold text-orange-600">Z</span>
                            </div>
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Zica</h3>
                                <p className="text-gray-500">Generate receipt with Zica branding and Zee Learn association details.</p>
                            </div>
                            <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white mt-4">
                                Create Zica Receipt
                            </Button>
                        </div>
                    </div>

                    {/* Bettercode Card */}
                    <div 
                        onClick={() => setSelectedReceiptBrand('AIGT')}
                        className="group relative bg-white rounded-2xl shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-2 border-transparent hover:border-blue-500"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 group-hover:from-blue-500/10 group-hover:to-indigo-500/10 transition-all duration-300"></div>
                        <div className="p-8 flex flex-col items-center gap-6 relative z-10">
                             <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                <span className="text-4xl font-bold text-blue-600">B</span>
                            </div>
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">AIGT</h3>
                                <p className="text-gray-500">Generate receipt with AIGT (AIGT Technologies) branding.</p>
                            </div>
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4">
                                Create AIGT Receipt
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const startStr = window.prompt('Renumber BTC receipts: BTC001→BTC042, BTC002→BTC043, …\nEnter the first new number (e.g. 42):', '42');
                                if (startStr == null || startStr.trim() === '') return;
                                const startFrom = parseInt(startStr.trim(), 10);
                                if (isNaN(startFrom) || startFrom < 1 || startFrom > 999) {
                                  toast({ title: 'Invalid number', description: 'Enter a number from 1 to 999.', variant: 'destructive' });
                                  return;
                                }
                                if (!confirm(`Renumber all BTC receipts in the database? BTC001→BTC${String(startFrom).padStart(3, '0')}, BTC002→BTC${String(startFrom + 1).padStart(3, '0')}, etc. This updates fees and GST records.`)) return;
                                try {
                                  const result = await renumberBettercodeReceipts(db, startFrom);
                                  toast({ title: 'Renumber complete', description: `Fees: ${result.feesUpdated} updated. GST: ${result.gstUpdated} updated. Next receipt: BTC${String(result.nextCounter).padStart(3, '0')}.` });
                                } catch (err) {
                                  toast({ title: 'Renumber failed', description: String(err), variant: 'destructive' });
                                }
                              }}
                            >
                              Renumber BTC (e.g. 001→042)
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Reset Bettercode receipt counter to BTC001? Use this only after deleting all Bettercode receipts.')) return;
                                try {
                                  await resetBettercodeReceiptCounter(db);
                                  toast({ title: 'Counter reset', description: 'Next Bettercode receipt will be BTC001.' });
                                } catch (err) {
                                  toast({ title: 'Reset failed', description: String(err), variant: 'destructive' });
                                }
                              }}
                            >
                              Reset receipt counter (start from BTC001)
                            </Button>
                        </div>
                    </div>
                </div>
             </div>
          ) : (
            <ManualReceiptGenerator 
                brand={selectedReceiptBrand} 
                onBack={() => setSelectedReceiptBrand(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Remark dialog - This Month's Due: remark-only edit */}
      <Dialog open={isRemarkEditDialogOpen} onOpenChange={(open) => {
        setIsRemarkEditDialogOpen(open);
        if (!open) {
          setEditingRemarkRecordId(null);
          setRemarkEditValue('');
        }
      }}>
        <DialogContent className="max-w-md bg-violet-50/95 border-2 border-violet-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-violet-900">Edit Remark</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label htmlFor="remark-edit" className="text-violet-800">Remark</Label>
            <Textarea
              id="remark-edit"
              value={remarkEditValue}
              onChange={(e) => setRemarkEditValue(e.target.value)}
              placeholder="Enter remark"
              className="min-h-[100px] bg-white border-violet-200 text-slate-800"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRemarkEditDialogOpen(false);
                  setEditingRemarkRecordId(null);
                  setRemarkEditValue('');
                }}
                className="border-violet-300 text-violet-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => editingRemarkRecordId && handleSaveRemarkOnly(editingRemarkRecordId, remarkEditValue)}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Enhanced GST record validation function
const validateGSTRecord = (feeRecord: FeeRecord, installmentAmount: number, installmentType: string): boolean => {
  // Check if amount is valid
  if (installmentAmount <= 0) {
    console.log(`❌ Invalid amount for GST record: ${installmentAmount}`);
    return false;
  }
  
  // Check if student name is valid
  if (!feeRecord.studentName || feeRecord.studentName.trim() === '') {
    console.log(`❌ Invalid student name for GST record`);
    return false;
  }
  
  // Check if installment type is valid
  if (!installmentType || installmentType.trim() === '') {
    console.log(`❌ Invalid installment type for GST record`);
    return false;
  }
  
  return true;
};
