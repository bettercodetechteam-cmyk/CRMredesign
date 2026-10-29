import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { firebaseHelpers } from "@/lib/firebaseHelpers";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { firebaseCache } from "@/lib/firebaseCache";
import { commonSchemas } from "@/lib/validationUtils";
import { Loader2, UserPlus, GraduationCap, DollarSign, Calendar, CreditCard, Search, Plus, X } from "lucide-react";
import { formatDateForInput } from "@/utils/dateUtils";
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, updateDoc, doc } from "firebase/firestore";
import { getNextSerialNumberFromItems } from "@/lib/serialNumberUtils";
import { db } from "@/lib/firebase";
import { MAX_INSTALLMENTS } from "@/constants/feeInstallments";
import { applyInstallmentDueDatesToFeePayload } from "@/utils/feeInstallmentSchedule";
import { 
  getAllSources, 
  addCustomSource, 
  sourceManagerEvents, 
  defaultSources 
} from "@/lib/sourceManager";
import { ALL_STANDARDIZED_COURSES, MODULAR_PROGRAMS } from "@/lib/leadDataCleaningService";

const instituteCourses = [...ALL_STANDARDIZED_COURSES, ...MODULAR_PROGRAMS];

function courseChoices(syllabusNames: string[], current: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of [...instituteCourses, ...syllabusNames, current]) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || key === "other" || seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  names.sort((a, b) => a.localeCompare(b));
  names.push("Other");
  return names;
}

// Helper function to convert month string to YYYY-MM format for month input
const convertMonthToInputFormat = (monthStr: string | null | undefined): string => {
  if (!monthStr) return "";
  
  if (/^\d{4}-\d{2}$/.test(monthStr)) {
    return monthStr;
  }
  
  try {
    const date = new Date(monthStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
    
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];
    
    const lowerMonth = monthStr.toLowerCase();
    const monthIndex = monthNames.findIndex(m => lowerMonth.includes(m));
    
    if (monthIndex !== -1) {
      const yearMatch = monthStr.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      const month = String(monthIndex + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  } catch (e) {
    return "";
  }
  
  return "";
};

// Helper function to convert YYYY-MM format to readable month-year string
const convertMonthToDisplayFormat = (monthStr: string | null | undefined): string => {
  if (!monthStr) return "";
  
  try {
    if (/^\d{4}-\d{2}$/.test(monthStr)) {
      const [year, month] = monthStr.split('-');
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthIndex = parseInt(month) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${monthNames[monthIndex]} ${year}`;
      }
    }
  } catch (e) {
    // If conversion fails, return as is
  }
  
  return monthStr;
};

interface StudentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: any;
  mode?: "create" | "edit";
  nextSrNo?: number;
}

type StudentFormData = {
  srNo?: string;
  studentFullName: string;
  email?: string;
  phone: string;
  parentsContactNumber?: string;
  source?: string;
  admissionDate?: string;
  zicaZima?: string;
  feesStructure?: string;
  course: string;
  courseDuration?: string;
  courseStartDate?: string;
  actualFees?: string;
  discountedFees?: string;
  feesPaid?: string;
  feesPaidDate?: string;
  feesBalance?: string;
  paymentMode?: string;
  chequeNumber?: string;
  noOfInstallments?: string;
  installmentsPaid?: string;
  remainingInstallments?: string;
  dueDate?: string;
  remarks?: string;
  status?: string;
  centreId?: string;
  zicaSubCategory?: string;
};

const paymentModes = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"];
const zicaZimaOptions = ["ZICA", "AIGT"];
const feesStructureOptions = ["Full Payment", "Installment"];
const courseDurationOptions = ["1", "1.5", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "27", "36", "Other"];

function roundRupees(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function feeAmounts(actualRaw: number, discountRaw: number, paidRaw: number) {
  const actual = roundRupees(Math.max(0, actualRaw));
  const discount = roundRupees(Math.min(Math.max(0, discountRaw), actual));
  const payable = roundRupees(Math.max(0, actual - discount));
  const paid = roundRupees(Math.max(0, paidRaw));
  const balance = roundRupees(Math.max(0, payable - paid));
  return { actual, discount, payable, paid, balance };
}

function getEditDefaultValues(s: any, centreId?: string): Partial<StudentFormData> {
  const emailVal = s?.email ?? s?.emailId ?? "";
  const parentsVal = s?.parentsContactNumber ?? s?.parentContact ?? s?.parentsPhone ?? s?.parentPhone ?? "";
  const src = (s?.source || s?.leadSource || "").trim();
  return {
    srNo: s?.srNo?.toString() || "",
    studentFullName: `${s?.firstName ?? ""} ${s?.lastName ?? ""}`.trim() || "",
    email: String(emailVal),
    phone: s?.phone || s?.contact || "",
    parentsContactNumber: String(parentsVal),
    source: src || "",
    admissionDate: formatDateForInput(s?.admissionDate),
    zicaZima: s?.zicaZima || "",
    feesStructure: s?.feesStructure || "",
    course: s?.course || "",
    courseDuration: s?.courseDuration?.toString() || "",
    courseStartDate: formatDateForInput(s?.courseStartDate),
    actualFees: s?.actualFees?.toString() || "",
    discountedFees: s?.discountedFees?.toString() || "",
    feesPaid: s?.feesPaid?.toString() || "",
    feesPaidDate: formatDateForInput(s?.feesPaidDate),
    feesBalance: s?.feesBalance?.toString() || "",
    paymentMode: s?.paymentMode || s?.paymentMethod || s?.paymentType || "",
    chequeNumber: s?.chequeNumber || "",
    noOfInstallments: s?.noOfInstallments?.toString() || "",
    installmentsPaid: s?.installmentsPaid?.toString() || "",
    remainingInstallments: s?.remainingInstallments?.toString() || "",
    dueDate: formatDateForInput(s?.dueDate),
    remarks: s?.remarks || "",
    status: s?.status || "active",
    centreId: s?.centreId || centreId || "",
    zicaSubCategory: s?.zicaSubCategory || "",
  };
}

function getCreateDefaultValues(): Partial<StudentFormData> {
  return {
    studentFullName: "",
    email: "",
    phone: "",
    parentsContactNumber: "",
    source: "",
    course: "",
    status: "active",
    paymentMode: "",
    zicaZima: "",
    zicaSubCategory: "",
    feesStructure: "",
  };
}

export default function StudentForm({
  open,
  onOpenChange,
  student,
  mode = "create",
  nextSrNo,
}: StudentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const [courses, setCourses] = useState<string[]>([]);
  const [coursesReady, setCoursesReady] = useState(false);
  const [customCourses, setCustomCourses] = useState<string[]>([]);
  const [showCustomCourseInput, setShowCustomCourseInput] = useState(false);
  const [customCourseInput, setCustomCourseInput] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [courseSearchTerm, setCourseSearchTerm] = useState("");

  // State for dynamic sources
  const [sources, setSources] = useState<string[]>([...defaultSources]);
  const [showCustomSourceInput, setShowCustomSourceInput] = useState(false);
  const [customSourceInput, setCustomSourceInput] = useState("");
  // Remember last entered source so it appears on next open (create) instead of always "Justdial"
  const [lastUsedSource, setLastUsedSource] = useState("");

  // When dialog opens for edit we remount (parent uses key=student.id), so useForm gets these defaults once at mount
  const formDefaultValues = (open && mode === "edit" && student)
    ? getEditDefaultValues(student, userProfile?.centreId)
    : getCreateDefaultValues();

  const form = useForm<StudentFormData>({
    resolver: zodResolver(commonSchemas.student),
    defaultValues: formDefaultValues,
  });

  // Function to load sources (default + custom)
  useEffect(() => {
    const loadSources = async () => {
      // If userProfile isn't loaded yet, just use defaults
      const currentSources = userProfile?.centreId 
        ? await getAllSources(userProfile.centreId)
        : [...defaultSources];
      
      setSources(currentSources);
    };
    
    loadSources();
  }, [userProfile?.centreId]);

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCoursesReady(false);
    syllabusApi.courseNames()
      .then((names) => {
        if (cancelled) return;
        const current = (form.getValues("course") || student?.course || "").trim();
        setCourses(courseChoices(names, current));
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      })
      .finally(() => {
        if (!cancelled) setCoursesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form, student?.course]);

  // Reset form when dialog opens/closes or mode changes
  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes; keep source as lastUsedSource for next open
      form.reset({
        studentFullName: "",
        email: "",
        phone: "",
        parentsContactNumber: "",
        course: "",
        status: "active",
        paymentMode: "",
        source: lastUsedSource,
        zicaZima: "",
        zicaSubCategory: "",
        feesStructure: "",
        admissionDate: "",
        courseDuration: "",
        courseStartDate: "",
        actualFees: "",
        discountedFees: "",
      feesPaid: "",
      feesPaidDate: "",
      feesBalance: "",
      chequeNumber: "",
      noOfInstallments: "",
        installmentsPaid: "",
        remainingInstallments: "",
        dueDate: "",
        remarks: "",
        srNo: "",
      });
      return;
    }

    // Populate form when editing: fetch latest from Firestore so email/parentsContactNumber always show
    if (student && mode === "edit" && student.id) {
      const studentSource = (student.source || student.leadSource || "").trim();
      if (studentSource) {
        setSources((prev) => (prev.includes(studentSource) ? prev : [studentSource, ...prev]));
      }
      const applyStudentToForm = (s: any) => {
        const src = (s?.source || s?.leadSource || "").trim();
        const emailVal = s?.email ?? s?.emailId ?? "";
        const parentsVal = s?.parentsContactNumber ?? s?.parentContact ?? s?.parentsPhone ?? s?.parentPhone ?? "";
        form.reset({
          srNo: s?.srNo?.toString() || "",
          studentFullName: `${s?.firstName ?? ""} ${s?.lastName ?? ""}`.trim() || "",
          email: String(emailVal),
          phone: s?.phone || s?.contact || "",
          parentsContactNumber: String(parentsVal),
          source: src || "",
          admissionDate: formatDateForInput(s?.admissionDate),
          zicaZima: s?.zicaZima || "",
          feesStructure: s?.feesStructure || "",
          course: s?.course || "",
          courseDuration: s?.courseDuration?.toString() || "",
          courseStartDate: formatDateForInput(s?.courseStartDate),
          actualFees: s?.actualFees?.toString() || "",
          discountedFees: s?.discountedFees?.toString() || "",
          feesPaid: s?.feesPaid?.toString() || "",
          feesPaidDate: formatDateForInput(s?.feesPaidDate),
          feesBalance: s?.feesBalance?.toString() || "",
          paymentMode: s?.paymentMode || s?.paymentMethod || s?.paymentType || "",
          chequeNumber: s?.chequeNumber || "",
          noOfInstallments: s?.noOfInstallments?.toString() || "",
          installmentsPaid: s?.installmentsPaid?.toString() || "",
          remainingInstallments: s?.remainingInstallments?.toString() || "",
          dueDate: formatDateForInput(s?.dueDate),
          remarks: s?.remarks || "",
          status: s?.status || "active",
          centreId: s?.centreId || userProfile?.centreId || "",
          zicaSubCategory: s?.zicaSubCategory || "",
        });
        form.setValue("email", String(emailVal), { shouldDirty: false });
        form.setValue("parentsContactNumber", String(parentsVal), { shouldDirty: false });
      };
      firebaseHelpers.getStudentById(student.id).then((fresh) => {
        applyStudentToForm(fresh || student);
      }).catch(() => {
        applyStudentToForm(student);
      });
    } else if (mode === "create") {
      // Reset to default values only when dialog opens (not when lastUsedSource changes).
      // Using lastUsedSource here is safe: we read it when effect runs (on open), so we do not
      // include it in deps to avoid re-running and clearing fields when user selects a source.
      form.reset({
        srNo: nextSrNo?.toString() || "",
        studentFullName: "",
        email: "",
        phone: "",
        parentsContactNumber: "",
        course: "",
        status: "active",
        paymentMode: "",
        source: lastUsedSource,
        zicaZima: "",
        feesStructure: "",
        admissionDate: "",
        courseDuration: "",
        courseStartDate: "",
        actualFees: "",
        discountedFees: "",
      feesPaid: "",
      feesPaidDate: "",
      feesBalance: "",
      chequeNumber: "",
      noOfInstallments: "",
        installmentsPaid: "",
        remainingInstallments: "",
        dueDate: "",
        remarks: "",
        centreId: userProfile?.centreId || "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lastUsedSource intentionally omitted: reset only on open, not when user selects source
  }, [open, student, mode, nextSrNo, userProfile?.centreId, form]);

  // Discounted Fees is the concession taken off Actual Fees. Balance is what remains after payments.
  const actualFees = parseFloat(form.watch("actualFees") || "0");
  const discountedFees = parseFloat(form.watch("discountedFees") || "0");
  const feesPaid = parseFloat(form.watch("feesPaid") || "0");
  const feeCalc = feeAmounts(actualFees, discountedFees, feesPaid);
  const feesBalance = feeCalc.balance;

  useEffect(() => {
    if (actualFees > 0 || discountedFees > 0 || feesPaid > 0) {
      form.setValue("feesBalance", feesBalance.toFixed(2));
    }
  }, [actualFees, discountedFees, feesPaid, feesBalance, form]);

  // Calculate remaining installments
  const noOfInstallments = parseFloat(form.watch("noOfInstallments") || "0");
  const installmentsPaid = parseFloat(form.watch("installmentsPaid") || "0");
  const remainingInstallments = Math.max(0, noOfInstallments - installmentsPaid);

  useEffect(() => {
    if (noOfInstallments > 0) {
      form.setValue("remainingInstallments", remainingInstallments.toString());
    }
  }, [noOfInstallments, installmentsPaid, remainingInstallments, form]);

  // Function to update fee record when student is updated
  const updateFeeRecord = async (studentId: string, studentData: any) => {
    try {
      if (!db) return;
      
      // Find the fee record by studentId
      const feesQuery = query(
        collection(db, 'fees'),
        where('studentId', '==', studentId)
      );
      const feesSnapshot = await getDocs(feesQuery);
      
      
      // If no fee record found by studentId, try to find by contact number (orphaned record)
      // or create a new one if completely missing
      if (feesSnapshot.empty) {
        // Try to find by contact number
        const feesContactQuery = query(
            collection(db, 'fees'),
            where('contactNumber', '==', studentData.phone)
        );
        const feesContactSnapshot = await getDocs(feesContactQuery);
        
        if (!feesContactSnapshot.empty) {
            // Found orphaned record, use this one to update
            const feeDoc = feesContactSnapshot.docs[0];
            const feeId = feeDoc.id;
            const existingFeeData = feeDoc.data();
            
            // Continue with update logic using this found record
            // We need to ensure studentId is set during this update
            await updateFeeDocument(feeId, existingFeeData, studentData, studentId);
        } else {
            // No record found at all, create a new one
            await createFeeRecord(studentData, studentId);
        }
        return;
      }
      
      const feeDoc = feesSnapshot.docs[0];
      const feeId = feeDoc.id;
      const existingFeeData = feeDoc.data();
      
      await updateFeeDocument(feeId, existingFeeData, studentData, studentId);
    } catch (error: any) {
      // ... error handling
      console.error('Error updating fee record:', error);
    }
  };

  // Helper to perform the actual update of a fee document
  const updateFeeDocument = async (feeId: string, existingFeeData: any, studentData: any, studentId: string) => {
      // Check if data actually changed
      const newFeesPaid = studentData.feesPaid || 0;
      const newDiscountedFees = studentData.discountedFees || studentData.actualFees || 0;
      const newActualFees = studentData.actualFees || 0;
      const newNoOfInstallments = studentData.noOfInstallments || 0;
      
      const feesChanged = 
        (existingFeeData.feesPaid !== newFeesPaid) ||
        (existingFeeData.discountedFees !== newDiscountedFees) ||
        (existingFeeData.actualFees !== newActualFees) ||
        (existingFeeData.numberOfInstallments !== newNoOfInstallments) ||
        (existingFeeData.course !== studentData.course) ||
        (existingFeeData.contactNumber !== studentData.phone) ||
        (existingFeeData.source !== (studentData.source || 'Justdial')) ||
        (existingFeeData.courseDuration !== (studentData.courseDuration?.toString() || ''));
      
      // Skip update if no significant changes detected and studentId is already correct
      // But ALWAYS update if studentId or centreId is missing/wrong
      if (!feesChanged && 
          existingFeeData.studentName === `${studentData.firstName} ${studentData.lastName}`.trim() &&
          existingFeeData.paymentMode === (studentData.paymentMode || 'Cash') &&
          existingFeeData.studentId === studentId &&
          existingFeeData.centreId === (studentData.centreId || userProfile?.centreId)) {
        return; 
      }
      
      // Convert student data to fee record format
      let zicaBettercode: 'ZICA' | 'BETTERCODE' | 'Non-ZICA' = 'ZICA';
      if (studentData.zicaZima === 'Bettercode' || studentData.zicaZima === 'AIGT') {
        zicaBettercode = 'BETTERCODE';
      } else if (studentData.zicaZima === 'ZICA' || studentData.zicaZima === 'ZIMA' || studentData.zicaZima === 'ZICA/ZIMA') {
        if (studentData.zicaSubCategory === 'Non-ZICA') {
          zicaBettercode = 'Non-ZICA';
        } else {
          zicaBettercode = 'ZICA';
        }
      }
      
      let feesStructure: 'OLD' | 'NEW' = 'NEW';
      if (studentData.feesStructure === 'Full Payment') {
        feesStructure = 'OLD';
      } else if (studentData.feesStructure === 'Installment' || studentData.feesStructure === 'Partial') {
        feesStructure = 'NEW';
      }
      
      const admissionMonth = (studentData.admissionMonth && String(studentData.admissionMonth).trim())
        ? (() => {
            const monthStr = String(studentData.admissionMonth);
            const monthMatch = monthStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
            return monthMatch ? monthMatch[1].toUpperCase() : monthStr.toUpperCase().replace(/\s+/g, '_');
          })()
        : new Date().toLocaleString('default', { month: 'long' }).toUpperCase();
      
      const noOfInstallments = studentData.noOfInstallments || 0;
      const installmentsPaid = studentData.installmentsPaid || 0;
      const remainingInstallmentsCount = Math.max(0, noOfInstallments - installmentsPaid);
      const feeCalc = feeAmounts(studentData.actualFees || 0, studentData.discountedFees || 0, studentData.feesPaid || 0);
      const remainingFees = feeCalc.balance;
      
      // Calculate installment amounts if needed
      let installmentAmount = 0;
      let lastInstallmentAmount = 0;
      if (remainingInstallmentsCount > 0) {
        installmentAmount = parseFloat((remainingFees / remainingInstallmentsCount).toFixed(2));
        const totalDistributed = parseFloat((installmentAmount * (remainingInstallmentsCount - 1)).toFixed(2));
        lastInstallmentAmount = parseFloat((remainingFees - totalDistributed).toFixed(2));
      }
      
      // Prepare update data
      const feeUpdateData: any = {
        studentName: `${studentData.firstName} ${studentData.lastName}`.trim(),
        contactNumber: studentData.phone,
        parentsContactNumber: studentData.parentsContactNumber || '',
        source: studentData.source || 'Justdial',
        admissionMonth: admissionMonth,
        zicaBettercode: zicaBettercode,
        feesStructure: feesStructure,
        course: studentData.course,
        courseDuration: studentData.courseDuration?.toString() || '',
        courseStartDate: studentData.courseStartDate 
          ? (studentData.courseStartDate instanceof Date ? Timestamp.fromDate(studentData.courseStartDate) : studentData.courseStartDate)
          : Timestamp.now(),
        actualFees: studentData.actualFees || 0,
        discountedFees: feeCalc.payable,
        feesPaid: studentData.feesPaid || 0,
        feesPaidDate: studentData.feesPaidDate 
          ? (studentData.feesPaidDate instanceof Date ? Timestamp.fromDate(studentData.feesPaidDate) : studentData.feesPaidDate)
          : null,
        feesBalance: remainingFees,
        paymentMode: (studentData.paymentMode || 'Cash') as 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Cheque',
        chequeNumber: studentData.chequeNumber || '',
        numberOfInstallments: noOfInstallments,
        balanceInstallments: studentData.remainingInstallments || 0,
        dueDate: studentData.dueDate 
          ? (studentData.dueDate instanceof Date ? Timestamp.fromDate(studentData.dueDate) : studentData.dueDate)
          : null,
        remarks: studentData.remarks || '',
        updatedAt: Timestamp.now(),
        dateOfAdmission: studentData.admissionDate 
          ? (studentData.admissionDate instanceof Date ? Timestamp.fromDate(studentData.admissionDate) : studentData.admissionDate)
          : Timestamp.now(),
        centreId: studentData.centreId || userProfile?.centreId,
      };
      
      // Update installment fields
      for (let i = 1; i <= noOfInstallments && i <= MAX_INSTALLMENTS; i++) {
        const installmentKey = `installment${String(i).padStart(2, '0')}`;
        if (i <= installmentsPaid) {
          feeUpdateData[installmentKey] = 0;
        } else if (i === noOfInstallments) {
          feeUpdateData[installmentKey] = lastInstallmentAmount;
        } else {
          feeUpdateData[installmentKey] = installmentAmount;
        }
      }
      
      // Clear installment fields beyond numberOfInstallments
      for (let i = noOfInstallments + 1; i <= MAX_INSTALLMENTS; i++) {
        const installmentKey = `installment${String(i).padStart(2, '0')}`;
        feeUpdateData[installmentKey] = 0;
      }

      applyInstallmentDueDatesToFeePayload(feeUpdateData, {
        noOfInstallments,
        installmentsPaid,
        firstDueDate: studentData.dueDate,
        admissionDate: studentData.admissionDate,
        courseStartDate: studentData.courseStartDate,
      });
      
      // Update the fee record
      const feeDocRef = doc(db, 'fees', feeId);
      await updateDoc(feeDocRef, feeUpdateData);
  };


  // Function to create fee record automatically when student is created
  const createFeeRecord = async (studentData: any, studentId: string) => {
    try {
      const feesQuery = query(
        collection(db, 'fees'),
        where('contactNumber', '==', studentData.phone)
      );
      const existingFees = await getDocs(feesQuery);
      
      if (!existingFees.empty) {
        return;
      }


      const actualFees = studentData.actualFees || 0;
      const createdFees = feeAmounts(actualFees, studentData.discountedFees || 0, studentData.feesPaid || 0);
      const discountedFees = createdFees.payable;
      const feesPaid = createdFees.paid;
      const noOfInstallments = studentData.noOfInstallments || 0;
      const installmentsPaid = studentData.installmentsPaid || 0;
      const remainingInstallmentsCount = Math.max(0, noOfInstallments - installmentsPaid);
      
      const remainingFees = createdFees.balance;
      
      // Calculate float installment amount with 2 decimal precision
      let installmentAmount = 0;
      let lastInstallmentAmount = 0;
      
      if (remainingInstallmentsCount > 0) {
        installmentAmount = parseFloat((remainingFees / remainingInstallmentsCount).toFixed(2));
        const totalDistributed = parseFloat((installmentAmount * (remainingInstallmentsCount - 1)).toFixed(2));
        lastInstallmentAmount = parseFloat((remainingFees - totalDistributed).toFixed(2));
      }
      
      let zicaBettercode: 'ZICA' | 'BETTERCODE' | 'Non-ZICA' = 'ZICA';
      if (studentData.zicaZima === 'Bettercode' || studentData.zicaZima === 'AIGT') {
        zicaBettercode = 'BETTERCODE';
      } else if (studentData.zicaZima === 'ZICA' || studentData.zicaZima === 'ZIMA' || studentData.zicaZima === 'ZICA/ZIMA') {
        // If it's a ZICA program but marked as 'Non-ZICA', use Non-ZICA label
        if (studentData.zicaSubCategory === 'Non-ZICA') {
          zicaBettercode = 'Non-ZICA';
        } else {
          zicaBettercode = 'ZICA';
        }
      }
      
      let feesStructure: 'OLD' | 'NEW' = 'NEW';
      if (studentData.feesStructure === 'Full Payment') {
        feesStructure = 'OLD';
      } else if (studentData.feesStructure === 'Installment' || studentData.feesStructure === 'Partial') {
        feesStructure = 'NEW';
      }
      
      const feesQueryAll = query(collection(db, 'fees'));
      const allFees = await getDocs(feesQueryAll);
      const nextSrNo = getNextSerialNumberFromItems(
        allFees.docs.map((d) => d.data())
      );
      
      const admissionMonth = new Date().toLocaleString('default', { month: 'long' }).toUpperCase();
      
      const feeRecord: any = {
        srNo: nextSrNo,
        studentName: `${studentData.firstName} ${studentData.lastName}`.trim(),
        contactNumber: studentData.phone,
        parentsContactNumber: studentData.parentsContactNumber || '',
        source: studentData.source || 'Justdial',
        admissionMonth: admissionMonth,
        dateOfAdmission: studentData.admissionDate 
          ? studentData.admissionDate
          : Timestamp.now(),
        zicaBettercode: zicaBettercode,
        feesStructure: feesStructure,
        course: studentData.course,
        courseDuration: studentData.courseDuration?.toString() || '',
        courseStartDate: studentData.courseStartDate 
          ? studentData.courseStartDate
          : Timestamp.now(),
        actualFees: actualFees,
        discountedFees: discountedFees,
        feesPaid: feesPaid,
        feesPaidDate: studentData.feesPaidDate ? studentData.feesPaidDate : null,
        feesBalance: remainingFees,
        registrationAmount: 0,
        paymentMode: (studentData.paymentMode || 'Cash') as 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Cheque',
        chequeNumber: studentData.chequeNumber || '',
        numberOfInstallments: noOfInstallments,
        balanceInstallments: remainingInstallments,
        dueDate: studentData.dueDate ? studentData.dueDate : null,
        remarks: studentData.remarks || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userProfile?.uid || '',
        studentId: studentId,
        centreId: studentData.centreId || userProfile?.centreId,
      };
      
      for (let i = 1; i <= noOfInstallments && i <= MAX_INSTALLMENTS; i++) {
        const installmentKey = `installment${String(i).padStart(2, '0')}`;
        if (i <= installmentsPaid) {
          feeRecord[installmentKey] = 0;
        } else if (i === noOfInstallments) {
          feeRecord[installmentKey] = lastInstallmentAmount;
        } else {
          feeRecord[installmentKey] = installmentAmount;
        }
      }

      applyInstallmentDueDatesToFeePayload(feeRecord, {
        noOfInstallments,
        installmentsPaid,
        firstDueDate: studentData.dueDate,
        admissionDate: studentData.admissionDate,
        courseStartDate: studentData.courseStartDate,
      });
      
      const feeDocRef = await addDoc(collection(db, 'fees'), feeRecord);
    } catch (error) {
      console.error('❌ Error creating fee record:', error);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      if (!userProfile?.centreId) {
        throw new Error("Centre ID is required");
      }

      const fullName = data.studentFullName?.trim() || "";
      const studentData: any = {
        srNo: data.srNo ? parseInt(data.srNo) : nextSrNo || 1,
        firstName: fullName,
        lastName: "",
        email: data.email?.trim() || "",
        phone: data.phone.trim(),
        parentsContactNumber: data.parentsContactNumber?.trim() || "",
        source: data.source?.trim() || "Justdial",
        admissionMonth: (mode === "edit" && student?.admissionMonth) ? student.admissionMonth : new Date().toLocaleString('default', { month: 'long' }),
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : null,
        zicaZima: data.zicaZima || "",
        zicaSubCategory: data.zicaSubCategory || "",
        feesStructure: data.feesStructure || "",
        course: data.course.trim(),
        courseDuration: data.courseDuration ? parseFloat(data.courseDuration) : null,
        courseStartDate: data.courseStartDate ? new Date(data.courseStartDate) : null,
        actualFees: data.actualFees ? parseFloat(data.actualFees) : 0,
        discountedFees: data.discountedFees ? parseFloat(data.discountedFees) : 0,
        feesPaid: data.feesPaid ? parseFloat(data.feesPaid) : 0,
        feesPaidDate: data.feesPaidDate ? new Date(data.feesPaidDate) : null,
        feesBalance: feesBalance,
        paymentMode: data.paymentMode || "",
        chequeNumber: data.chequeNumber || "",
        noOfInstallments: data.noOfInstallments ? parseInt(data.noOfInstallments) : 0,
        installmentsPaid: data.installmentsPaid ? parseInt(data.installmentsPaid) : 0,
        remainingInstallments: remainingInstallments,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        remarks: data.remarks || "",
        status: data.status || "active",
        centreId: userProfile.centreId,
        createdAt: student?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      let studentId: string;
      if (mode === "edit" && student?.id) {
        await firebaseHelpers.updateStudent(student.id, studentData);
        studentId = student.id;
        // Sync fee record when student is updated
        await updateFeeRecord(studentId, studentData);
      } else {
        studentId = await firebaseHelpers.saveStudent(studentData) || '';
        if (studentId && mode === "create") {
          await createFeeRecord(studentData, studentId);
        }
      }
      
      let enrollMessage = mode === "create" ? "Student added successfully!" : "Student updated successfully!";
      if (studentId && mode === "create") {
        try {
          const enrolled = await syllabusApi.enrollStudent({
            studentId,
            email: data.email?.trim() || "",
            phone: data.phone.trim(),
            parentPhone: data.parentsContactNumber?.trim() || "",
            course: data.course.trim(),
          });
          enrollMessage = enrolled.message;
        } catch (error) {
          const detail = errorMessage(error);
          enrollMessage = detail ? `${enrollMessage} ${detail}` : enrollMessage;
        }
      }

      return { studentId, enrollMessage };
    },
    onSuccess: async (result, variables) => {
      const submittedSource = variables?.source?.trim();
      if (submittedSource) setLastUsedSource(submittedSource);
      firebaseCache.invalidatePattern("students");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      await queryClient.refetchQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast({
        title: "Success",
        description: result.enrollMessage,
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode === "create" ? "add" : "update"} student`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StudentFormData) => {
    saveMutation.mutate(data);
  };

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            {mode === "create" ? "✨ Add New Student" : "Edit Student"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Fill in the details to add a new student to the system"
              : "Update the student information below"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(
          onSubmit,
          (errors) => {
            const firstErrorKey = Object.keys(errors)[0];
            setTimeout(() => {
              const el = document.querySelector(`[data-field="${firstErrorKey}"]`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          }
        )} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="srNo">Serial Number</Label>
                <Input
                  id="srNo"
                  {...form.register("srNo")}
                  value={form.watch("srNo") || ""}
                  placeholder="Auto-generated"
                  disabled={mode === "edit"}
                  className="bg-gray-50"
                />
              </div>
              <div className="space-y-2" data-field="studentFullName">
                <Label htmlFor="studentFullName">
                  Student Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="studentFullName"
                  {...form.register("studentFullName")}
                  value={form.watch("studentFullName") || ""}
                  placeholder="Enter student full name"
                />
                {form.formState.errors.studentFullName && (
                  <p className="text-sm text-red-500">{form.formState.errors.studentFullName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="email"
                      type="email"
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Enter email address"
                    />
                  )}
                />
              </div>
              <div className="space-y-2" data-field="phone">
                <Label htmlFor="phone">
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  value={form.watch("phone") || ""}
                  placeholder="Enter contact number"
                />
                {form.formState.errors.phone && (
                  <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
                )}
                <p className="text-xs text-slate-500">On a new student, this number opens My class. The password is shown after save.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentsContactNumber">Parents Contact</Label>
                <Controller
                  name="parentsContactNumber"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="parentsContactNumber"
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Enter parents contact number"
                    />
                  )}
                />
                <p className="text-xs text-slate-500">On a new student, this number opens the parent progress page.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                
                {!showCustomSourceInput ? (
                  <Select
                    value={form.watch("source") || ""}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        setShowCustomSourceInput(true);
                        form.setValue("source", "");
                      } else {
                        setShowCustomSourceInput(false);
                        form.setValue("source", value);
                        setLastUsedSource(value);
                      }
                    }}
                  >
                    <SelectTrigger id="source-select" className="w-full">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999] max-h-[300px]">
                      {sources.map((source, index) => (
                        <SelectItem 
                          key={`source-${index}-${source}`} 
                          value={source}
                        >
                          {source}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other" className="font-semibold text-blue-600 border-t mt-1">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Add Custom Source
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-blue-700 font-semibold">Add Custom Source</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowCustomSourceInput(false);
                          setCustomSourceInput("");
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Enter source name"
                      value={customSourceInput}
                      onChange={(e) => setCustomSourceInput(e.target.value)}
                      className="w-full"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          if (customSourceInput.trim()) {
                            try {
                              const newSource = await addCustomSource(customSourceInput.trim(), userProfile?.centreId);
                              if (newSource) {
                                // Update local state directly to ensure immediate feedback
                                setSources(prev => [newSource, ...prev]);
                                form.setValue("source", newSource);
                                setLastUsedSource(newSource);
                                
                                // Notify others
                                sourceManagerEvents.notifySourceUpdate(newSource);
                                
                                toast({
                                  title: "Success",
                                  description: "Custom source added successfully!",
                                });
                              } else {
                                toast({
                                  title: "Info",
                                  description: "Source already exists or invalid.",
                                });
                              }
                              setCustomSourceInput("");
                              setShowCustomSourceInput(false);
                            } catch (error) {
                               console.error('Error adding custom source:', error);
                               toast({
                                title: "Error",
                                description: "Failed to add custom source",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 flex-1"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Source
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="admissionDate">Date of Admission</Label>
                <Input
                  id="admissionDate"
                  type="date"
                  {...form.register("admissionDate")}
                  value={form.watch("admissionDate") || ""}
                />
              </div>
              <div className="space-y-2" data-field="zicaZima">
                <Label htmlFor="zicaZima">
                  Select Business <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.watch("zicaZima") || ""}
                  onValueChange={(value) => {
                    form.setValue("zicaZima", value);
                    setSelectedProgram(value);
                    // Reset course and subcategory selection when program changes
                    form.setValue("course", "");
                    form.setValue("zicaSubCategory", "");
                  }}
                >
                  <SelectTrigger id="zicaZima-select" className="w-full">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    {zicaZimaOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.zicaZima && (
                  <p className="text-sm text-red-500">{form.formState.errors.zicaZima.message}</p>
                )}
              </div>

              {/* Conditional ZICA Sub-category Field */}
              {form.watch("zicaZima") === "ZICA" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="zicaSubCategory" className="text-blue-700 font-semibold">
                    ZICA Category <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.watch("zicaSubCategory") || ""}
                    onValueChange={(value) => form.setValue("zicaSubCategory", value)}
                  >
                    <SelectTrigger id="zicaSubCategory-select" className="w-full border-blue-200 bg-blue-50/50">
                      <SelectValue placeholder="Select ZICA type" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="ZICA">ZICA Student</SelectItem>
                      <SelectItem value="Non-ZICA">Non-Zica Student</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-gray-500 italic px-1">
                    * ZICA Student uses ZICA receipt sequence, Non-ZICA uses BTC sequence.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Course Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <GraduationCap className="w-5 h-5 text-purple-600" />
              Course Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2" data-field="course">
                <Label htmlFor="course">
                  Course enrolled <span className="text-red-500">*</span>
                </Label>
                
                {!showCustomCourseInput ? (
                  <Select
                    value={form.watch("course") || ""}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        setShowCustomCourseInput(true);
                        form.setValue("course", "");
                      } else {
                        setShowCustomCourseInput(false);
                        form.setValue("course", value);
                      }
                    }}
                  >
                    <SelectTrigger id="course-select" className="w-full">
                      <SelectValue placeholder="Select the course this student is taking" />
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
                      
                      {coursesReady && courses.filter(course => 
                        course.toLowerCase().includes(courseSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No courses yet. Create one on the Syllabus page first.
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
                              form.setValue("course", customCourseInput.trim());
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
                
                {form.formState.errors.course && (
                  <p className="text-sm text-red-500">{form.formState.errors.course.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseDuration">Course Duration (Months)</Label>
                <Select
                  value={courseDurationOptions.includes(form.watch("courseDuration") || "") ? (form.watch("courseDuration") || "") : "Other"}
                  onValueChange={(value) => {
                    form.setValue("courseDuration", value === "Other" ? "" : value);
                  }}
                >
                  <SelectTrigger id="courseDuration-select" className="w-full">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    {courseDurationOptions.map((duration) => (
                      <SelectItem
                        key={duration}
                        value={duration}
                        className={duration === "Other" ? "text-blue-600 font-medium" : ""}
                      >
                        {duration === "Other" ? "+ Add Other" : `${duration} month${duration !== "1" ? "s" : ""}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!form.watch("courseDuration") || form.watch("courseDuration") === "Other" || !courseDurationOptions.includes(form.watch("courseDuration") || "")) && (
                  <Input
                    id="courseDurationOther"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter duration in months (e.g. 18, 24, 30)"
                    value={courseDurationOptions.includes(form.watch("courseDuration") || "") ? "" : (form.watch("courseDuration") || "")}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      form.setValue("courseDuration", v);
                    }}
                    className="mt-1"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseStartDate">Course Start Date</Label>
                <Input
                  id="courseStartDate"
                  type="date"
                  {...form.register("courseStartDate")}
                  value={form.watch("courseStartDate") || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feesStructure">Fees Structure</Label>
                <Select
                  value={form.watch("feesStructure") || ""}
                  onValueChange={(value) => form.setValue("feesStructure", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fees structure" />
                  </SelectTrigger>
                  <SelectContent>
                    {feesStructureOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Fees Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <DollarSign className="w-5 h-5 text-green-600" />
              Fees Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actualFees">Actual Fees (₹)</Label>
                <Input
                  id="actualFees"
                  type="number"
                  step="0.01"
                  {...form.register("actualFees")}
                  value={form.watch("actualFees") || ""}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountedFees">Discounted Fees (₹)</Label>
                <Input
                  id="discountedFees"
                  type="number"
                  step="0.01"
                  {...form.register("discountedFees")}
                  value={form.watch("discountedFees") || ""}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feesPaid">Fees Paid (₹)</Label>
                <Input
                  id="feesPaid"
                  type="number"
                  step="0.01"
                  {...form.register("feesPaid")}
                  value={form.watch("feesPaid") || ""}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feesBalance">Fees Balance (₹)</Label>
                <Input
                  id="feesBalance"
                  type="number"
                  step="0.01"
                  value={isNaN(feesBalance) ? "0.00" : feesBalance.toFixed(2)}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feesPaidDate">Fees Paid Date</Label>
                <Input
                  id="feesPaidDate"
                  type="date"
                  {...form.register("feesPaidDate")}
                  value={form.watch("feesPaidDate") || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMode">Payment Mode</Label>
                <Select
                  value={form.watch("paymentMode") || ""}
                  onValueChange={(value) => form.setValue("paymentMode", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {form.watch("paymentMode") === "Cheque" && (
                <div className="space-y-2">
                  <Label htmlFor="chequeNumber">
                    Cheque Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="chequeNumber"
                    {...form.register("chequeNumber", { required: true })}
                    placeholder="Enter cheque number"
                  />
                  {form.formState.errors.chequeNumber && (
                    <p className="text-sm text-red-500">{form.formState.errors.chequeNumber.message}</p>
                  )}
                </div>
              )}
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                {feesBalance <= 0
                  ? "Fees are fully paid."
                  : remainingInstallments > 0
                    ? (() => {
                        const each = roundRupees(feesBalance / remainingInstallments);
                        const last = roundRupees(feesBalance - roundRupees(each * (remainingInstallments - 1)));
                        return each === last
                          ? `Installment amount: ₹${each.toFixed(2)} per installment`
                          : `Installment amount: ₹${each.toFixed(2)} per installment, last installment ₹${last.toFixed(2)}`;
                      })()
                    : `Balance ₹${feesBalance.toFixed(2)} is still due. Add the number of installments to split it.`}
              </p>
            </div>
          </div>

          {/* Installment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <CreditCard className="w-5 h-5 text-orange-600" />
              Installment Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="noOfInstallments">No. of Installments</Label>
                <Input
                  id="noOfInstallments"
                  type="number"
                  {...form.register("noOfInstallments")}
                  value={form.watch("noOfInstallments") || ""}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installmentsPaid">Installments Paid</Label>
                <Input
                  id="installmentsPaid"
                  type="number"
                  {...form.register("installmentsPaid")}
                  value={form.watch("installmentsPaid") || ""}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remainingInstallments">Remaining Installments</Label>
                <Input
                  id="remainingInstallments"
                  type="number"
                  value={isNaN(remainingInstallments) ? 0 : remainingInstallments}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                {...form.register("remarks")}
                placeholder="Enter any additional remarks..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Student" : "Update Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
