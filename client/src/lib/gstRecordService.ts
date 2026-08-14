import type { Firestore } from 'firebase/firestore';

import {
  createGstRecord,
  deleteGstRecord,
  listGstRecords,
} from '@/lib/crmRecordsStore';
import { isPostgresPrimary } from '@/lib/nestApi';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

const GST_RATE = 0.18;

/** In-memory locks survive re-renders and block StrictMode double-invoke races. */
const creationLocks = new Set<string>();

export interface GstRecordPayload {
  id?: string;
  date: string;
  partyName: string;
  totalInvoice: number;
  basicAmount: number;
  gst: number;
  invoiceNumbers: string[];
  hsn: string;
  b2bB2c: 'B2B' | 'B2C';
  companyName: string;
  month: string;
  year: number;
  studentId: string;
  installmentType: string;
  uniqueKey: string;
  centreId: string;
  createdAt: ReturnType<typeof Timestamp.now>;
  updatedAt: ReturnType<typeof Timestamp.now>;
}

export interface CreateGstRecordParams {
  studentId: string;
  partyName: string;
  receiptNumber: string;
  totalAmount: number;
  installmentType: string;
  feesPaidDate?: string | Date;
  companyName: string;
  centreId: string;
}

export interface CreateGstRecordResult {
  created: boolean;
  record?: GstRecordPayload & { id: string };
  skippedReason?: 'invalid-receipt' | 'in-progress' | 'duplicate';
}

export function buildGstUniqueKey(studentId: string, receiptNumber: string): string {
  return `${studentId}-${receiptNumber}`;
}

/**
 * Legacy auto-GST format (REMOVED — must never be generated again):
 * Z + YYMMDD + last-6-digits-of-timestamp + 4-digit-random  →  e.g. Z2605152000002422
 */
export function isLegacyRandomGstInvoiceNumber(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^ZICAPCMC/i.test(v)) return false;
  // Old pattern: Z + exactly 16 digits (17 chars total)
  if (/^Z\d{16}$/.test(v)) return true;
  // Any other over-long Z-prefixed numeric invoice (not ZYYMMDD### = 10 chars)
  if (/^Z\d+$/.test(v) && v.length > 10) return true;
  return false;
}

/** Allowed invoice/receipt numbers for GST records. */
export function isValidReceiptOrInvoiceNumber(value: string): boolean {
  const v = value.trim();
  if (!v || v === '-' || v.length < 3) return false;
  if (isLegacyRandomGstInvoiceNumber(v)) return false;
  if (/^BTC\d{3,}$/i.test(v)) return true;
  if (/^Z\d{6}\d{3}$/.test(v)) return true;
  if (/^ZICAPCMC/i.test(v)) return true;
  return false;
}

export function calculateGstFromTotal(totalAmount: number): { basicAmount: number; gst: number; total: number } {
  const basicAmount = parseFloat((totalAmount / (1 + GST_RATE)).toFixed(2));
  const gst = parseFloat((totalAmount - basicAmount).toFixed(2));
  return { basicAmount, gst, total: totalAmount };
}

function resolveGstDate(feesPaidDate?: string | Date): Date {
  if (!feesPaidDate) return new Date();

  if (typeof feesPaidDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(feesPaidDate)) {
    const parsed = new Date(feesPaidDate.split('T')[0]);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  if (feesPaidDate instanceof Date) {
    return isNaN(feesPaidDate.getTime()) ? new Date() : feesPaidDate;
  }

  const parsed = new Date(feesPaidDate);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Create a GST record only when no record exists for this student + receipt number.
 * Safe against double-clicks, StrictMode, and Mark Paid + Receipt button races.
 */
export async function createGstRecordIfNotExists(
  db: Firestore,
  params: CreateGstRecordParams
): Promise<CreateGstRecordResult> {
  const receiptNumber = params.receiptNumber?.trim();
  if (!receiptNumber || !isValidReceiptOrInvoiceNumber(receiptNumber)) {
    return { created: false, skippedReason: 'invalid-receipt' };
  }

  const studentId = params.studentId?.trim();
  if (!studentId) {
    return { created: false, skippedReason: 'invalid-receipt' };
  }

  const uniqueKey = buildGstUniqueKey(studentId, receiptNumber);
  if (creationLocks.has(uniqueKey)) {
    return { created: false, skippedReason: 'in-progress' };
  }

  creationLocks.add(uniqueKey);
  try {
    if (isPostgresPrimary()) {
      const existing = await listGstRecords(params.centreId);
      const duplicate = existing.some(
        (row) =>
          row.uniqueKey === uniqueKey ||
          (Array.isArray(row.invoiceNumbers) &&
            row.invoiceNumbers.includes(receiptNumber)),
      );
      if (duplicate) {
        return { created: false, skippedReason: 'duplicate' };
      }

      const gstDate = resolveGstDate(params.feesPaidDate);
      const dateStr = `${gstDate.getFullYear()}-${String(gstDate.getMonth() + 1).padStart(2, '0')}-${String(gstDate.getDate()).padStart(2, '0')}`;
      const { basicAmount, gst, total } = calculateGstFromTotal(params.totalAmount);

      const gstRecord: Omit<GstRecordPayload, 'id'> = {
        date: dateStr,
        partyName: params.partyName,
        totalInvoice: total,
        basicAmount,
        gst,
        invoiceNumbers: [receiptNumber],
        hsn: '9983',
        b2bB2c: 'B2C',
        companyName: params.companyName,
        month: gstDate.toLocaleString('default', { month: 'long' }).toUpperCase(),
        year: gstDate.getFullYear(),
        studentId,
        installmentType: params.installmentType,
        uniqueKey,
        centreId: params.centreId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const created = await createGstRecord(gstRecord as unknown as Record<string, unknown>);
      return {
        created: true,
        record: { ...(gstRecord as GstRecordPayload), id: String(created.id) },
      };
    }

    const uniqueKeyQuery = query(
      collection(db, 'gstRecords'),
      where('uniqueKey', '==', uniqueKey),
      limit(1)
    );
    const uniqueKeySnap = await getDocs(uniqueKeyQuery);
    if (!uniqueKeySnap.empty) {
      return { created: false, skippedReason: 'duplicate' };
    }

    const receiptQuery = query(
      collection(db, 'gstRecords'),
      where('invoiceNumbers', 'array-contains', receiptNumber),
      limit(1)
    );
    const receiptSnap = await getDocs(receiptQuery);
    if (!receiptSnap.empty) {
      return { created: false, skippedReason: 'duplicate' };
    }

    const gstDate = resolveGstDate(params.feesPaidDate);
    const dateStr = `${gstDate.getFullYear()}-${String(gstDate.getMonth() + 1).padStart(2, '0')}-${String(gstDate.getDate()).padStart(2, '0')}`;
    const { basicAmount, gst, total } = calculateGstFromTotal(params.totalAmount);

    const gstRecord: Omit<GstRecordPayload, 'id'> = {
      date: dateStr,
      partyName: params.partyName,
      totalInvoice: total,
      basicAmount,
      gst,
      invoiceNumbers: [receiptNumber],
      hsn: '9983',
      b2bB2c: 'B2C',
      companyName: params.companyName,
      month: gstDate.toLocaleString('default', { month: 'long' }).toUpperCase(),
      year: gstDate.getFullYear(),
      studentId,
      installmentType: params.installmentType,
      uniqueKey,
      centreId: params.centreId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'gstRecords'), gstRecord);
    return {
      created: true,
      record: { ...gstRecord, id: docRef.id },
    };
  } finally {
    creationLocks.delete(uniqueKey);
  }
}

export interface DeleteGstRecordResult {
  deletedIds: string[];
}

/**
 * Remove GST record(s) tied to a receipt number when a payment is marked unpaid.
 * Matches by uniqueKey and invoiceNumbers array-contains.
 */
export async function deleteGstRecordByReceipt(
  db: Firestore,
  studentId: string,
  receiptNumber: string
): Promise<DeleteGstRecordResult> {
  const trimmedStudentId = studentId?.trim();
  const trimmedReceipt = receiptNumber?.trim();
  if (!trimmedStudentId || !trimmedReceipt || !isValidReceiptOrInvoiceNumber(trimmedReceipt)) {
    return { deletedIds: [] };
  }

  if (isPostgresPrimary()) {
    const existing = await listGstRecords();
    const uniqueKey = buildGstUniqueKey(trimmedStudentId, trimmedReceipt);
    const matches = existing.filter(
      (row) =>
        row.uniqueKey === uniqueKey ||
        (Array.isArray(row.invoiceNumbers) && row.invoiceNumbers.includes(trimmedReceipt)),
    );
    const deletedIds: string[] = [];
    for (const row of matches) {
      if (row.id) {
        await deleteGstRecord(String(row.id));
        deletedIds.push(String(row.id));
      }
    }
    return { deletedIds };
  }

  const deletedIds: string[] = [];
  const seen = new Set<string>();

  const uniqueKey = buildGstUniqueKey(trimmedStudentId, trimmedReceipt);
  const uniqueKeyQuery = query(
    collection(db, 'gstRecords'),
    where('uniqueKey', '==', uniqueKey),
    limit(5)
  );
  const uniqueKeySnap = await getDocs(uniqueKeyQuery);
  for (const gstDoc of uniqueKeySnap.docs) {
    if (!seen.has(gstDoc.id)) {
      seen.add(gstDoc.id);
      await deleteDoc(doc(db, 'gstRecords', gstDoc.id));
      deletedIds.push(gstDoc.id);
    }
  }

  const receiptQuery = query(
    collection(db, 'gstRecords'),
    where('invoiceNumbers', 'array-contains', trimmedReceipt),
    limit(5)
  );
  const receiptSnap = await getDocs(receiptQuery);
  for (const gstDoc of receiptSnap.docs) {
    if (!seen.has(gstDoc.id)) {
      seen.add(gstDoc.id);
      await deleteDoc(doc(db, 'gstRecords', gstDoc.id));
      deletedIds.push(gstDoc.id);
    }
  }

  return { deletedIds };
}
