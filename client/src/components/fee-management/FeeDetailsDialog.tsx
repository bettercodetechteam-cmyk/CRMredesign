import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  User, 
  BookOpen, 
  Wallet, 
  Phone, 
  Calendar,
  Mail,
  MapPin,
  Clock,
  Loader2
} from "lucide-react";

import { formatDate, formatDateForInput } from "@/utils/dateUtils";
import {
  resolveOrGenerateReceiptNumber,
  getReceiptFieldName,
  isUsableReceiptNumber,
  stashVoidedReceipt,
  VOIDED_RECEIPTS_FIELD,
  resolveReceiptBrand,
  receiptNumberMatchesBrand,
} from '@/lib/receiptCounterService';
import { createGstRecordIfNotExists, deleteGstRecordByReceipt } from '@/lib/gstRecordService';
import { patchFeeRecord } from '@/lib/feeRecordPersistence';
import { openReceiptPage } from '@/lib/feeReceiptUtils';
import { INSTALLMENT_AMOUNT_FIELDS, INSTALLMENT_RECEIPT_FIELDS, INSTALLMENT_DUE_DATE_FIELDS, INSTALLMENT_LATE_FEES_FIELDS, INSTALLMENT_PAYMENT_MODE_FIELDS, MAX_INSTALLMENTS } from '@/constants/feeInstallments';
import {
  getResolvedInstallmentDueDate,
  hasStoredInstallmentDueDate,
  normalizeDueDateLikeFeeDetails,
  resolveInstallmentCount,
} from '@/utils/feeInstallmentSchedule';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

function isReusableReceiptForRecord(
  record: Record<string, unknown>,
  receiptNumber: unknown
): receiptNumber is string {
  if (!isUsableReceiptNumber(receiptNumber)) return false;
  return receiptNumberMatchesBrand(receiptNumber.trim(), resolveReceiptBrand(record));
}

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
  zicaSubCategory?: string;
  fullPaymentReceiptNumber?: string;
  receiptNumber?: string;
  paymentMode: 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Cheque';
  numberOfInstallments: number;
  balanceInstallments: number;
  dueDate?: string;
  installment01DueDate?: string;
  installment02DueDate?: string;
  installment03DueDate?: string;
  installment04DueDate?: string;
  installment05DueDate?: string;
  installment06DueDate?: string;
  installment07DueDate?: string;
  installment08DueDate?: string;
  installment09DueDate?: string;
  installment10DueDate?: string;
  installment11DueDate?: string;
  installment12DueDate?: string;
  installment01LateFees?: number;
  installment02LateFees?: number;
  installment03LateFees?: number;
  installment04LateFees?: number;
  installment05LateFees?: number;
  installment06LateFees?: number;
  installment07LateFees?: number;
  installment08LateFees?: number;
  installment09LateFees?: number;
  installment10LateFees?: number;
  installment11LateFees?: number;
  installment12LateFees?: number;
  remarks?: string;
  installmentDetails?: string;
  studentId?: string;
  centreId?: string;
  voidedReceiptNumbers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface FeeDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  record: FeeRecord | null;
  onUpdate?: (updatedRecord: FeeRecord, paymentDetails?: { amount: number; installmentType: string; paymentMode: string; receiptType?: string; feesPaidDate?: string; }) => void;
  checkGstExists?: (uniqueKey: string) => boolean;
  onGstRecordCreated?: (record: Record<string, unknown>) => void;
  onGstRecordDeleted?: (deletedIds: string[]) => void;
}

interface PaymentFormData {
  amount: number;
  paymentMode: string;
  chequeNumber?: string;
  remarks: string;
  installmentName: string;
  applyLateFees?: boolean;
  /** Fees paid date (YYYY-MM-DD) - shown on receipt Date section */
  feesPaidDate?: string;
}

export default function FeeDetailsDialog({ isOpen, onClose, record, onUpdate, checkGstExists, onGstRecordCreated, onGstRecordDeleted }: FeeDetailsDialogProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [generatingReceipt, setGeneratingReceipt] = React.useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [editingDueDateRow, setEditingDueDateRow] = React.useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) setEditingDueDateRow(null);
  }, [isOpen]);

  const getInitialPaymentAmount = (currentRecord: FeeRecord): number => {
    const feesPaid = Number(currentRecord.feesPaid || 0);
    let totalPaidInstallmentAmount = 0;
    let paidInstallmentCount = 0;
    for (let i = 0; i < Math.min(INSTALLMENT_RECEIPT_FIELDS.length, Number(currentRecord.numberOfInstallments) || INSTALLMENT_RECEIPT_FIELDS.length); i++) {
      const receiptNumber = (currentRecord as Record<string, unknown>)[INSTALLMENT_RECEIPT_FIELDS[i]] as string | undefined;
      if (receiptNumber && receiptNumber !== '-' && receiptNumber.length > 3) {
        totalPaidInstallmentAmount += Number(currentRecord[INSTALLMENT_AMOUNT_FIELDS[i] as keyof FeeRecord]) || 0;
        paidInstallmentCount++;
      }
    }
    if (paidInstallmentCount === 0) return feesPaid;
    return Math.max(0, feesPaid - totalPaidInstallmentAmount);
  };

  const getInitialPaymentSlotAmount = (currentRecord: FeeRecord): number => {
    const stored = Number(currentRecord.registrationAmount) || 0;
    if (stored > 0) return stored;
    return getInitialPaymentAmount(currentRecord);
  };

  const normalizeFeesPaidDate = (currentRecord: FeeRecord): string => {
    const raw = currentRecord.feesPaidDate;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.split('T')[0];
    if (raw && typeof raw === 'object' && 'toDate' in (raw as object)) {
      const d = (raw as { toDate: () => Date }).toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const initialGstBackfillRef = React.useRef<string | null>(null);

  const createGstForPayment = React.useCallback(async (
    receiptNumber: string,
    amount: number,
    installmentType: string,
    feesPaidDate: string
  ): Promise<boolean> => {
    if (!record) return false;
    const studentId = record.studentId || record.id;
    const centreId = record.centreId || userProfile?.centreId || '';
    if (!centreId) {
      console.warn('GST not created: missing centreId on fee record');
      return false;
    }

    const companyName = resolveReceiptBrand(record as Record<string, unknown>) === 'ZICA' ? 'ZICA' : 'BETTERCODE';
    const result = await createGstRecordIfNotExists(db, {
      studentId,
      partyName: record.studentName || '',
      receiptNumber,
      totalAmount: amount,
      installmentType,
      feesPaidDate,
      companyName,
      centreId,
    });

    if (result.created && result.record) {
      onGstRecordCreated?.(result.record as unknown as Record<string, unknown>);
      return true;
    }
    return false;
  }, [record, onGstRecordCreated, userProfile?.centreId]);

  useEffect(() => {
    if (!isOpen || !record) {
      initialGstBackfillRef.current = null;
      return;
    }

    const receipt = (record.registrationReceiptNumber || record.receiptNumber || '').trim();
    if (!receipt || receipt === '-' || receipt.length < 4) return;

    const backfillKey = `${record.id}|${receipt}`;
    if (initialGstBackfillRef.current === backfillKey) return;
    initialGstBackfillRef.current = backfillKey;

    const gstAmount = getInitialPaymentSlotAmount(record);
    if (gstAmount <= 0) return;

    void createGstForPayment(
      receipt,
      gstAmount,
      'Initial Payment',
      normalizeFeesPaidDate(record)
    );
  }, [isOpen, record, createGstForPayment]);

  const removeGstForPayment = React.useCallback(async (receiptNumber: string) => {
    if (!record || !receiptNumber || receiptNumber === '-') return;
    const studentId = record.studentId || record.id;
    try {
      const { deletedIds } = await deleteGstRecordByReceipt(db, studentId, receiptNumber);
      if (deletedIds.length > 0) {
        onGstRecordDeleted?.(deletedIds);
      }
    } catch (error) {
      console.warn('Failed to delete GST record for receipt:', receiptNumber, error);
    }
  }, [record, onGstRecordDeleted]);

  const [paymentDialog, setPaymentDialog] = React.useState<{
    isOpen: boolean;
    data: PaymentFormData | null;
    installmentIndex?: number;
    installmentAmount?: number;
    installmentDueDate?: string | Date;
  }>({
    isOpen: false,
    data: null,
    installmentIndex: undefined,
    installmentAmount: undefined,
  });

  if (!record) return null;

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
    
    // Use formatDate for all other cases (it handles Date objects, strings, etc.)
    return formatDate(value);
  };

  const handleStatusChange = async (amount: number, type: 'add' | 'remove', installmentName?: string, installmentIndex?: number) => {
    if (!onUpdate) return;
    
    if (type === 'add') {
      let installmentDueDate: string | Date | undefined;
      if (installmentIndex !== undefined && installmentIndex >= 0 && installmentIndex < INSTALLMENT_DUE_DATE_FIELDS.length) {
        if (!hasStoredInstallmentDueDate(record as Record<string, unknown>, installmentIndex)) {
          toast({
            title: "Enter Due Date First",
            description: "Click the Due Date cell for this installment and select a date, then you can mark it as paid.",
            variant: "destructive",
          });
          return;
        }
        const stored = (record as any)[INSTALLMENT_DUE_DATE_FIELDS[installmentIndex]];
        installmentDueDate = typeof stored === 'string' ? stored : stored;
      }
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const existingFeesPaidDate = (record as any).feesPaidDate;
      let defaultFeesPaidDate = todayStr;
      if (existingFeesPaidDate) {
        if (typeof existingFeesPaidDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(existingFeesPaidDate)) defaultFeesPaidDate = existingFeesPaidDate.split('T')[0];
        else if (typeof existingFeesPaidDate === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(existingFeesPaidDate)) defaultFeesPaidDate = existingFeesPaidDate.split('-').reverse().join('-');
        else if (typeof existingFeesPaidDate === 'object' && (existingFeesPaidDate as any).toDate) defaultFeesPaidDate = (existingFeesPaidDate as any).toDate().toISOString().split('T')[0];
        else if (typeof existingFeesPaidDate === 'object' && typeof (existingFeesPaidDate as any).seconds === 'number') defaultFeesPaidDate = new Date((existingFeesPaidDate as any).seconds * 1000).toISOString().split('T')[0];
      }
      setPaymentDialog({
        isOpen: true,
        data: {
          amount: amount,
          paymentMode: (record.paymentMode as string) || 'Cash',
          chequeNumber: (record as any).chequeNumber || '',
          remarks: '',
          installmentName: installmentName || 'Payment',
          applyLateFees: false,
          feesPaidDate: defaultFeesPaidDate,
        },
        installmentIndex: installmentIndex,
        installmentAmount: amount,
        installmentDueDate,
      });
    } else {
      // For removing payment (marking as unpaid), handle installment-specific logic
      // IMPORTANT: Only remove the specific installment's receipt and restore its amount
      // Don't affect other paid installments or initial payment
      
      if (installmentIndex !== undefined && installmentIndex >= 0) {
        // This is a specific installment - remove its receipt number and restore amount
        const receiptField = INSTALLMENT_RECEIPT_FIELDS[installmentIndex];
        const installmentField = INSTALLMENT_AMOUNT_FIELDS[installmentIndex];
        const existingReceipt = (record as any)[receiptField];
        
        // Only proceed if this installment actually has a receipt (is paid)
        if (existingReceipt && existingReceipt !== '-' && existingReceipt.length > 3) {
          const updatedRecord: any = { ...record };
          const lateFeesField = INSTALLMENT_LATE_FEES_FIELDS[installmentIndex];

          updatedRecord[receiptField] = '-';
          updatedRecord[lateFeesField] = 0;
          const voidedMap = stashVoidedReceipt(
            (record as FeeRecord).voidedReceiptNumbers,
            receiptField,
            existingReceipt
          );
          updatedRecord[VOIDED_RECEIPTS_FIELD] = voidedMap;

          // Deduct the amount from feesPaid (include late fees if any were paid)
          const paidLateFees = Number(record[lateFeesField as keyof FeeRecord]) || 0;
          const totalPaidForInstallment = amount + paidLateFees;
          const newFeesPaid = Math.max(0, record.feesPaid - totalPaidForInstallment);
          updatedRecord.feesPaid = newFeesPaid;
          updatedRecord.feesBalance = Math.max(0, record.discountedFees - newFeesPaid);
          
          // Increase balanceInstallments count
          if (record.balanceInstallments !== undefined) {
            updatedRecord.balanceInstallments = record.balanceInstallments + 1;
          }
          
          // Do NOT redistribute the amount. Simply stay there as an unpaid installment.
          const firestoreUpdates: Record<string, unknown> = {
            [receiptField]: '-',
            [lateFeesField]: 0,
            [VOIDED_RECEIPTS_FIELD]: voidedMap,
            feesPaid: newFeesPaid,
            feesBalance: updatedRecord.feesBalance,
            balanceInstallments: updatedRecord.balanceInstallments,
          };
          
          // Add remark about unpaid action
          const timestamp = new Date().toLocaleString();
          const unpaidRemark = `\n[${timestamp}] Marked ${installmentName} as Unpaid. Receipt ${existingReceipt} removed.`;
          updatedRecord.installmentDetails = (record.installmentDetails || '') + unpaidRemark;
          firestoreUpdates.installmentDetails = updatedRecord.installmentDetails;
          
          try {
            await removeGstForPayment(existingReceipt);
            await patchFeeRecord(record.id, firestoreUpdates);
          } catch (error) {
            console.error('Failed to mark installment as unpaid:', error);
            toast({ title: "Error", description: "Failed to update payment status", variant: "destructive" });
            return;
          }
          
          // Update the record
          onUpdate(updatedRecord);
          
          toast({
            title: "Installment Marked as Unpaid",
            description: `${installmentName} has been marked as unpaid. Receipt ${existingReceipt} removed.`,
          });
        } else {
          toast({
            title: "Cannot Mark as Unpaid",
            description: "This installment is already unpaid or has no receipt.",
            variant: "destructive"
          });
        }
      } else if (installmentIndex === -2) {
        const existingReceipt = record.registrationReceiptNumber || record.receiptNumber || '';
        const hasValidReceipt = existingReceipt && existingReceipt !== '-' && existingReceipt.length > 3;

        if (!hasValidReceipt && amount <= 0) {
          toast({
            title: "Cannot Mark as Unpaid",
            description: "Initial payment is already unpaid or has no receipt.",
            variant: "destructive",
          });
          return;
        }

        const updatedRecord: Record<string, unknown> = { ...record };
        const newFeesPaid = Math.max(0, record.feesPaid - amount);
        updatedRecord.feesPaid = newFeesPaid;
        updatedRecord.feesBalance = Math.max(0, record.discountedFees - newFeesPaid);
        updatedRecord.registrationReceiptNumber = '-';
        updatedRecord.receiptNumber = '-';
        if (!Number(record.registrationAmount) || Number(record.registrationAmount) === 0) {
          updatedRecord.registrationAmount = amount;
        }

        const registrationField = getReceiptFieldName('registration') || 'registrationReceiptNumber';
        if (hasValidReceipt) {
          updatedRecord[VOIDED_RECEIPTS_FIELD] = stashVoidedReceipt(
            record.voidedReceiptNumbers,
            registrationField,
            existingReceipt
          );
        }

        const timestamp = new Date().toLocaleString();
        const unpaidRemark = `\n[${timestamp}] Marked Initial Payment as Unpaid.${hasValidReceipt ? ` Receipt ${existingReceipt} removed.` : ''}`;
        updatedRecord.installmentDetails = (record.installmentDetails || '') + unpaidRemark;

        const firestoreUpdates: Record<string, unknown> = {
          feesPaid: newFeesPaid,
          feesBalance: updatedRecord.feesBalance,
          registrationReceiptNumber: '-',
          receiptNumber: '-',
          registrationAmount: updatedRecord.registrationAmount,
          installmentDetails: updatedRecord.installmentDetails,
        };
        if (hasValidReceipt) {
          firestoreUpdates[VOIDED_RECEIPTS_FIELD] = updatedRecord[VOIDED_RECEIPTS_FIELD];
        }

        try {
          if (hasValidReceipt) {
            await removeGstForPayment(existingReceipt);
          }

          await patchFeeRecord(record.id, firestoreUpdates);
        } catch (error) {
          console.error('Failed to mark initial payment as unpaid:', error);
          toast({ title: "Error", description: "Failed to update payment status", variant: "destructive" });
          return;
        }

        onUpdate(updatedRecord as FeeRecord);
        toast({
          title: "Initial Payment Marked as Unpaid",
          description: hasValidReceipt
            ? `Initial payment marked as unpaid. Receipt ${existingReceipt} removed.`
            : "Initial payment marked as unpaid.",
        });
      } else if (installmentIndex === -3) {
        const existingReceipt =
          record.fullPaymentReceiptNumber ||
          record.registrationReceiptNumber ||
          record.receiptNumber ||
          '';
        const hasValidReceipt = existingReceipt && existingReceipt !== '-' && existingReceipt.length > 3;

        if (hasValidReceipt) {
          await removeGstForPayment(existingReceipt);
        }

        const newFeesPaid = Math.max(0, record.feesPaid - amount);
        onUpdate({
          ...record,
          feesPaid: newFeesPaid,
          feesBalance: Math.max(0, record.discountedFees - newFeesPaid),
          registrationReceiptNumber: '-',
          receiptNumber: '-',
          fullPaymentReceiptNumber: '-',
        });
      }
    }
  };

  const handleSaveDueDate = async (installmentIndex: number, dateValue: string) => {
    if (!record || !onUpdate || installmentIndex < 0) return;
    const totalInstallments = Number(record.numberOfInstallments) || 0;
    if (installmentIndex >= totalInstallments) return;

    // Find first unpaid installment (no receipt or invalid receipt)
    let firstUnpaidIndex = -1;
    for (let i = 0; i < totalInstallments && i < INSTALLMENT_RECEIPT_FIELDS.length; i++) {
      const r = (record as any)[INSTALLMENT_RECEIPT_FIELDS[i]];
      if (!r || r === '-' || String(r).length <= 3) {
        firstUnpaidIndex = i;
        break;
      }
    }

    setEditingDueDateRow(null);
    const valueToSave = dateValue?.trim() || null;
    if (!valueToSave) return;

    try {
      const updates: Record<string, string> = {};

      // Always cascade: use current edited date as base, then same day +1 month for each remaining installment
      // Parse YYYY-MM-DD manually to avoid timezone issues (new Date(string) parses as UTC)
      const parts = valueToSave.split('-');
      if (parts.length !== 3) return;
      const baseYear = parseInt(parts[0], 10);
      const baseMonth = parseInt(parts[1], 10) - 1; // 0-indexed for Date
      const dayOfMonth = parseInt(parts[2], 10);
      if (isNaN(baseYear) || isNaN(baseMonth) || isNaN(dayOfMonth)) return;

      for (let i = installmentIndex; i < totalInstallments && i < INSTALLMENT_DUE_DATE_FIELDS.length; i++) {
        const monthOffset = i - installmentIndex;
        const d = new Date(baseYear, baseMonth + monthOffset, dayOfMonth);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        updates[INSTALLMENT_DUE_DATE_FIELDS[i]] = `${y}-${m}-${day}`;
      }

      await patchFeeRecord(record.id, updates);
      const updatedRecord = { ...record, ...updates };
      onUpdate(updatedRecord);
      const count = totalInstallments - installmentIndex;
      toast({
        title: "Due Dates Updated",
        description: `Due dates set for ${count} installment(s) starting ${valueToSave} (monthwise).`
      });
    } catch (error) {
      console.error('Failed to save due date:', error);
      toast({ title: "Failed to save", description: "Could not update due date", variant: "destructive" });
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentDialog.data || !onUpdate || isProcessingPayment) return;

    setIsProcessingPayment(true);
    try {
    const { amount, paymentMode, chequeNumber, remarks, installmentName, applyLateFees, feesPaidDate: dialogFeesPaidDate } = paymentDialog.data;
    const installmentIndex = paymentDialog.installmentIndex;
    // Use ORIGINAL scheduled amount from record when available so "reduced amount" (e.g. 8000 vs 9700) triggers redistribution
    const originalFromRecord = (installmentIndex !== undefined && installmentIndex >= 0 && installmentIndex < INSTALLMENT_AMOUNT_FIELDS.length)
      ? Number(record[INSTALLMENT_AMOUNT_FIELDS[installmentIndex] as keyof FeeRecord]) || 0
      : 0;
    const installmentAmount = (originalFromRecord > 0 ? originalFromRecord : paymentDialog.installmentAmount) || amount;

    let lateFeesAmount = 0;
    if (applyLateFees && installmentIndex !== undefined && installmentIndex >= 0 && paymentDialog.installmentDueDate) {
      let dueStr = '';
      if (typeof paymentDialog.installmentDueDate === 'string') {
        dueStr = paymentDialog.installmentDueDate.split('T')[0];
      } else if (paymentDialog.installmentDueDate instanceof Date) {
        dueStr = paymentDialog.installmentDueDate.toISOString().split('T')[0];
      }
      if (dueStr && /^\d{4}-\d{2}-\d{2}/.test(dueStr)) {
        const parts = dueStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dueDate = new Date(y, m, d);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        const diffMs = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        lateFeesAmount = Math.max(0, daysOverdue) * 100;
      }
    }
    const totalAmount = amount + lateFeesAmount;

    // Calculate receipt type for consistency
    let receiptType = 'onetime';
    if (installmentIndex !== undefined) {
        if (installmentIndex >= 0) {
            const installmentNum = (installmentIndex + 1).toString().padStart(2, '0');
            receiptType = `installment${installmentNum}`;
        } else if (installmentIndex === -2) {
            receiptType = 'registration';
        }
    }

    let newFeesPaid = record.feesPaid;
    
    // Allow total paid to include late fees: max = discounted fees + this payment's late fees (late fees are extra charges)
    const maxAllowedTotal = record.discountedFees + lateFeesAmount + 1; // +1 for rounding
    if (newFeesPaid + totalAmount > maxAllowedTotal) {
      alert(`Cannot mark as paid: Total paid (₹${(newFeesPaid + totalAmount).toLocaleString()}) would exceed Total Discounted Fees (₹${record.discountedFees.toLocaleString()})${lateFeesAmount > 0 ? ` plus late fees (₹${lateFeesAmount.toLocaleString()})` : ''}.\n\nPlease check the installment amounts or update the Total Discounted Fees.`);
      return;
    }
    
    newFeesPaid += totalAmount;
    
    const updatedRecord: any = { ...record };
    
    // Fees paid date: ALWAYS prefer what user entered in dialog (normalize to YYYY-MM-DD). Never use today if dialog has any date value.
    const normalizeToYYYYMMDD = (val: unknown): string => {
      if (!val) return '';
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
      const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      return '';
    };
    const todayForDate = new Date();
    const todayFeesPaidStr = `${todayForDate.getFullYear()}-${String(todayForDate.getMonth() + 1).padStart(2, '0')}-${String(todayForDate.getDate()).padStart(2, '0')}`;
    const dialogNormalized = normalizeToYYYYMMDD(dialogFeesPaidDate);
    const recordNormalized = normalizeToYYYYMMDD((record as any).feesPaidDate);
    const feesPaidDateToSave = dialogNormalized || recordNormalized || todayFeesPaidStr;
    updatedRecord.feesPaidDate = feesPaidDateToSave;
    const recordForReceipt = {
      ...(record as Record<string, unknown>),
      feesPaidDate: feesPaidDateToSave,
    };

    if (
      installmentIndex !== undefined &&
      installmentIndex >= 0 &&
      !hasStoredInstallmentDueDate(record as Record<string, unknown>, installmentIndex)
    ) {
      toast({
        title: 'Enter Due Date First',
        description: 'Set the installment due date before marking it as paid.',
        variant: 'destructive',
      });
      setIsProcessingPayment(false);
      return;
    }

    if (installmentIndex === -2) {
      const timestamp = new Date().toLocaleString();
      let paymentDetails = `Paid ${installmentName}: ₹${totalAmount} via ${paymentMode}`;
      if (paymentMode === 'Cheque' && chequeNumber) {
        paymentDetails += ` (Cheque No: ${chequeNumber})`;
      }
      const newRemarkEntry = `\n[${timestamp}] ${paymentDetails}.`;

      const priorReceipt = record.registrationReceiptNumber || record.receiptNumber || '';
      const hadPriorReceipt = priorReceipt && priorReceipt !== '-' && priorReceipt.length > 3;
      const feesAlreadyRecorded = !hadPriorReceipt && Number(record.feesPaid) >= amount - 0.01;

      updatedRecord.feesPaid = feesAlreadyRecorded ? Number(record.feesPaid) : newFeesPaid;
      updatedRecord.feesBalance = Math.max(0, record.discountedFees - Number(updatedRecord.feesPaid));
      updatedRecord.installmentDetails = (record.installmentDetails || '') + newRemarkEntry;
      updatedRecord.registrationAmount = Number(record.registrationAmount) || amount;
      updatedRecord.paymentMode = paymentMode || record.paymentMode || 'Cash';
      if (paymentMode === 'Cheque') {
        updatedRecord.chequeNumber = paymentDialog.data?.chequeNumber ?? (record as Record<string, unknown>).chequeNumber ?? '';
      }

      try {
        const resolved = await resolveOrGenerateReceiptNumber(db, record.id, 'registration', recordForReceipt);
        updatedRecord.registrationReceiptNumber = resolved.receiptNumber;
        updatedRecord.receiptNumber = resolved.receiptNumber;
      } catch (error) {
        console.error('Could not generate initial payment receipt:', error);
        toast({
          title: 'Receipt Error',
          description: 'Could not generate receipt number for Initial Payment.',
          variant: 'destructive',
        });
        setIsProcessingPayment(false);
        return;
      }

      const receiptForGst = updatedRecord.registrationReceiptNumber || updatedRecord.receiptNumber;
      const gstAmount = Number(record.registrationAmount) || amount;
      if (receiptForGst && receiptForGst !== '-') {
        try {
          const gstCreated = await createGstForPayment(
            receiptForGst,
            gstAmount,
            'Initial Payment',
            feesPaidDateToSave
          );
          if (!gstCreated) {
            toast({
              title: 'GST Notice',
              description: 'Payment saved. GST record already exists or could not be created.',
            });
          }
        } catch (gstErr) {
          console.warn('GST record create for initial payment:', gstErr);
          toast({
            title: 'GST Error',
            description: 'Payment saved but GST record could not be created.',
            variant: 'destructive',
          });
        }
      }

      onUpdate(updatedRecord, {
        amount,
        installmentType: installmentName,
        paymentMode,
        receiptType: 'registration',
        feesPaidDate: feesPaidDateToSave,
      });
      setTimeout(() => {
        openReceiptPage(
          record.id,
          'registration',
          amount,
          {
            ...(updatedRecord as Record<string, unknown>),
            feesPaidDate: feesPaidDateToSave,
          },
        );
      }, 400);
      setPaymentDialog({ isOpen: false, data: null, installmentIndex: undefined, installmentAmount: undefined });
      setIsProcessingPayment(false);
      return;
    }
    
    // Check if this is a full installment payment (within tolerance)
    const isFullPayment = Math.abs(amount - installmentAmount) < 0.01;
    
    // If amount is different from installment amount, redistribute remaining balance
    // This handles both partial payments and overpayments
    if (isFullPayment && installmentIndex !== undefined && installmentIndex >= 0) {
      // Full installment payment - mark as paid, generate NEW receipt number
      const timestamp = new Date().toLocaleString();
      let paymentDetails = `Paid ${installmentName}: ₹${totalAmount} via ${paymentMode}`;
      if (lateFeesAmount > 0) {
        paymentDetails += ` (incl. Late Fees: ₹${lateFeesAmount})`;
      }
      if (paymentMode === 'Cheque' && chequeNumber) {
        paymentDetails += ` (Cheque No: ${chequeNumber})`;
      }
      const newRemarkEntry = `\n[${timestamp}] ${paymentDetails}.`;
      const updatedInstallmentDetails = (record.installmentDetails || '') + newRemarkEntry;

      updatedRecord.feesPaid = newFeesPaid;
      updatedRecord.feesBalance = Math.max(0, record.discountedFees - newFeesPaid);
      updatedRecord.installmentDetails = updatedInstallmentDetails;
      
      // IMPORTANT: Preserve the installment amount in the record
      // This ensures the amount doesn't change when we recalculate
      const currentInstallmentField = INSTALLMENT_AMOUNT_FIELDS[installmentIndex];
      const currentInstallmentAmount = Number(record[currentInstallmentField as keyof FeeRecord]) || installmentAmount;
      
      // If installment amount is not stored, store it now
      if (!updatedRecord[currentInstallmentField] || updatedRecord[currentInstallmentField] === 0) {
        updatedRecord[currentInstallmentField] = installmentAmount;
        console.log(`💾 Storing installment amount ₹${installmentAmount} in field ${currentInstallmentField}`);
      } else {
        // Preserve existing amount
        updatedRecord[currentInstallmentField] = currentInstallmentAmount;
        console.log(`✅ Preserving existing installment amount ₹${currentInstallmentAmount} in field ${currentInstallmentField}`);
      }
      
      // Reduce the count of balanced installments if full payment is made
      if (record.balanceInstallments && record.balanceInstallments > 0) {
        updatedRecord.balanceInstallments = record.balanceInstallments - 1;
      }
      
      // Generate NEW receipt number for this installment - ALWAYS generate new one
      const receiptField = INSTALLMENT_RECEIPT_FIELDS[installmentIndex];
      const existingReceipt = (record as any)[receiptField];
      if (lateFeesAmount > 0) {
        (updatedRecord as any)[INSTALLMENT_LATE_FEES_FIELDS[installmentIndex]] = lateFeesAmount;
      }
      
      // Only generate receipt number if one doesn't exist yet for THIS specific installment
      if (!isReusableReceiptForRecord(recordForReceipt, existingReceipt)) {
        try {
          // Generate NEW receipt number for this installment
          // IMPORTANT: Pass null to force generation - don't check existing data
          // This ensures each installment gets a unique receipt number
          console.log('🆕 Generating NEW receipt number for installment', installmentIndex + 1, 'with type:', receiptType);
          const resolved = await resolveOrGenerateReceiptNumber(db, record.id, receiptType, recordForReceipt);
          (updatedRecord as any)[receiptField] = resolved.receiptNumber;
          console.log('✅ Generated NEW receipt number:', resolved.receiptNumber, 'for field:', receiptField, 'installment:', installmentIndex + 1);
        } catch (error) {
          console.error('❌ Could not generate receipt number:', error);
          // Continue without receipt number - user can generate it later via Receipt button
        }
      } else {
        console.log('ℹ️ Installment', installmentIndex + 1, 'already has receipt number:', existingReceipt, '- using existing');
        // Use existing receipt number
        (updatedRecord as any)[receiptField] = existingReceipt;
      }
      
      // IMPORTANT: Ensure receipt number is saved to Firestore immediately
      // This ensures the receipt number is persisted before onUpdate is called
      if ((updatedRecord as any)[receiptField] && (updatedRecord as any)[receiptField] !== '-') {
        try {
          const currentFeeData = record as Record<string, unknown>;
          const newReceiptNumber = (updatedRecord as any)[receiptField];

          const allReceiptFields = [
            'registrationReceiptNumber', 'receiptNumber', 'fullPaymentReceiptNumber',
            ...INSTALLMENT_RECEIPT_FIELDS,
          ];

          let isDuplicate = false;
          for (const field of allReceiptFields) {
            if (field !== receiptField && currentFeeData[field] === newReceiptNumber) {
              console.error('❌ DUPLICATE DETECTED! Receipt number', newReceiptNumber, 'already exists in field', field);
              isDuplicate = true;
              break;
            }
          }

          if (isDuplicate) {
            console.warn('⚠️ Regenerating receipt number due to duplicate in database...');
            const resolved = await resolveOrGenerateReceiptNumber(db, record.id, receiptType, recordForReceipt);
            (updatedRecord as any)[receiptField] = resolved.receiptNumber;
            await patchFeeRecord(record.id, { [receiptField]: resolved.receiptNumber });
            console.log('✅ Regenerated and saved NEW receipt number:', resolved.receiptNumber, 'in field:', receiptField);
          } else {
            const installmentAmountToSave = updatedRecord[currentInstallmentField] || installmentAmount;
            const updateData: Record<string, unknown> = {
              [receiptField]: newReceiptNumber,
              [currentInstallmentField]: installmentAmountToSave,
              feesPaid: newFeesPaid,
              feesBalance: Math.max(0, record.discountedFees - newFeesPaid),
              installmentDetails: (record.installmentDetails || '') + newRemarkEntry,
              balanceInstallments: record.balanceInstallments && record.balanceInstallments > 0 ? record.balanceInstallments - 1 : record.balanceInstallments,
              paymentMode: paymentMode || record.paymentMode || 'Cash',
              chequeNumber: paymentMode === 'Cheque' ? (paymentDialog.data?.chequeNumber ?? (record as any).chequeNumber ?? '') : ((record as any).chequeNumber ?? ''),
              [INSTALLMENT_PAYMENT_MODE_FIELDS[installmentIndex]]: paymentMode || 'Cash',
              feesPaidDate: feesPaidDateToSave
            };
            if (lateFeesAmount > 0) {
              updateData[INSTALLMENT_LATE_FEES_FIELDS[installmentIndex]] = lateFeesAmount;
            }
            await patchFeeRecord(record.id, updateData);
            console.log('💾 Saved receipt number and installment amount:', {
              receiptNumber: newReceiptNumber,
              field: receiptField,
              installmentAmount: installmentAmountToSave,
              installmentField: currentInstallmentField
            });
          }
        } catch (error) {
          console.error('❌ Failed to save receipt number:', error);
        }
      }
      
      // IMPORTANT: Ensure installment amount is preserved in the update
      // This ensures the amount doesn't get recalculated on next view
      if (!updatedRecord[currentInstallmentField] || updatedRecord[currentInstallmentField] === 0) {
        updatedRecord[currentInstallmentField] = installmentAmount;
        console.log(`💾 Preserving installment amount ₹${installmentAmount} in field ${currentInstallmentField}`);
      }
      
      // Set per-installment payment mode so installment table and receipt show the selected mode
      if (installmentIndex !== undefined && installmentIndex >= 0) {
        (updatedRecord as any)[INSTALLMENT_PAYMENT_MODE_FIELDS[installmentIndex]] = paymentMode || 'Cash';
      }
      // Ensure updatedRecord has chequeNumber and paymentMode so receipt and parent state show them
      const chequeToSave = paymentMode === 'Cheque' ? (paymentDialog.data?.chequeNumber ?? (record as any).chequeNumber ?? '') : ((record as any).chequeNumber ?? '');
      (updatedRecord as any).chequeNumber = chequeToSave;
      (updatedRecord as any).paymentMode = paymentMode || (record as any).paymentMode || 'Cash';

      const receiptNumberForGst = (updatedRecord as any)[receiptField];
      if (receiptNumberForGst && receiptNumberForGst !== '-') {
        try {
          await createGstForPayment(receiptNumberForGst, totalAmount, installmentName, feesPaidDateToSave);
        } catch (gstErr) {
          console.warn('GST record create at confirm:', gstErr);
        }
      }

      // Update the record with all changes (receipt number, installment amount, feesPaid, etc.)
      onUpdate(updatedRecord, {
        amount: amount,
        installmentType: installmentName,
        paymentMode: paymentMode,
        receiptType: receiptType,
        feesPaidDate: feesPaidDateToSave
      });

      setTimeout(() => {
        const installmentNum = (installmentIndex + 1).toString().padStart(2, '0');
        openReceiptPage(
          record.id,
          `installment${installmentNum}`,
          totalAmount,
          {
            ...(updatedRecord as Record<string, unknown>),
            feesPaidDate: feesPaidDateToSave,
          },
        );
      }, 400);
      
    } else {
      // Partial payment OR different amount - redistribute remaining balance among UNPAID installments only
      // IMPORTANT: Don't change previous installments (already paid) or initial payment amount
      const remainingFees = record.discountedFees - newFeesPaid;
      
      // Identify which installments are already PAID (have receipt numbers)
      const paidInstallmentIndices = new Set<number>();
      INSTALLMENT_RECEIPT_FIELDS.forEach((receiptField, idx) => {
        const receiptNumber = (record as any)[receiptField];
        if (receiptNumber && receiptNumber !== '-' && receiptNumber.length > 3) {
          // This installment has a receipt number, so it's paid - preserve it
          paidInstallmentIndices.add(idx);
          console.log(`✅ Preserving paid installment ${idx + 1} with receipt ${receiptNumber}`);
        }
      });
      
      // Only consider UNPAID installments BELOW current (never change previous installments)
      const unpaidInstallments: Array<{ field: string; index: number; currentAmount: number }> = [];
      const totalInstallments = Number(record.numberOfInstallments) || 0;
      const startIndex = installmentIndex !== undefined && installmentIndex >= 0 ? installmentIndex + 1 : 0;
      for (let i = startIndex; i < totalInstallments && i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
        if (paidInstallmentIndices.has(i)) continue;
        const field = INSTALLMENT_AMOUNT_FIELDS[i];
        const currentAmount = Number(record[field as keyof FeeRecord]) || 0;
        unpaidInstallments.push({ field, index: i, currentAmount });
      }
      
      // Update current installment amount based on payment
      // Partial payment: remaining amount goes into EXISTING remaining installments only.
      // Add a NEW installment only when this IS the last installment and amount still remains.
      let addedNewInstallmentForRemaining = false;
      if (installmentIndex !== undefined && installmentIndex >= 0) {
        const currentField = INSTALLMENT_AMOUNT_FIELDS[installmentIndex];
        const remainingInCurrent = installmentAmount - amount;
        
        if (amount < installmentAmount && remainingInCurrent > 0) {
          // Partial payment: Set this installment to the paid amount and mark as paid
          updatedRecord[currentField] = amount;
          
          if (unpaidInstallments.length > 0) {
            // Installment(s) exist below: add full remaining amount into the next installment (immediately below). Do NOT add new installment.
            const nextInstallment = unpaidInstallments[0];
            const currentVal = Number((updatedRecord as any)[nextInstallment.field]) || nextInstallment.currentAmount;
            const newAmount = parseFloat((currentVal + remainingInCurrent).toFixed(2));
            (updatedRecord as any)[nextInstallment.field] = newAmount;
            console.log(`✅ Partial: Remaining ₹${remainingInCurrent.toFixed(2)} added to Installment ${nextInstallment.index + 1} (₹${currentVal} → ₹${newAmount})`);
            console.log(`✅ Partial payment: Installment ${installmentIndex + 1} paid ₹${amount}. Remaining ₹${remainingInCurrent.toFixed(2)} added to Installment ${nextInstallment.index + 1} below.`);
          } else if (totalInstallments < MAX_INSTALLMENTS) {
            // This is the last installment; no other unpaid slots. Add new installment with remaining amount.
            const newTotalInstallments = totalInstallments + 1;
            const newIndex = totalInstallments;
            updatedRecord.numberOfInstallments = newTotalInstallments;
            (updatedRecord as any)[INSTALLMENT_AMOUNT_FIELDS[newIndex]] = parseFloat(remainingInCurrent.toFixed(2));
            
            const currentDueField = INSTALLMENT_DUE_DATE_FIELDS[installmentIndex];
            const currentDueVal = record[currentDueField as keyof FeeRecord];
            let nextDueDate: string | undefined;
            if (currentDueVal) {
              let d: Date;
              if (currentDueVal instanceof Date) d = currentDueVal;
              else if (typeof currentDueVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(currentDueVal)) {
                d = new Date(currentDueVal.split('T')[0]);
              } else d = new Date();
              const next = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
              const y = next.getFullYear();
              const m = String(next.getMonth() + 1).padStart(2, '0');
              const day = String(next.getDate()).padStart(2, '0');
              nextDueDate = `${y}-${m}-${day}`;
            } else {
              const next = new Date();
              next.setMonth(next.getMonth() + 1);
              const y = next.getFullYear();
              const m = String(next.getMonth() + 1).padStart(2, '0');
              const day = String(next.getDate()).padStart(2, '0');
              nextDueDate = `${y}-${m}-${day}`;
            }
            if (nextDueDate && INSTALLMENT_DUE_DATE_FIELDS[newIndex]) {
              (updatedRecord as any)[INSTALLMENT_DUE_DATE_FIELDS[newIndex]] = nextDueDate;
            }
            updatedRecord.balanceInstallments = (record.balanceInstallments ?? 0);
            addedNewInstallmentForRemaining = true;
            console.log(`✅ Partial payment (last installment): Installment ${installmentIndex + 1} paid ₹${amount}. New Installment ${newIndex + 1} added with ₹${remainingInCurrent.toFixed(2)} (due ${nextDueDate})`);
          } else {
            console.log(`✅ Partial payment: Max installments reached, cannot add new installment.`);
          }
        } else if (amount > installmentAmount) {
          // Overpayment - update payment amount and deduct excess from LAST unpaid installment
          updatedRecord[currentField] = amount;
          const excess = amount - installmentAmount;
          console.log(`💰 Overpayment: Installment ${installmentIndex + 1} paid ₹${amount}, excess ₹${excess}`);
          
          if (unpaidInstallments.length > 0) {
              const lastUnpaid = unpaidInstallments[unpaidInstallments.length - 1];
              const newAmount = Math.max(0, lastUnpaid.currentAmount - excess);
              updatedRecord[lastUnpaid.field] = newAmount;
              console.log(`🔄 Deducted excess from Installment ${lastUnpaid.index + 1}: ₹${lastUnpaid.currentAmount} → ₹${newAmount}`);
          }
        } else {
          // Exact payment - mark as paid amount
          updatedRecord[currentField] = amount;
          console.log(`✅ Exact payment: Installment ${installmentIndex + 1} paid ₹${amount}`);
        }
      }
      
      // If balance is fully paid (<= 0), set all remaining unpaid installments to 0
      if (unpaidInstallments.length > 0 && remainingFees <= 0) {
        unpaidInstallments.forEach(item => {
          if (installmentIndex === undefined || item.index !== installmentIndex) {
            updatedRecord[item.field] = 0;
            console.log(`✅ Setting installment ${item.index + 1} to ₹0 (balance fully paid)`);
          }
        });
      }
      
      // Generate receipt number for current installment if it's being paid
      if (installmentIndex !== undefined && installmentIndex >= 0) {
        const receiptField = INSTALLMENT_RECEIPT_FIELDS[installmentIndex];
        const existingReceipt = (record as any)[receiptField];
        
        // Only generate receipt number if one doesn't exist yet
        if (!isReusableReceiptForRecord(recordForReceipt, existingReceipt)) {
          try {
            console.log('🆕 Generating NEW receipt number for installment', installmentIndex + 1, 'with type:', receiptType);
            const resolved = await resolveOrGenerateReceiptNumber(db, record.id, receiptType, recordForReceipt);
            (updatedRecord as any)[receiptField] = resolved.receiptNumber;
            console.log('✅ Generated NEW receipt number:', resolved.receiptNumber, 'for field:', receiptField);
            
            // Save receipt number AND installment amount to Firestore together
            const currentInstallmentField = INSTALLMENT_AMOUNT_FIELDS[installmentIndex];
            const installmentAmountToSave = updatedRecord[currentInstallmentField] || installmentAmount;

            await patchFeeRecord(record.id, {
              [receiptField]: resolved.receiptNumber,
              [currentInstallmentField]: installmentAmountToSave,
              paymentMode: paymentMode || record.paymentMode || 'Cash',
              chequeNumber: paymentMode === 'Cheque' ? (paymentDialog.data?.chequeNumber ?? (record as any).chequeNumber ?? '') : ((record as any).chequeNumber ?? ''),
              [INSTALLMENT_PAYMENT_MODE_FIELDS[installmentIndex]]: paymentMode || 'Cash',
              feesPaidDate: feesPaidDateToSave
            });
            console.log('💾 Saved receipt number and installment amount:', {
              receiptNumber: resolved.receiptNumber,
              installmentAmount: installmentAmountToSave
            });
          } catch (error) {
            console.error('❌ Could not generate receipt number:', error);
            // Continue - receipt can be generated later via Receipt button
          }
        } else {
          // Receipt already exists, but ensure installment amount is saved
          const currentInstallmentField = INSTALLMENT_AMOUNT_FIELDS[installmentIndex];
          if (!updatedRecord[currentInstallmentField] || updatedRecord[currentInstallmentField] === 0) {
            updatedRecord[currentInstallmentField] = installmentAmount;
          }
        }
      }
      
      const receiptFieldPartial = installmentIndex !== undefined ? INSTALLMENT_RECEIPT_FIELDS[installmentIndex] : null;
      const receiptNumberPartial = receiptFieldPartial ? (updatedRecord as any)[receiptFieldPartial] : null;
      if (receiptNumberPartial && receiptNumberPartial !== '-') {
        try {
          await createGstForPayment(receiptNumberPartial, amount, installmentName, feesPaidDateToSave);
        } catch (gstErr) {
          console.warn('GST record create at confirm (partial):', gstErr);
        }
      }

      const timestamp = new Date().toLocaleString();
      let paymentDetails = `Paid ${installmentName}: ₹${amount} via ${paymentMode}`;
      if (paymentMode === 'Cheque' && chequeNumber) {
        paymentDetails += ` (Cheque No: ${chequeNumber})`;
      }
      if (remarks) {
        paymentDetails += ` - ${remarks}`;
      }
      
      const redistributionNote = addedNewInstallmentForRemaining
        ? ` Remaining amount added as new installment below.`
        : (unpaidInstallments.length > 0 && installmentIndex !== undefined && amount < installmentAmount)
          ? ` Remaining ₹${(installmentAmount - amount).toLocaleString()} added to next installment below.`
          : '';
      const newRemarkEntry = `\n[${timestamp}] ${paymentDetails}.${redistributionNote}`;
      const updatedInstallmentDetails = (record.installmentDetails || '') + newRemarkEntry;

      updatedRecord.feesPaid = newFeesPaid;
      updatedRecord.feesBalance = Math.max(0, record.discountedFees - newFeesPaid);
      updatedRecord.installmentDetails = updatedInstallmentDetails;
      
      // Update balanceInstallments count (we're marking this installment as paid). If we added a new installment for remaining amount, count stays same.
      if (!addedNewInstallmentForRemaining && record.balanceInstallments && record.balanceInstallments > 0 && installmentIndex !== undefined && installmentIndex >= 0) {
        updatedRecord.balanceInstallments = record.balanceInstallments - 1;
      }
      
      // Set per-installment payment mode so installment table and receipt show the selected mode
      if (installmentIndex !== undefined && installmentIndex >= 0) {
        (updatedRecord as any)[INSTALLMENT_PAYMENT_MODE_FIELDS[installmentIndex]] = paymentMode || 'Cash';
      }
      // Ensure updatedRecord has chequeNumber and paymentMode so receipt and parent state show them
      const chequeToSavePartial = paymentMode === 'Cheque' ? (paymentDialog.data?.chequeNumber ?? (record as any).chequeNumber ?? '') : ((record as any).chequeNumber ?? '');
      (updatedRecord as any).chequeNumber = chequeToSavePartial;
      (updatedRecord as any).paymentMode = paymentMode || (record as any).paymentMode || 'Cash';

      // IMPORTANT: Ensure all installment amounts are preserved
      for (let i = 0; i < totalInstallments && i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
        const field = INSTALLMENT_AMOUNT_FIELDS[i];
        // Only preserve if the field was NOT explicitly set in updatedRecord
        // Use 'in' operator to distinguish between "not set" and "set to 0"
        if (!(field in updatedRecord)) {
          const existingAmount = Number(record[field as keyof FeeRecord]) || 0;
          if (existingAmount > 0) {
            updatedRecord[field] = existingAmount;
          }
        }
      }
      
      // Update the record with all changes (receipt numbers, installment amounts, feesPaid, etc.)
      onUpdate(updatedRecord, {
        amount: amount,
        installmentType: installmentName,
        paymentMode: paymentMode,
        receiptType: receiptType,
        feesPaidDate: feesPaidDateToSave
      });
    }

    setPaymentDialog({ isOpen: false, data: null, installmentIndex: undefined, installmentAmount: undefined });
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Payment Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Helper to generate installment rows - Shows both Paid and Pending installments
  // Individual paid installments are shown with their receipt numbers
  const getInstallmentRows = () => {
    if (!record) return [];
    
    // Create a local reference to ensure type safety
    const currentRecord = record!;
    
    const installments: {
      name: string;
      amount: number;
      dueDate: string | Date | undefined;
      dueDatePassed?: boolean;
      dueDateMissing?: boolean;
      status: string;
      paidAmount: number;
      balance: number;
      receiptNumber: string;
      index: number;
    }[] = [];
    
    const recordData = currentRecord as Record<string, unknown>;
    const installmentSlotCount = resolveInstallmentCount(recordData);

    // If this fee is a one-time payment (no installments), show it as a single row in the table
    if (installmentSlotCount === 0) {
      const totalAmount = Number(currentRecord.discountedFees || currentRecord.actualFees || 0);
      const paidAmount = Number(currentRecord.feesPaid || 0);
      const balance = Math.max(0, Number(currentRecord.feesBalance || 0));

      if (totalAmount > 0) {
        installments.push({
          name: 'One Time Fee',
          amount: totalAmount,
          dueDate: undefined, // No due date for one-time payments
          dueDatePassed: false,
          status: balance === 0 ? 'Paid' : 'Pending',
          paidAmount: balance === 0 ? totalAmount : paidAmount,
          balance: balance,
          receiptNumber: currentRecord.registrationReceiptNumber || currentRecord.fullPaymentReceiptNumber || currentRecord.receiptNumber || '-',
          index: -3 // One time fee has index -3 (non-installment)
        });
      }

      return installments;
    }
    
    // Installments Logic:
    // 1. Show "Initial Payment" = feesPaid at the time of student creation (separate from installments)
    // 2. Show installments separately - each with its own receipt number when paid
    const totalInstallments = installmentSlotCount;
    const feesPaid = Number(currentRecord.feesPaid || 0);
    const discountedFees = Number(currentRecord.discountedFees || 0);
    const feesBalance = Math.max(0, Number(currentRecord.feesBalance || 0));
    
    // Calculate initial payment amount
    // Simple approach: If registration receipt exists, that's the initial payment
    // Otherwise, estimate: initialPayment = feesPaid when no installments paid
    // If installments paid, estimate based on typical pattern
    
    // Count paid installments and calculate their total amount
    let paidInstallmentCount = 0;
    let totalPaidInstallmentAmount = 0;
    for (let i = 0; i < Math.min(totalInstallments, INSTALLMENT_RECEIPT_FIELDS.length); i++) {
      const receiptNumber = (currentRecord as any)[INSTALLMENT_RECEIPT_FIELDS[i]];
      if (receiptNumber && receiptNumber !== '-' && receiptNumber.length > 3) {
        const installmentAmount = Number(currentRecord[INSTALLMENT_AMOUNT_FIELDS[i] as keyof FeeRecord]) || 0;
        totalPaidInstallmentAmount += installmentAmount;
        paidInstallmentCount++;
      }
    }
    
    // Calculate initial payment amount
    // IMPORTANT: Initial Payment = Total Paid - Sum of Paid Installments
    // This ensures initial payment remains constant regardless of installment payments
    let initialPaymentAmount = 0;
    if (paidInstallmentCount === 0) {
      // No installments paid yet, so initialPayment = feesPaid
      initialPaymentAmount = feesPaid;
    } else {
      // Some installments paid - calculate initial payment as difference
      // This ensures initial payment doesn't change when installments are paid
      initialPaymentAmount = Math.max(0, feesPaid - totalPaidInstallmentAmount);
    }

    
    // Calculate remaining balance after initial payment (for calculating installment amounts)
    const balanceAfterInitial = Math.max(0, discountedFees - initialPaymentAmount);
    
    // Step 1: Show Initial Payment when paid OR when slot exists (registrationAmount) after marking unpaid
    const storedRegistrationAmount = Number(currentRecord.registrationAmount) || 0;
    const initialReceiptNo = currentRecord.registrationReceiptNumber || currentRecord.receiptNumber || '-';
    const hasInitialReceipt = initialReceiptNo && initialReceiptNo !== '-' && initialReceiptNo.length > 3;
    const initialSlotAmount = storedRegistrationAmount > 0
      ? storedRegistrationAmount
      : initialPaymentAmount;

    if (initialSlotAmount > 0) {
      const isInitialPaid = hasInitialReceipt;
      installments.push({
        name: 'Initial Payment',
        amount: initialSlotAmount,
        dueDate: undefined,
        dueDatePassed: false,
        status: isInitialPaid ? 'Paid' : 'Pending',
        paidAmount: isInitialPaid ? initialSlotAmount : 0,
        balance: isInitialPaid ? 0 : initialSlotAmount,
        receiptNumber: isInitialPaid ? initialReceiptNo : '-',
        paymentMode: (currentRecord as any).paymentMode || 'Cash',
        index: -2,
      });
    }
    
    // Step 2: Show installments separately - each installment keeps its own identity
    // IMPORTANT: Use STORED installment amounts if they exist, don't recalculate
    // This ensures amounts remain fixed even after payments
    if (totalInstallments > 0) {
      // Check if installment amounts are stored in the record
      let hasStoredAmounts = false;
      for (let i = 0; i < totalInstallments && i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
        const storedAmount = Number(currentRecord[INSTALLMENT_AMOUNT_FIELDS[i] as keyof FeeRecord]) || 0;
        if (storedAmount > 0) {
          hasStoredAmounts = true;
          break;
        }
      }
      
      // If no stored amounts, calculate them based on remaining balance
      // Otherwise, use stored amounts (they should never change)
      let installmentAmounts: number[] = [];
      
      if (hasStoredAmounts) {
        for (let i = 0; i < totalInstallments && i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
          const storedAmount = Number(currentRecord[INSTALLMENT_AMOUNT_FIELDS[i] as keyof FeeRecord]) || 0;
          installmentAmounts.push(storedAmount);
        }
      } else {
        // Calculate amounts if not stored (first time)
        const originalBalanceAfterInitial = Math.max(0, discountedFees - initialPaymentAmount);
        const equalAmount = originalBalanceAfterInitial > 0 ? parseFloat((originalBalanceAfterInitial / totalInstallments).toFixed(2)) : 0;
        const totalDistributed = originalBalanceAfterInitial > 0 ? parseFloat((equalAmount * (totalInstallments - 1)).toFixed(2)) : 0;
        const lastAmount = originalBalanceAfterInitial > 0 ? parseFloat((originalBalanceAfterInitial - totalDistributed).toFixed(2)) : 0;
        
        for (let i = 0; i < totalInstallments; i++) {
          installmentAmounts.push(i === totalInstallments - 1 ? lastAmount : equalAmount);
        }
      }
      
      // Display installments with their stored/calculated amounts
      for (let i = 0; i < totalInstallments && i < installmentAmounts.length; i++) {
        const installmentAmount = installmentAmounts[i] || 0;
        const receiptNumber = (currentRecord as any)[INSTALLMENT_RECEIPT_FIELDS[i]] || '-';
        const hasReceipt = receiptNumber && receiptNumber !== '-' && receiptNumber.length > 3;
        const { due: resolvedDue, missing: dueDateMissing } = getResolvedInstallmentDueDate(recordData, i);
        const dueDateObj: Date | string | undefined = resolvedDue ?? undefined;

        // Determine if this installment is paid
        const isPaid = hasReceipt;

        // Check if due date has passed (for overdue indicator - only for unpaid installments)
        let dueDatePassed = false;
        if (!isPaid && resolvedDue) {
          const due = normalizeDueDateLikeFeeDetails(resolvedDue);
          if (due) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            due.setHours(0, 0, 0, 0);
            dueDatePassed = due.getTime() < today.getTime();
          }
        }
        
        const paidAmount = isPaid ? installmentAmount : 0;
        const balance = isPaid ? 0 : installmentAmount;
        const rowPaymentMode = (currentRecord as any)[INSTALLMENT_PAYMENT_MODE_FIELDS[i]] || (currentRecord as any).paymentMode || 'Cash';
        
        installments.push({
          name: `Installment ${i + 1}`,
          amount: installmentAmount,
          dueDate: dueDateObj,
          dueDatePassed,
          dueDateMissing,
          status: isPaid ? 'Paid' : 'Pending',
          paidAmount: paidAmount,
          balance: balance,
          receiptNumber: receiptNumber,
          paymentMode: rowPaymentMode,
          index: i
        });
      }
    }

    return installments;
  };

  const installmentRows = getInstallmentRows().filter(row => row.amount > 0); // Hide ₹0 installments to keep the UI clean

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-y-auto bg-gray-50/50">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{record.studentName}</h2>
                <p className="text-sm text-gray-500">{record.course} | {record.zicaBettercode}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={record.feesBalance === 0 ? "default" : "destructive"} className="px-4 py-1 text-base">
                {record.feesBalance === 0 ? "Fully Paid" : `Balance: ₹${record.feesBalance.toLocaleString()}`}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Personal Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <User className="w-4 h-4" /> Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact:</span>
                  <span className="font-medium">{record.contactNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parent's Contact:</span>
                  <span className="font-medium">{record.parentsContactNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Source:</span>
                  <span className="font-medium">{record.source}</span>
                </div>
              </CardContent>
            </Card>

            {/* Course Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Course Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Course:</span>
                  <span className="font-medium truncate max-w-[150px]" title={record.course}>{record.course}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-medium">{record.courseDuration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Admission Date:</span>
                  <span className="font-medium">{safeRender(record.dateOfAdmission)}</span>
                </div>
                 <div className="flex justify-between">
                  <span className="text-gray-500">Start Date:</span>
                  <span className="font-medium">{safeRender(record.courseStartDate)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Fees:</span>
                  <span className="font-medium">₹{record.actualFees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Discounted:</span>
                  <span className="font-medium">₹{record.discountedFees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Paid:</span>
                  <span>₹{record.feesPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance:</span>
                  <span>₹{record.feesBalance.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Installments Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Fee Installments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Installment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Mode</TableHead>
                      <TableHead className="w-[200px]">Receipt No.</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Paid</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Pending</TableHead>
                      <TableHead className="text-center min-w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installmentRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">₹{row.amount.toLocaleString()}</TableCell>
                        <TableCell className="min-w-[120px]">
                          {row.index >= 0 && editingDueDateRow === row.index ? (
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              defaultValue={formatDateForInput(row.dueDate)}
                              autoFocus
                              onBlur={(e) => handleSaveDueDate(row.index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDueDate(row.index, (e.target as HTMLInputElement).value);
                                if (e.key === 'Escape') setEditingDueDateRow(null);
                              }}
                            />
                          ) : (
                            <div
                              onClick={() => row.index >= 0 && onUpdate && setEditingDueDateRow(row.index)}
                              className={`min-h-[28px] flex items-center gap-1.5 flex-wrap ${row.index >= 0 && onUpdate ? 'cursor-pointer hover:bg-gray-100 rounded px-2 -mx-2 py-1' : ''} ${row.dueDatePassed ? 'text-red-600' : ''}`}
                            >
                              {row.dueDatePassed && (
                                <span className="text-[10px] font-semibold uppercase text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Overdue</span>
                              )}
                              {row.status === 'Pending' && row.dueDateMissing ? (
                                <span className="text-amber-700 text-xs font-semibold bg-amber-100 px-2 py-1 rounded border border-amber-300">Enter Due Date First</span>
                              ) : (
                                <span className={row.dueDatePassed ? 'line-through' : ''}>{safeRender(row.dueDate)}</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              row.status === 'Paid' ? "bg-green-50 text-green-700 border-green-200" : 
                              "bg-red-50 text-red-700 border-red-200"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {row.status === 'Paid' ? ((row as any).paymentMode || '-') : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded text-gray-600 block truncate font-mono" title={row.receiptNumber}>
                            {row.receiptNumber}
                          </code>
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">₹{row.paidAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600 font-medium">₹{row.balance.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              size="sm" 
                              variant={row.status === 'Paid' ? "secondary" : "default"}
                              className={row.status === 'Paid' ? "bg-gray-100 text-gray-500" : "bg-green-600 hover:bg-green-700"}
                              disabled={row.status === 'Paid' || !onUpdate || row.balance === 0 || row.amount === 0 || (row.index >= 0 && !!row.dueDateMissing)}
                              onClick={() => handleStatusChange(row.balance, 'add', row.name, row.index)}
                            >
                              {row.status === 'Paid' ? 'Paid' : 'Mark Paid'}
                            </Button>
                             <Button 
                              size="sm" 
                              variant="outline"
                              disabled={row.status === 'Pending' || !onUpdate}
                              onClick={() => handleStatusChange(row.amount, 'remove', row.name, row.index)}
                            >
                              Unpaid
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              title="Download fee receipt as PDF"
                              disabled={row.status !== 'Paid' || generatingReceipt === row.name}
                              onClick={async () => {
                                const feeId = record.id;
                                let receiptType = '';
                                const amount = row.amount;

                                if (row.index !== undefined && row.index >= 0) {
                                  const installmentNum = (row.index + 1).toString().padStart(2, '0');
                                  receiptType = `installment${installmentNum}`;
                                } else if (row.index === -2) {
                                  receiptType = 'registration';
                                } else {
                                  receiptType = 'onetime';
                                }

                                if (generatingReceipt === row.name) {
                                  return;
                                }

                                try {
                                  setGeneratingReceipt(row.name);
                                  const receiptContext = {
                                    ...(record as Record<string, unknown>),
                                    feesPaidDate: normalizeFeesPaidDate(record),
                                  };
                                  
                                  let receiptNumber = '';
                                  let feeDataForReceipt: Record<string, unknown> = { ...receiptContext };
                                  
                                  if (row.index !== undefined && row.index >= 0) {
                                    const existingReceipt = (record as any)[INSTALLMENT_RECEIPT_FIELDS[row.index]] || '';
                                    
                                    if (isReusableReceiptForRecord(receiptContext, existingReceipt)) {
                                      receiptNumber = existingReceipt;
                                      feeDataForReceipt[INSTALLMENT_RECEIPT_FIELDS[row.index]] = receiptNumber;
                                    } else {
                                      const resolved = await resolveOrGenerateReceiptNumber(db, feeId, receiptType, receiptContext);
                                      receiptNumber = resolved.receiptNumber;
                                      feeDataForReceipt = { ...resolved.feeData };
                                      
                                      if (!isUsableReceiptNumber(receiptNumber)) {
                                        throw new Error('Failed to generate valid receipt number');
                                      }
                                      
                                      const receiptField = INSTALLMENT_RECEIPT_FIELDS[row.index];
                                      
                                      let isDuplicate = false;
                                      for (let i = 0; i < INSTALLMENT_RECEIPT_FIELDS.length; i++) {
                                        if (i !== row.index) {
                                          const otherReceipt = (record as any)[INSTALLMENT_RECEIPT_FIELDS[i]];
                                          if (otherReceipt === receiptNumber) {
                                            isDuplicate = true;
                                            break;
                                          }
                                        }
                                      }
                                      
                                      if (isDuplicate) {
                                        const resolved2 = await resolveOrGenerateReceiptNumber(db, feeId, receiptType, receiptContext);
                                        receiptNumber = resolved2.receiptNumber;
                                        feeDataForReceipt = { ...resolved2.feeData };
                                      }
                                      
                                      await patchFeeRecord(feeId, {
                                        [receiptField]: receiptNumber
                                      });
                                      feeDataForReceipt[receiptField] = receiptNumber;
                                    }
                                  } else if (row.index === -2) {
                                    const existingReceipt = record.registrationReceiptNumber || record.receiptNumber || '';
                                    
                                    if (isReusableReceiptForRecord(receiptContext, existingReceipt)) {
                                      receiptNumber = existingReceipt;
                                    } else {
                                      const resolved = await resolveOrGenerateReceiptNumber(db, feeId, 'registration', receiptContext);
                                      receiptNumber = resolved.receiptNumber;
                                      feeDataForReceipt = { ...resolved.feeData };
                                      await patchFeeRecord(feeId, {
                                        registrationReceiptNumber: receiptNumber,
                                        receiptNumber,
                                      });
                                    }
                                    feeDataForReceipt.registrationReceiptNumber = receiptNumber;
                                    feeDataForReceipt.receiptNumber = receiptNumber;
                                  } else {
                                    if (isReusableReceiptForRecord(receiptContext, row.receiptNumber)) {
                                      receiptNumber = row.receiptNumber;
                                    } else {
                                      const resolved = await resolveOrGenerateReceiptNumber(db, feeId, receiptType, receiptContext);
                                      receiptNumber = resolved.receiptNumber;
                                      feeDataForReceipt = { ...resolved.feeData };
                                    }
                                  }
                                  
                                  if (row.index === -2 && receiptNumber) {
                                    try {
                                      await createGstForPayment(
                                        receiptNumber,
                                        row.amount,
                                        'Initial Payment',
                                        normalizeFeesPaidDate(record)
                                      );
                                    } catch (gstErr) {
                                      console.warn('GST record create on initial receipt:', gstErr);
                                    }
                                  }

                                  if (onUpdate && receiptNumber) {
                                    const updatedRecord = { ...record } as FeeRecord;
                                    if (row.index !== undefined && row.index >= 0) {
                                      (updatedRecord as Record<string, unknown>)[INSTALLMENT_RECEIPT_FIELDS[row.index]] = receiptNumber;
                                      feeDataForReceipt[INSTALLMENT_RECEIPT_FIELDS[row.index]] = receiptNumber;
                                    } else if (row.index === -2) {
                                      updatedRecord.registrationReceiptNumber = receiptNumber;
                                      updatedRecord.receiptNumber = receiptNumber;
                                      if (!updatedRecord.registrationAmount) {
                                        updatedRecord.registrationAmount = row.amount;
                                      }
                                    }
                                    onUpdate(updatedRecord);
                                  }

                                  openReceiptPage(feeId, receiptType, amount, feeDataForReceipt, { autoDownload: true });
                                } catch (error: any) {
                                  console.error('Error generating receipt:', error);
                                  toast({
                                    title: "Generation Error",
                                    description: error?.message || "Failed to generate receipt number. Please try again.",
                                    variant: "destructive"
                                  });
                                } finally {
                                  setGeneratingReceipt(null);
                                }
                              }}
                            >
                              {generatingReceipt === row.name ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4 mr-1" />
                              )}
                              PDF
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
        </div>
      </DialogContent>

      {/* Payment Dialog - Redesigned */}
      <Dialog open={paymentDialog.isOpen} onOpenChange={(open) => !open && setPaymentDialog({ ...paymentDialog, isOpen: false })}>
        <DialogContent className="sm:max-w-[440px] max-h-[90vh] p-0 gap-0 bg-white border-2 border-green-200 shadow-xl rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-b from-green-50 to-white border-b">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Wallet className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">Mark Payment</DialogTitle>
                <p className="text-sm text-gray-500 mt-0.5">Recording payment for <span className="font-semibold text-green-700">{paymentDialog.data?.installmentName}</span></p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 px-6 py-4 overflow-y-auto max-h-[60vh]">
            {paymentDialog.installmentAmount && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-600">Installment Amount</span>
                  <span className="text-lg font-bold text-slate-900">₹{paymentDialog.installmentAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {paymentDialog.data && paymentDialog.data.amount < paymentDialog.installmentAmount
                    ? `Partial: ₹${(paymentDialog.installmentAmount - (paymentDialog.data.amount || 0)).toLocaleString()} will be added to next installment below`
                    : 'Full payment will generate receipt'}
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="feesPaidDate" className="text-sm font-semibold text-gray-700">Fees Paid Date</Label>
              <Input
                id="feesPaidDate"
                type="date"
                value={paymentDialog.data?.feesPaidDate ?? ''}
                onChange={(e) => {
                  const val = e.target.value || undefined;
                  setPaymentDialog(prev => ({
                    ...prev,
                    data: prev.data ? { ...prev.data, feesPaidDate: val } : null
                  }));
                }}
                className="bg-white font-medium text-gray-900 border-gray-200 focus:border-green-500 focus:ring-green-500 h-10"
              />
              <p className="text-xs text-slate-500">This date will appear on the fee receipt.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount" className="text-sm font-semibold text-gray-700">Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={record.discountedFees - record.feesPaid}
                value={paymentDialog.data?.amount ?? ''}
                onChange={(e) => {
                  const enteredAmount = parseFloat(e.target.value) || 0;
                  const maxAllowed = record.discountedFees - record.feesPaid;
                  const finalAmount = Math.min(enteredAmount, maxAllowed);
                  setPaymentDialog(prev => ({
                    ...prev,
                    data: prev.data ? { ...prev.data, amount: finalAmount } : null
                  }))
                }}
                className="pl-8 bg-white font-bold text-gray-900 border-gray-200 focus:border-green-500 focus:ring-green-500 h-10"
                placeholder="Enter payment amount"
                autoFocus
              />
              </div>
              {paymentDialog.data && paymentDialog.data.amount > 0 && (
                <p className="text-xs text-gray-500">
                  Maximum allowed: ₹{(record.discountedFees - record.feesPaid).toLocaleString()}
                </p>
              )}
            </div>

            {(() => {
              const idx = paymentDialog.installmentIndex;
              const dueDate = paymentDialog.installmentDueDate;
              if (idx === undefined || idx < 0 || !dueDate) return null;
              let dueStr = '';
              if (typeof dueDate === 'string') dueStr = dueDate.split('T')[0];
              else if (dueDate instanceof Date) dueStr = dueDate.toISOString().split('T')[0];
              if (!dueStr || !/^\d{4}-\d{2}-\d{2}/.test(dueStr)) return null;
              const parts = dueStr.split('-');
              const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              due.setHours(0, 0, 0, 0);
              const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
              if (daysOverdue <= 0) return null;
              const calculatedLateFees = daysOverdue * 100;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="applyLateFees"
                      checked={paymentDialog.data?.applyLateFees ?? false}
                      onCheckedChange={(checked) =>
                        setPaymentDialog(prev => ({
                          ...prev,
                          data: prev.data ? { ...prev.data, applyLateFees: !!checked } : null
                        }))
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="applyLateFees" className="text-sm font-semibold text-amber-800 cursor-pointer">
                        Apply Late Fees
                      </Label>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Due date passed by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}. Late fee: ₹{calculatedLateFees.toLocaleString()} (₹100/day)
                      </p>
                      {paymentDialog.data?.applyLateFees && (
                        <p className="text-xs font-medium text-amber-800 mt-1">
                          Total with late fees: ₹{((paymentDialog.data?.amount || 0) + calculatedLateFees).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid gap-1.5">
              <Label htmlFor="paymentMode" className="text-sm font-semibold text-gray-700">Payment Mode</Label>
              <Select
                value={paymentDialog.data?.paymentMode || ''}
                onValueChange={(value) => 
                  setPaymentDialog(prev => ({
                    ...prev,
                    data: prev.data ? { ...prev.data, paymentMode: value } : null
                  }))
                }
              >
                <SelectTrigger className="w-full bg-white border-gray-300 focus:ring-green-500 h-9">
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

            {paymentDialog.data?.paymentMode === 'Cheque' && (
              <div className="grid gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="chequeNumber" className="text-sm font-semibold text-gray-700">Cheque Number</Label>
                <Input
                  id="chequeNumber"
                  placeholder="Enter 6-digit cheque number"
                  className="bg-white border-gray-300 focus:border-green-500 focus:ring-green-500 h-9"
                  value={paymentDialog.data?.chequeNumber || ''}
                  onChange={(e) => 
                    setPaymentDialog(prev => ({
                      ...prev,
                      data: prev.data ? { ...prev.data, chequeNumber: e.target.value } : null
                    }))
                  }
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="remarks" className="text-sm font-semibold text-gray-700">Additional Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Optional notes about this payment..."
                className="resize-none min-h-[60px] bg-white border-gray-300 focus:border-green-500 focus:ring-green-500 text-sm"
                value={paymentDialog.data?.remarks || ''}
                onChange={(e) => 
                  setPaymentDialog(prev => ({
                    ...prev,
                    data: prev.data ? { ...prev.data, remarks: e.target.value } : null
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-slate-50/80 border-t flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setPaymentDialog({ ...paymentDialog, isOpen: false })}
              className="flex-1 h-10 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleConfirmPayment}
              disabled={isProcessingPayment}
              className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isProcessingPayment ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
    </>
  );
}
