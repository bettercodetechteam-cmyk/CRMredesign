import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Crown, Percent, Calendar, Wallet, ChevronDown, ChevronRight, User, Banknote, GraduationCap, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/useTableSort";
import { firebaseListenerManager } from '@/lib/firebaseListenerManager';
import Loading from '@/components/ui/loading';

const ROYALTY_PERCENT = 15;
const REDUCTION_PERCENT = 18; // 18% GST — base = amount / 1.18 (same as receipt taxable amount)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Base amount excluding 18% GST — same formula as receipt: amount / 1.18 (used for royalty). */
function baseAfterGst(amount: number): number {
  return Math.round((amount / 1.18) * 100) / 100;
}

/** Remaining amount (18% GST portion) = Amount Paid - Taxable Amount. */
function remainingGst(amount: number): number {
  return Math.round((amount - baseAfterGst(amount)) * 100) / 100;
}

/** Royalty (15%) on taxable amount. */
function royaltyOnTaxable(taxableAmount: number): number {
  return Math.round((taxableAmount * ROYALTY_PERCENT) / 100 * 100) / 100;
}

interface FeeRecord {
  id: string;
  admissionMonth?: string;
  feesPaid?: number;
  discountedFees?: number;
  feesPaidDate?: string | Date | { toDate?: () => Date; seconds?: number };
  updatedAt?: Date | { toDate?: () => Date; seconds?: number };
  zicaBettercode?: string;
  centreId?: string;
  [key: string]: unknown;
}

interface StudentWiseRow {
  record: FeeRecord;
  discountedFees: number;
  taxableAmount: number;
  remainingGstAmount: number;
  royaltyAmount: number;
}

interface MonthRow {
  monthKey: string;
  basicAmount: number;
  remainingGstAmount: number;
  royaltyAmount: number;
  sortKey: number;
}

/** Editable detail row (local only — not saved to Firestore). */
interface DetailRowDisplay {
  id: string;
  studentName: string;
  course: string;
  amountPaid: number;
  taxableAmount: number;
  remainingGst: number;
  royalty: number;
  receiptNo: string;
  isManual?: boolean;
}

type DetailEditField = 'studentName' | 'course' | 'amountPaid' | 'taxableAmount' | 'remainingGst' | 'royalty' | 'receiptNo';

/** Editable student-wise row (local only — not saved to Firestore). */
interface StudentWiseRowDisplay {
  id: string;
  studentName: string;
  course: string;
  discountedFees: number;
  taxableAmount: number;
  remainingGstAmount: number;
  royaltyAmount: number;
  receiptNo: string;
  isManual?: boolean;
}

type StudentWiseEditField = 'studentName' | 'course' | 'discountedFees' | 'taxableAmount' | 'remainingGstAmount' | 'royaltyAmount' | 'receiptNo';

function parseMonthKey(monthKey: string): number {
  const parts = monthKey.trim().split(/\s+/);
  const monthPart = parts[0] || '';
  const yearPart = parts[1] ? parseInt(parts[1], 10) : new Date().getFullYear();
  const monthIndex = MONTH_NAMES.findIndex((m) => m.toLowerCase() === monthPart.toLowerCase());
  const month = monthIndex >= 0 ? monthIndex : 0;
  return yearPart * 12 + month;
}

const RECEIPT_FIELDS = [
  'registrationReceiptNumber', 'receiptNumber', 'fullPaymentReceiptNumber',
  'installment01ReceiptNumber', 'installment02ReceiptNumber', 'installment03ReceiptNumber',
  'installment04ReceiptNumber', 'installment05ReceiptNumber', 'installment06ReceiptNumber',
  'installment07ReceiptNumber', 'installment08ReceiptNumber', 'installment09ReceiptNumber',
  'installment10ReceiptNumber', 'installment11ReceiptNumber', 'installment12ReceiptNumber',
];

/** Get all receipt numbers from a fee record (for display in details). */
function getReceiptNumbers(record: FeeRecord): string {
  const numbers: string[] = [];
  for (const field of RECEIPT_FIELDS) {
    const val = record[field];
    if (typeof val === 'string' && val.trim() && val !== '-') {
      numbers.push(val.trim());
    }
  }
  return [...new Set(numbers)].join(', ') || '—';
}

/** Get payment month key "MonthName YYYY" from fee record (when fees were paid / receipt generated). */
function getPaymentMonthKey(record: FeeRecord): string | null {
  const toDate = (v: unknown): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as any).toDate === 'function') {
      return (v as any).toDate();
    }
    if (typeof v === 'object' && v !== null && 'seconds' in v) {
      return new Date((v as any).seconds * 1000);
    }
    return null;
  };
  const date = toDate(record.feesPaidDate) || toDate(record.updatedAt);
  if (!date) return null;
  const monthName = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${monthName} ${year}`;
}

export default function Royalty() {
  const { userProfile } = useAuth();
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [displayDetailRowsByMonth, setDisplayDetailRowsByMonth] = useState<Record<string, DetailRowDisplay[]>>({});
  const [editingCell, setEditingCell] = useState<{ monthKey: string; rowId: string; field: DetailEditField } | null>(null);
  const [displayStudentWiseRows, setDisplayStudentWiseRows] = useState<StudentWiseRowDisplay[]>([]);
  const [editingStudentCell, setEditingStudentCell] = useState<{ rowId: string; field: StudentWiseEditField } | null>(null);
  const centreId = userProfile?.centreId;

  useEffect(() => {
    if (!centreId) {
      setLoading(false);
      return;
    }
    const unsubFees = firebaseListenerManager.subscribe<FeeRecord>('fees', (data) => {
      setFeeRecords(Array.isArray(data) ? data : []);
    }, { limit: 500, centreId });

    setLoading(false);
    return () => {
      unsubFees();
    };
  }, [centreId]);

  const monthWiseData = useMemo((): MonthRow[] => {
    const byMonth: Record<string, { basic: number; remaining: number; royalty: number }> = {};
    for (const [monthKey, rows] of Object.entries(displayDetailRowsByMonth)) {
      if (!rows.length) continue;
      const basic = rows.reduce((s, r) => s + r.taxableAmount, 0);
      const remaining = rows.reduce((s, r) => s + (r.remainingGst ?? 0), 0);
      const royalty = rows.reduce((s, r) => s + royaltyOnTaxable(r.taxableAmount), 0);
      byMonth[monthKey] = { basic, remaining, royalty };
    }
    const zicaOnly = feeRecords.filter(
      (r) => r.zicaBettercode === 'ZICA' || r.zicaBettercode === 'Zica'
    );
    for (const r of zicaOnly) {
      const paid = Number(r.feesPaid) || 0;
      if (paid <= 0) continue;
      const monthKey = getPaymentMonthKey(r);
      if (!monthKey) continue;
      if (byMonth[monthKey] != null) continue;
      const basic = baseAfterGst(paid);
      const remaining = remainingGst(paid);
      const royalty = royaltyOnTaxable(basic);
      byMonth[monthKey] = { basic, remaining, royalty };
    }
    const rows: MonthRow[] = [];
    for (const [monthKey, { basic, remaining, royalty }] of Object.entries(byMonth)) {
      rows.push({
        monthKey,
        basicAmount: basic,
        remainingGstAmount: remaining,
        royaltyAmount: royalty,
        sortKey: parseMonthKey(monthKey),
      });
    }
    rows.sort((a, b) => b.sortKey - a.sortKey);
    return rows;
  }, [feeRecords, displayDetailRowsByMonth]);

  const totalBasic = monthWiseData.reduce((s, r) => s + r.basicAmount, 0);
  const totalRemainingGst = monthWiseData.reduce((s, r) => s + r.remainingGstAmount, 0);
  const totalRoyalty = monthWiseData.reduce((s, r) => s + r.royaltyAmount, 0);

  const monthDetailsRecords = useMemo((): FeeRecord[] => {
    if (!selectedMonthKey) return [];
    return feeRecords
      .filter(
        (r) =>
          (r.zicaBettercode === 'ZICA' || r.zicaBettercode === 'Zica') &&
          getPaymentMonthKey(r) === selectedMonthKey &&
          (Number(r.feesPaid) || 0) > 0
      )
      .sort((a, b) => (Number(b.feesPaid) || 0) - (Number(a.feesPaid) || 0));
  }, [feeRecords, selectedMonthKey]);

  const toggleMonth = (monthKey: string) => {
    setSelectedMonthKey((prev) => (prev === monthKey ? null : monthKey));
  };

  const feeRecordsToDetailRows = (records: FeeRecord[]): DetailRowDisplay[] =>
    records.map((r) => {
      const amountPaid = Number(r.feesPaid) || 0;
      const taxableAmount = baseAfterGst(amountPaid);
      const remainingGstAmount = remainingGst(amountPaid);
      const royalty = royaltyOnTaxable(taxableAmount);
      return {
        id: r.id,
        studentName: (r.studentName as string) || '',
        course: (r.course as string) || '',
        amountPaid,
        taxableAmount,
        remainingGst: remainingGstAmount,
        royalty,
        receiptNo: getReceiptNumbers(r),
        isManual: false,
      };
    });

  useEffect(() => {
    if (!selectedMonthKey) return;
    setDisplayDetailRowsByMonth((prev) => {
      if (prev[selectedMonthKey] != null) return prev;
      if (monthDetailsRecords.length === 0) return prev;
      return { ...prev, [selectedMonthKey]: feeRecordsToDetailRows(monthDetailsRecords) };
    });
  }, [selectedMonthKey, monthDetailsRecords]);

  const displayRowsForSelectedMonth = (): DetailRowDisplay[] => {
    if (!selectedMonthKey) return [];
    const local = displayDetailRowsByMonth[selectedMonthKey];
    if (local != null && local.length >= 0) return local;
    return feeRecordsToDetailRows(monthDetailsRecords);
  };

  const updateDetailRow = (monthKey: string, rowId: string, field: DetailEditField, value: string | number) => {
    setDisplayDetailRowsByMonth((prev) => {
      const rows = prev[monthKey] ?? [];
      const next = rows.map((row) => {
        if (row.id !== rowId) return row;
        const num = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        if (field === 'amountPaid') {
          const taxable = baseAfterGst(num);
          const remaining = remainingGst(num);
          const royalty = royaltyOnTaxable(taxable);
          return { ...row, amountPaid: num, taxableAmount: taxable, remainingGst: remaining, royalty };
        }
        if (field === 'taxableAmount') {
          const royalty = royaltyOnTaxable(num);
          return { ...row, taxableAmount: num, royalty };
        }
        if (field === 'remainingGst') return { ...row, remainingGst: num };
        if (field === 'royalty') return { ...row, royalty: num };
        if (field === 'studentName') return { ...row, studentName: String(value) };
        if (field === 'course') return { ...row, course: String(value) };
        if (field === 'receiptNo') return { ...row, receiptNo: String(value) };
        return row;
      });
      return { ...prev, [monthKey]: next };
    });
    setEditingCell(null);
  };

  const addManualEntry = () => {
    if (!selectedMonthKey) return;
    const newRow: DetailRowDisplay = {
      id: `manual-${Date.now()}`,
      studentName: '',
      course: '',
      amountPaid: 0,
      taxableAmount: 0,
      remainingGst: 0,
      royalty: 0,
      receiptNo: '',
      isManual: true,
    };
    setDisplayDetailRowsByMonth((prev) => ({
      ...prev,
      [selectedMonthKey]: [...(prev[selectedMonthKey] ?? []), newRow],
    }));
  };

  const removeDetailRow = (monthKey: string, rowId: string) => {
    setDisplayDetailRowsByMonth((prev) => {
      const rows = (prev[monthKey] ?? []).filter((r) => r.id !== rowId);
      return { ...prev, [monthKey]: rows };
    });
    if (editingCell?.rowId === rowId) setEditingCell(null);
  };

  const displayRows = displayRowsForSelectedMonth();

  const { sortedData: sortedMonthWiseData, requestSort, sortConfig } = useTableSort(monthWiseData);
  const { sortedData: sortedDisplayRows, requestSort: requestSortDetails, sortConfig: sortConfigDetails } = useTableSort(displayRows);

  const studentWiseRoyaltyData = useMemo((): StudentWiseRow[] => {
    const zicaOnly = feeRecords.filter(
      (r) => r.zicaBettercode === 'ZICA' || r.zicaBettercode === 'Zica'
    );
    return zicaOnly
      .map((record) => {
        const discountedFees = Number(record.discountedFees) || 0;
        const taxableAmount = baseAfterGst(discountedFees);
        const remainingGstAmount = remainingGst(discountedFees);
        const royaltyAmount = royaltyOnTaxable(taxableAmount);
        return { record, discountedFees, taxableAmount, remainingGstAmount, royaltyAmount };
      })
      .filter((row) => row.discountedFees > 0)
      .sort((a, b) => ((a.record.studentName as string) || '').localeCompare((b.record.studentName as string) || ''));
  }, [feeRecords]);

  const studentWiseToDisplay = (rows: StudentWiseRow[]): StudentWiseRowDisplay[] =>
    rows.map((r) => ({
      id: r.record.id,
      studentName: (r.record.studentName as string) || '',
      course: (r.record.course as string) || '',
      discountedFees: r.discountedFees,
      taxableAmount: r.taxableAmount,
      remainingGstAmount: r.remainingGstAmount,
      royaltyAmount: r.royaltyAmount,
      receiptNo: getReceiptNumbers(r.record),
      isManual: false,
    }));

  useEffect(() => {
    if (displayStudentWiseRows.length > 0) return;
    if (studentWiseRoyaltyData.length === 0) return;
    setDisplayStudentWiseRows(studentWiseToDisplay(studentWiseRoyaltyData));
  }, [studentWiseRoyaltyData]);

  const studentWiseRowsForTable = displayStudentWiseRows.length > 0 ? displayStudentWiseRows : studentWiseToDisplay(studentWiseRoyaltyData);
  const { sortedData: sortedStudentWiseRows, requestSort: requestSortStudent, sortConfig: sortConfigStudent } = useTableSort(studentWiseRowsForTable);

  const updateStudentWiseRow = (rowId: string, field: StudentWiseEditField, value: string | number) => {
    setDisplayStudentWiseRows((prev) => {
      if (prev.length === 0) return prev;
      const num = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      return prev.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'discountedFees') {
          const taxable = baseAfterGst(num);
          const remaining = remainingGst(num);
          const royalty = royaltyOnTaxable(taxable);
          return { ...row, discountedFees: num, taxableAmount: taxable, remainingGstAmount: remaining, royaltyAmount: royalty };
        }
        if (field === 'taxableAmount') {
          const royalty = royaltyOnTaxable(num);
          return { ...row, taxableAmount: num, royaltyAmount: royalty };
        }
        if (field === 'remainingGstAmount') return { ...row, remainingGstAmount: num };
        if (field === 'royaltyAmount') return { ...row, royaltyAmount: num };
        if (field === 'studentName') return { ...row, studentName: String(value) };
        if (field === 'course') return { ...row, course: String(value) };
        if (field === 'receiptNo') return { ...row, receiptNo: String(value) };
        return row;
      });
    });
    setEditingStudentCell(null);
  };

  const addManualStudentWiseEntry = () => {
    const newRow: StudentWiseRowDisplay = {
      id: `manual-${Date.now()}`,
      studentName: '',
      course: '',
      discountedFees: 0,
      taxableAmount: 0,
      remainingGstAmount: 0,
      royaltyAmount: 0,
      receiptNo: '',
      isManual: true,
    };
    setDisplayStudentWiseRows((prev) => (prev.length === 0 ? studentWiseToDisplay(studentWiseRoyaltyData) : prev).concat(newRow));
  };

  const removeStudentWiseRow = (rowId: string) => {
    setDisplayStudentWiseRows((prev) => prev.filter((r) => r.id !== rowId));
    if (editingStudentCell?.rowId === rowId) setEditingStudentCell(null);
  };

  const studentWiseTotals = useMemo(() => {
    const rows = displayStudentWiseRows.length > 0 ? displayStudentWiseRows : studentWiseToDisplay(studentWiseRoyaltyData);
    const discounted = rows.reduce((s, r) => s + r.discountedFees, 0);
    const taxable = rows.reduce((s, r) => s + r.taxableAmount, 0);
    const remaining = rows.reduce((s, r) => s + r.remainingGstAmount, 0);
    const royalty = rows.reduce((s, r) => s + r.royaltyAmount, 0);
    return { discounted, taxable, remaining, royalty };
  }, [displayStudentWiseRows, studentWiseRoyaltyData]);

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Please sign in to view Royalty.</p>
      </div>
    );
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm mb-6">
        <div className="max-w-10xl mx-auto px-4 sm:px-6 py-4 lg:py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-xl shadow-md">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Royalty</h1>
              <p className="text-sm text-slate-500">Month-wise Zica: base = amount ÷ 1.18 (same as receipt), then {ROYALTY_PERCENT}% royalty on that base.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-10xl mx-auto px-4 sm:px-6 pb-8 space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-600 mb-3">Total (all months)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-slate-200/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Base (excl. {REDUCTION_PERCENT}% GST)</p>
                    <p className="text-xl font-bold text-slate-900">₹{totalBasic.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <Wallet className="w-8 h-8 text-slate-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Remaining (GST {REDUCTION_PERCENT}%)</p>
                    <p className="text-xl font-bold text-amber-600">₹{totalRemainingGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <Percent className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Royalty ({ROYALTY_PERCENT}%)</p>
                    <p className="text-xl font-bold text-amber-700">₹{totalRoyalty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <Banknote className="w-8 h-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-600 mb-3">Month-wise (cards)</p>
          {monthWiseData.length === 0 ? (
            <Card className="border border-slate-200/60 shadow-sm">
              <CardContent className="p-4 text-center text-slate-500 text-sm">
                No month-wise data. Add fee records with Zica students and Amount Paid.
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Last 3 months</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {(monthWiseData.slice(0, 3)).map((row) => (
                  <Card key={row.monthKey} className="border border-slate-200/60 shadow-sm min-w-0">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{row.monthKey}</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Base</span>
                          <span className="font-medium text-slate-900">₹{row.basicAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">GST ({REDUCTION_PERCENT}%)</span>
                          <span className="font-medium text-amber-600">₹{row.remainingGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Royalty ({ROYALTY_PERCENT}%)</span>
                          <span className="font-medium text-amber-700">₹{row.royaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {monthWiseData.length > 3 && (
                <>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Older months (scroll)</p>
                  <div className="overflow-x-auto pb-2 -mx-1">
                    <div className="flex gap-4 min-w-max px-1">
                      {monthWiseData.slice(3).map((row) => (
                        <Card key={row.monthKey} className="border border-slate-200/60 shadow-sm flex-shrink-0 w-[280px]">
                          <CardContent className="p-4">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{row.monthKey}</p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Base</span>
                                <span className="font-medium text-slate-900">₹{row.basicAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">GST ({REDUCTION_PERCENT}%)</span>
                                <span className="font-medium text-amber-600">₹{row.remainingGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Royalty ({ROYALTY_PERCENT}%)</span>
                                <span className="font-medium text-amber-700">₹{row.royaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Month-wise Royalty (Zica entries only)
            </CardTitle>
            <CardDescription>
              Base = amount paid ÷ 1.18 (same as receipt taxable amount). Royalty = {ROYALTY_PERCENT}% of that base. Expand a month and click any cell to edit; add manual entries with the button. All edits are local to this page only (not saved).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <SortableTableHead className="font-semibold text-slate-700" sortConfig={sortConfig} sortKey="monthKey" requestSort={requestSort}>Month</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfig} sortKey="basicAmount" requestSort={requestSort}>Base (excl. {REDUCTION_PERCENT}% GST) (₹)</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfig} sortKey="remainingGstAmount" requestSort={requestSort}>Remaining (GST {REDUCTION_PERCENT}%) (₹)</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfig} sortKey="royaltyAmount" requestSort={requestSort}>Royalty ({ROYALTY_PERCENT}%)</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMonthWiseData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                        No Zica fee entries found for any month. Add fee records with Zica students and Amount Paid to see royalty here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMonthWiseData.map((row) => (
                      <React.Fragment key={row.monthKey}>
                        <TableRow
                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleMonth(row.monthKey)}
                        >
                          <TableCell className="font-medium">
                            <span className="inline-flex items-center gap-1">
                              {selectedMonthKey === row.monthKey ? (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              )}
                              {row.monthKey}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">₹{row.basicAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right text-amber-600 font-medium">₹{row.remainingGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right text-amber-600 font-medium">₹{row.royaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                        {selectedMonthKey === row.monthKey && (
                          <TableRow>
                            <TableCell colSpan={4} className="p-0 align-top bg-amber-50/40 border-b border-slate-200">
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <User className="w-4 h-4 text-amber-600" />
                                  <span className="font-medium text-slate-800">Details — {row.monthKey} (paid wise)</span>
                                </div>
                                <p className="text-xs text-slate-500 mb-3">Click a cell to edit. Changes are local to this page only (not saved to server). Taxable = Amount Paid ÷ 1.18; Remaining = GST ({REDUCTION_PERCENT}%).</p>
                                <div className="flex justify-end mb-2">
                                  <Button type="button" variant="outline" size="sm" onClick={addManualEntry} className="gap-1">
                                    <Plus className="w-4 h-4" /> Add manual entry
                                  </Button>
                                </div>
                                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-slate-50">
                                        <SortableTableHead className="font-semibold text-slate-700 w-10" sortConfig={sortConfigDetails} sortKey="no" requestSort={requestSortDetails}>#</SortableTableHead>
                                        <SortableTableHead className="font-semibold text-slate-700" sortConfig={sortConfigDetails} sortKey="studentName" requestSort={requestSortDetails}>Student Name</SortableTableHead>
                                        <SortableTableHead className="font-semibold text-slate-700" sortConfig={sortConfigDetails} sortKey="course" requestSort={requestSortDetails}>Course</SortableTableHead>
                                        <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigDetails} sortKey="amountPaid" requestSort={requestSortDetails}>Amount Paid (₹)</SortableTableHead>
                                        <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigDetails} sortKey="taxableAmount" requestSort={requestSortDetails}>Taxable Amount (₹)</SortableTableHead>
                                        <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigDetails} sortKey="remainingGst" requestSort={requestSortDetails}>Remaining (GST {REDUCTION_PERCENT}%) (₹)</SortableTableHead>
                                        <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigDetails} sortKey="royalty" requestSort={requestSortDetails}>Royalty ({ROYALTY_PERCENT}%) (₹)</SortableTableHead>
                                        <SortableTableHead className="font-semibold text-slate-700" sortConfig={sortConfigDetails} sortKey="receiptNo" requestSort={requestSortDetails}>Receipt No.</SortableTableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sortedDisplayRows.length === 0 ? (
                                        <TableRow>
                                          <TableCell colSpan={8} className="text-center text-slate-500 py-4">
                                            No entries. Add fee records or use &quot;Add manual entry&quot;.
                                          </TableCell>
                                        </TableRow>
                                      ) : (
                                        sortedDisplayRows.map((row, index) => {
                                          const monthKey = selectedMonthKey!;
                                          return (
                                            <TableRow key={row.id} className={row.isManual ? 'bg-slate-50/50' : ''}>
                                              <TableCell className="text-slate-500">{index + 1}</TableCell>
                                              <TableCell className="font-medium" onClick={() => setEditingCell({ monthKey, rowId: row.id, field: 'studentName' })}>
                                                {editingCell?.rowId === row.id && editingCell?.field === 'studentName' ? (
                                                  <Input className="h-8 w-full" value={row.studentName} onChange={(e) => updateDetailRow(monthKey, row.id, 'studentName', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} autoFocus />
                                                ) : (
                                                  <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] block">{row.studentName || '—'}</span>
                                                )}
                                              </TableCell>
                                              <TableCell onClick={() => setEditingCell({ monthKey, rowId: row.id, field: 'course' })}>
                                                {editingCell?.rowId === row.id && editingCell?.field === 'course' ? (
                                                  <Input className="h-8 w-full" value={row.course} onChange={(e) => updateDetailRow(monthKey, row.id, 'course', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} autoFocus />
                                                ) : (
                                                  <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] block">{row.course || '—'}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-emerald-600" onClick={() => setEditingCell({ monthKey, rowId: row.id, field: 'amountPaid' })}>
                                                {editingCell?.rowId === row.id && editingCell?.field === 'amountPaid' ? (
                                                  <Input type="number" className="h-8 w-24 text-right" value={row.amountPaid === 0 ? '' : row.amountPaid} onChange={(e) => updateDetailRow(monthKey, row.id, 'amountPaid', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} autoFocus />
                                                ) : (
                                                  <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-slate-700" onClick={() => setEditingCell({ monthKey, rowId: row.id, field: 'taxableAmount' })}>
                                                {editingCell?.rowId === row.id && editingCell?.field === 'taxableAmount' ? (
                                                  <Input type="number" className="h-8 w-24 text-right" value={row.taxableAmount === 0 ? '' : row.taxableAmount} onChange={(e) => updateDetailRow(monthKey, row.id, 'taxableAmount', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} autoFocus />
                                                ) : (
                                                  <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-amber-600" onClick={() => setEditingCell({ monthKey, rowId: row.id, field: 'remainingGst' })}>
                                                {editingCell?.rowId === row.id && editingCell?.field === 'remainingGst' ? (
                                                  <Input type="number" className="h-8 w-24 text-right" value={row.remainingGst === 0 ? '' : (row.remainingGst ?? '')} onChange={(e) => updateDetailRow(monthKey, row.id, 'remainingGst', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} autoFocus />
                                                ) : (
                                                  <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.remainingGst ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-amber-700" onClick={() => setEditingCell({ monthKey, rowId: row.id, field: 'royalty' })}>
                                                {editingCell?.rowId === row.id && editingCell?.field === 'royalty' ? (
                                                  <Input type="number" className="h-8 w-24 text-right" value={row.royalty === 0 ? '' : row.royalty} onChange={(e) => updateDetailRow(monthKey, row.id, 'royalty', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} autoFocus />
                                                ) : (
                                                  <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.royalty ?? royaltyOnTaxable(row.taxableAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-slate-600 font-mono text-xs" onClick={() => setEditingCell({ monthKey, rowId: row.id, field: 'receiptNo' })}>
                                                {editingCell?.rowId === row.id && editingCell?.field === 'receiptNo' ? (
                                                  <Input className="h-8 w-full" value={row.receiptNo} onChange={(e) => updateDetailRow(monthKey, row.id, 'receiptNo', e.target.value)} onBlur={() => setEditingCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)} autoFocus />
                                                ) : (
                                                  <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] block">{row.receiptNo || '—'}</span>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                                {displayRows.length > 0 && (
                                  <p className="text-sm text-slate-500 mt-3 flex items-center gap-1">
                                    <Banknote className="w-4 h-4" />
                                    Total paid: ₹{displayRows.reduce((s, r) => s + (r.amountPaid || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → Taxable Amount: ₹{displayRows.reduce((s, r) => s + (r.taxableAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → Remaining (GST): ₹{displayRows.reduce((s, r) => s + (r.remainingGst ?? 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → Royalty ({ROYALTY_PERCENT}%): ₹{displayRows.reduce((s, r) => s + (r.royalty ?? royaltyOnTaxable(r.taxableAmount || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({displayRows.length} entries, local only)
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Student-wise Royalty (Zica only)
            </CardTitle>
            <CardDescription>
              Per student: Basic Amount → Taxable Amount (÷ 1.18) → Remaining (GST {REDUCTION_PERCENT}%) → Royalty ({ROYALTY_PERCENT}% of taxable). Click a cell to edit; add manual entries with the button. All edits are local to this page only (not saved).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-2">
              <Button type="button" variant="outline" size="sm" onClick={addManualStudentWiseEntry} className="gap-1">
                <Plus className="w-4 h-4" /> Add manual entry
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <SortableTableHead className="font-semibold text-slate-700 w-10" sortConfig={sortConfigStudent} sortKey="no" requestSort={requestSortStudent}>#</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700" sortConfig={sortConfigStudent} sortKey="studentName" requestSort={requestSortStudent}>Student Name</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700" sortConfig={sortConfigStudent} sortKey="course" requestSort={requestSortStudent}>Course</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigStudent} sortKey="discountedFees" requestSort={requestSortStudent}>Basic Amount (₹)</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigStudent} sortKey="taxableAmount" requestSort={requestSortStudent}>Taxable Amount (₹)</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigStudent} sortKey="remainingGstAmount" requestSort={requestSortStudent}>Remaining (GST {REDUCTION_PERCENT}%) (₹)</SortableTableHead>
                    <SortableTableHead className="font-semibold text-slate-700 text-right" sortConfig={sortConfigStudent} sortKey="royaltyAmount" requestSort={requestSortStudent}>Royalty ({ROYALTY_PERCENT}%) (₹)</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudentWiseRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                        No Zica fee entries with discounted fees found. Use &quot;Add manual entry&quot; to add a row.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedStudentWiseRows.map((row, index) => (
                      <TableRow key={row.id} className={row.isManual ? 'bg-slate-50/50' : ''}>
                        <TableCell className="text-slate-500">{index + 1}</TableCell>
                        <TableCell className="font-medium" onClick={() => setEditingStudentCell({ rowId: row.id, field: 'studentName' })}>
                          {editingStudentCell?.rowId === row.id && editingStudentCell?.field === 'studentName' ? (
                            <Input className="h-8 w-full" value={row.studentName} onChange={(e) => updateStudentWiseRow(row.id, 'studentName', e.target.value)} onBlur={() => setEditingStudentCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStudentCell(null)} autoFocus />
                          ) : (
                            <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] block">{row.studentName || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => setEditingStudentCell({ rowId: row.id, field: 'course' })}>
                          {editingStudentCell?.rowId === row.id && editingStudentCell?.field === 'course' ? (
                            <Input className="h-8 w-full" value={row.course} onChange={(e) => updateStudentWiseRow(row.id, 'course', e.target.value)} onBlur={() => setEditingStudentCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStudentCell(null)} autoFocus />
                          ) : (
                            <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] block">{row.course || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-800" onClick={() => setEditingStudentCell({ rowId: row.id, field: 'discountedFees' })}>
                          {editingStudentCell?.rowId === row.id && editingStudentCell?.field === 'discountedFees' ? (
                            <Input type="number" className="h-8 w-24 text-right" value={row.discountedFees === 0 ? '' : row.discountedFees} onChange={(e) => updateStudentWiseRow(row.id, 'discountedFees', e.target.value)} onBlur={() => setEditingStudentCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStudentCell(null)} autoFocus />
                          ) : (
                            <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.discountedFees || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700" onClick={() => setEditingStudentCell({ rowId: row.id, field: 'taxableAmount' })}>
                          {editingStudentCell?.rowId === row.id && editingStudentCell?.field === 'taxableAmount' ? (
                            <Input type="number" className="h-8 w-24 text-right" value={row.taxableAmount === 0 ? '' : row.taxableAmount} onChange={(e) => updateStudentWiseRow(row.id, 'taxableAmount', e.target.value)} onBlur={() => setEditingStudentCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStudentCell(null)} autoFocus />
                          ) : (
                            <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-amber-600" onClick={() => setEditingStudentCell({ rowId: row.id, field: 'remainingGstAmount' })}>
                          {editingStudentCell?.rowId === row.id && editingStudentCell?.field === 'remainingGstAmount' ? (
                            <Input type="number" className="h-8 w-24 text-right" value={row.remainingGstAmount === 0 ? '' : row.remainingGstAmount} onChange={(e) => updateStudentWiseRow(row.id, 'remainingGstAmount', e.target.value)} onBlur={() => setEditingStudentCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStudentCell(null)} autoFocus />
                          ) : (
                            <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.remainingGstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-amber-700" onClick={() => setEditingStudentCell({ rowId: row.id, field: 'royaltyAmount' })}>
                          {editingStudentCell?.rowId === row.id && editingStudentCell?.field === 'royaltyAmount' ? (
                            <Input type="number" className="h-8 w-24 text-right" value={row.royaltyAmount === 0 ? '' : row.royaltyAmount} onChange={(e) => updateStudentWiseRow(row.id, 'royaltyAmount', e.target.value)} onBlur={() => setEditingStudentCell(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStudentCell(null)} autoFocus />
                          ) : (
                            <span className="cursor-pointer hover:bg-slate-100 rounded px-1 min-h-[24px] inline-block">₹{(row.royaltyAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {studentWiseRowsForTable.length > 0 && (
              <p className="text-sm text-slate-500 mt-3 flex items-center gap-1">
                <Banknote className="w-4 h-4" />
                Total Basic Amount: ₹{studentWiseTotals.discounted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → Taxable Amount: ₹{studentWiseTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → Remaining (GST): ₹{studentWiseTotals.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → Royalty: ₹{studentWiseTotals.royalty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({studentWiseRowsForTable.length} students{displayStudentWiseRows.length > 0 ? ', local only' : ''})
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
