import { doc, getDoc, getDocs, collection, runTransaction, setDoc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { isValidReceiptOrInvoiceNumber } from '@/lib/gstRecordService';

/** All fee document fields that can hold a BETTERCODE receipt number (for renumbering). */
const FEE_RECEIPT_FIELDS = [
  'registrationReceiptNumber',
  'receiptNumber',
  'fullPaymentReceiptNumber',
  ...Array.from({ length: 36 }, (_, i) => `installment${String(i + 1).padStart(2, '0')}ReceiptNumber`),
];

/**
 * Receipt number format:
 * - ZICA  -> ZYYMMDD001 (Z + payment-date YYMMDD + daily sequence, e.g. Z260609001)
 * - BETTERCODE -> BTC001 (global counter)
 * Legacy long formats (e.g. Z2604148000006803) must never be generated or reused.
 */

export function isUsableReceiptNumber(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== '-' &&
    value.trim().length > 3 &&
    isValidReceiptOrInvoiceNumber(value.trim())
  );
}

export type ReceiptBrand = 'ZICA' | 'BETTERCODE';

/** Resolve receipt brand from fee record fields (read-only; does not mutate stored data). */
export function resolveReceiptBrand(feeData: Record<string, unknown>): ReceiptBrand {
  const subCategory = (feeData.zicaSubCategory ?? '').toString().trim().toUpperCase();
  if (subCategory === 'NON-ZICA') {
    return 'BETTERCODE';
  }

  const raw = (feeData.zicaBettercode ?? 'ZICA').toString().trim();
  const upper = raw.toUpperCase();

  if (upper.includes('BETTERCODE') || upper === 'NON-ZICA' || upper === 'AIGT') {
    return 'BETTERCODE';
  }

  return 'ZICA';
}

export function isZicaReceiptLayout(feeData: Record<string, unknown>): boolean {
  return resolveReceiptBrand(feeData) === 'ZICA';
}

/** True when receipt number prefix matches the resolved brand. */
export function receiptNumberMatchesBrand(receiptNumber: string, brand: ReceiptBrand): boolean {
  const v = receiptNumber.trim();
  if (brand === 'BETTERCODE') {
    return /^BTC\d{3,}$/i.test(v);
  }
  return /^Z\d{6}\d{3}$/.test(v) || /^ZICAPCMC/i.test(v);
}

/** Payment date for ZICA counter — feesPaidDate when set, otherwise today (never admission date). */
function resolveReceiptBaseDate(feeData: Record<string, unknown>): Date {
  const raw = feeData.feesPaidDate;
  if (raw instanceof Timestamp) {
    const d = raw.toDate();
    if (!isNaN(d.getTime())) return d;
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = new Date(raw.trim().split('T')[0]);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function getReceiptFieldName(receiptType: string): string | null {
  if (receiptType === 'onetime' || receiptType === 'direct' || receiptType === 'registration') {
    return 'registrationReceiptNumber';
  }
  if (receiptType.startsWith('installment')) {
    const n = receiptType.replace('installment', '').padStart(2, '0');
    return `installment${n}ReceiptNumber`;
  }
  return 'fullPaymentReceiptNumber';
}

/** YYYYMMDD - used for Firestore counter document ID (per-day counter). */
function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** YYMMDD - used in ZICA receipt number display (Z + YYMMDD + 001). */
function formatYymd(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${yy}${m}${day}`;
}

export interface ResolveResult {
  receiptNumber: string;
  feeData: Record<string, unknown>;
}

export const VOIDED_RECEIPTS_FIELD = 'voidedReceiptNumbers';

export function getVoidedReceiptForField(
  feeData: Record<string, unknown>,
  receiptFieldName: string | null
): string | null {
  if (!receiptFieldName) return null;
  const map = feeData[VOIDED_RECEIPTS_FIELD] as Record<string, string> | undefined;
  const value = map?.[receiptFieldName];
  if (typeof value === 'string' && value !== '-' && value.trim().length > 3) {
    return value.trim();
  }
  return null;
}

export function stashVoidedReceipt(
  existingMap: Record<string, string> | undefined,
  receiptFieldName: string,
  receiptNumber: string
): Record<string, string> {
  return { ...(existingMap || {}), [receiptFieldName]: receiptNumber };
}

export function clearVoidedReceiptFromMap(
  existingMap: Record<string, unknown> | undefined,
  receiptFieldName: string
): Record<string, string> {
  const next: Record<string, string> = {};
  if (existingMap && typeof existingMap === 'object') {
    for (const [key, value] of Object.entries(existingMap)) {
      if (key !== receiptFieldName && typeof value === 'string') {
        next[key] = value;
      }
    }
  }
  return next;
}

/**
 * Resolve existing or generate new receipt number in a single transaction.
 * Prevents double-increment when ReceiptPage mounts twice (e.g. Strict Mode)
 * or when multiple receipt types are generated for the same fee.
 */
export async function resolveOrGenerateReceiptNumber(
  db: Firestore,
  feeId: string,
  receiptType: string,
  currentData?: Record<string, unknown>
): Promise<ResolveResult> {
  const receiptFieldName = getReceiptFieldName(receiptType);
  const feeRef = doc(db, 'fees', feeId);

  // Fast path (NO Firestore call if data provided):
  // Only reuse the receipt stored in the field for THIS payment type — never fall back to
  // registrationReceiptNumber/receiptNumber or another installment would get the same number.
  if (currentData && receiptFieldName) {
    const existingVal = currentData[receiptFieldName];
    const brand = resolveReceiptBrand(currentData);
    if (
      isUsableReceiptNumber(existingVal) &&
      receiptNumberMatchesBrand(existingVal.trim(), brand)
    ) {
      return { receiptNumber: existingVal.trim(), feeData: currentData };
    }
  }



  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await runTransaction(db, async (tx) => {
        const feeSnap = await tx.get(feeRef);
        if (!feeSnap.exists()) {
          throw new Error('Fee not found');
        }
        const feeData = feeSnap.data() as Record<string, unknown>;

        const brand = resolveReceiptBrand(feeData);

        // IMPORTANT: Only check the SPECIFIC field for this receipt type
        // Never reuse receipt numbers from other fields (like registrationReceiptNumber or other installments)
        // Treat '-' or short/empty values as "no receipt" so we generate new (e.g. after marking installment Unpaid and then Mark Paid again)
        let receiptNumber: string | null = null;
        const existingVal = receiptFieldName ? feeData[receiptFieldName] : null;
        if (
          receiptFieldName &&
          isUsableReceiptNumber(existingVal) &&
          receiptNumberMatchesBrand(existingVal.trim(), brand)
        ) {
          receiptNumber = existingVal.trim();
          console.log(`ℹ️ Found existing receipt number ${receiptNumber} in field ${receiptFieldName}`);
        } else if (typeof existingVal === 'string' && existingVal.trim() && existingVal !== '-') {
          console.warn(`⚠️ Ignoring invalid/legacy/mismatched receipt in ${receiptFieldName}: ${existingVal}`);
        }
        // DO NOT check feeData.receiptNumber as fallback - that could be from a different installment
        // Each installment must have its own unique receipt number

        const isReceiptUsedOnFee = (num: string): boolean =>
          FEE_RECEIPT_FIELDS.some((field) => {
            const v = feeData[field];
            return typeof v === 'string' && v !== '-' && v.trim() === num;
          });

        if (receiptNumber) {
          return { receiptNumber, feeData };
        }

        // Reuse receipt number saved when this payment was marked unpaid (no counter increment)
        const voidedReceipt = getVoidedReceiptForField(feeData, receiptFieldName);
        if (
          voidedReceipt &&
          isUsableReceiptNumber(voidedReceipt) &&
          receiptNumberMatchesBrand(voidedReceipt, brand) &&
          !isReceiptUsedOnFee(voidedReceipt)
        ) {
          receiptNumber = voidedReceipt;
          const clearedVoided = clearVoidedReceiptFromMap(
            feeData[VOIDED_RECEIPTS_FIELD] as Record<string, unknown> | undefined,
            receiptFieldName!
          );
          const reusePayload: Record<string, unknown> = {
            [receiptFieldName!]: receiptNumber,
            [VOIDED_RECEIPTS_FIELD]: clearedVoided,
          };
          tx.update(feeRef, reusePayload);
          return { receiptNumber, feeData: { ...feeData, ...reusePayload } };
        }

        // No receipt number exists for this specific field - generate a NEW one
        console.log(`🆕 No receipt number found in field ${receiptFieldName}, generating NEW receipt number...`);

        const baseDate = resolveReceiptBaseDate(feeData);

        if (brand === 'BETTERCODE') {
          const counterRef = doc(db, 'receiptCounters', 'BETTERCODE');
          const counterSnap = await tx.get(counterRef);
          let nextValue = 1;

          if (counterSnap.exists()) {
            const data = counterSnap.data() as { next?: number };
            nextValue = typeof data?.next === 'number' ? data.next : 1;
          }

          let safety = 0;
          do {
            receiptNumber = `BTC${String(nextValue).padStart(3, '0')}`;
            nextValue += 1;
            safety += 1;
          } while (receiptNumber && isReceiptUsedOnFee(receiptNumber) && safety < 20);

          tx.set(counterRef, { next: nextValue }, { merge: true });
        } else {
          const ymd = formatYmd(baseDate);
          const yymd = formatYymd(baseDate);
          const counterId = `ZICA_${ymd}`;
          const counterRef = doc(db, 'receiptCounters', counterId);
          const counterSnap = await tx.get(counterRef);
          let nextValue = 1;

          if (counterSnap.exists()) {
            const data = counterSnap.data() as { next?: number };
            nextValue = typeof data?.next === 'number' ? data.next : 1;
          }

          let safety = 0;
          do {
            receiptNumber = `Z${yymd}${String(nextValue).padStart(3, '0')}`;
            nextValue += 1;
            safety += 1;
          } while (receiptNumber && isReceiptUsedOnFee(receiptNumber) && safety < 20);

          tx.set(counterRef, { next: nextValue }, { merge: true });
        }

        if (!receiptNumber || !isUsableReceiptNumber(receiptNumber)) {
          throw new Error('Failed to generate valid receipt number');
        }

        const updatePayload: Record<string, unknown> = receiptFieldName
          ? { [receiptFieldName]: receiptNumber }
          : { receiptNumber };
        tx.update(feeRef, updatePayload);

        return { receiptNumber, feeData: { ...feeData, ...updatePayload } };
      });
    } catch (error: any) {
      const isQuotaError = error?.code === 'resource-exhausted' || 
                          error?.message?.toLowerCase().includes('quota') ||
                          error?.message?.toLowerCase().includes('429');
      
      // If quota exceeded, FAIL FAST. Do not retry. Retrying just hits the limit harder and delays feedback.
      if (isQuotaError) {
        console.warn(`⚠️ Firestore quota exceeded. Failing immediately.`);
        throw new Error('Firestore Quota Exceeded. Please try again tomorrow (Resets ~1:30 PM IST).');
      }

      if (attempt < maxRetries - 1) {
        const waitTime = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s...
        console.warn(`⚠️ Error generating receipt. Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Maximum retries reached for receipt generation');
}

export async function resetBettercodeReceiptCounter(db: Firestore): Promise<void> {
  const counterRef = doc(db, 'receiptCounters', 'BETTERCODE');
  await setDoc(counterRef, { next: 1 });
}

const BTC_REGEX = /^BTC(\d+)$/i;

export interface RenumberBettercodeResult {
  feesUpdated: number;
  gstUpdated: number;
  mapping: Record<string, string>;
  nextCounter: number;
}

/**
 * Renumber all BETTERCODE receipt numbers in the database: BTC001→BTC042, BTC002→BTC043, etc.
 * startFrom is the first new number (e.g. 42). Counter is set so the next generated receipt continues after the highest renumbered value.
 */
export async function renumberBettercodeReceipts(
  db: Firestore,
  startFrom: number
): Promise<RenumberBettercodeResult> {
  const offset = startFrom - 1; // BTC001 (1) → startFrom (42)
  const mapping: Record<string, string> = {};
  const addMapping = (oldVal: string) => {
    const m = oldVal.match(BTC_REGEX);
    if (!m) return;
    const num = parseInt(m[1], 10);
    const newNum = num + offset;
    const newVal = `BTC${String(newNum).padStart(3, '0')}`;
    mapping[oldVal] = newVal;
  };

  const feesSnap = await getDocs(collection(db, 'fees'));
  const gstSnap = await getDocs(collection(db, 'gstRecords'));

  for (const d of feesSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    for (const field of FEE_RECEIPT_FIELDS) {
      const v = data[field];
      if (typeof v === 'string' && v.trim() && BTC_REGEX.test(v)) addMapping(v.trim());
    }
  }
  for (const d of gstSnap.docs) {
    const data = d.data() as { invoiceNumbers?: string[] };
    const arr = data.invoiceNumbers;
    if (Array.isArray(arr)) arr.forEach((n) => typeof n === 'string' && BTC_REGEX.test(n) && addMapping(n));
  }

  let maxNewNum = startFrom - 1;
  for (const newVal of Object.values(mapping)) {
    const m = newVal.match(BTC_REGEX);
    if (m) maxNewNum = Math.max(maxNewNum, parseInt(m[1], 10));
  }
  const nextCounter = maxNewNum + 1;

  let feesUpdated = 0;
  const BATCH_SIZE = 500;
  let batch = writeBatch(db);
  let ops = 0;

  for (const d of feesSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const updates: Record<string, string> = {};
    for (const field of FEE_RECEIPT_FIELDS) {
      const v = data[field];
      if (typeof v === 'string' && mapping[v]) {
        updates[field] = mapping[v];
      }
    }
    if (Object.keys(updates).length > 0) {
      batch.update(doc(db, 'fees', d.id), updates);
      ops++;
      feesUpdated++;
      if (ops >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
  }
  if (ops > 0) await batch.commit();

  let gstUpdated = 0;
  batch = writeBatch(db);
  ops = 0;
  for (const d of gstSnap.docs) {
    const data = d.data() as { invoiceNumbers?: string[] };
    const arr = data.invoiceNumbers;
    if (!Array.isArray(arr)) continue;
    const newArr = arr.map((n) => (typeof n === 'string' && mapping[n] ? mapping[n] : n));
    if (newArr.some((n, i) => n !== arr[i])) {
      batch.update(doc(db, 'gstRecords', d.id), { invoiceNumbers: newArr });
      ops++;
      gstUpdated++;
      if (ops >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
  }
  if (ops > 0) await batch.commit();

  const counterRef = doc(db, 'receiptCounters', 'BETTERCODE');
  await setDoc(counterRef, { next: nextCounter }, { merge: true });

  return { feesUpdated, gstUpdated, mapping, nextCounter };
}

/**
 * Reset ZICA receipt counter for a specific date to 1.
 * Useful for testing or when clearing data for a specific day.
 */
export async function resetZicaReceiptCounter(db: Firestore, date: Date = new Date()): Promise<void> {
  const ymd = formatYmd(date);
  const counterRef = doc(db, 'receiptCounters', `ZICA_${ymd}`);
  await setDoc(counterRef, { next: 1 });
}
export async function decrementReceiptCounter(
  db: Firestore,
  brand: 'ZICA' | 'BETTERCODE',
  count: number = 1,
  date?: Date
): Promise<void> {
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (brand === 'BETTERCODE') {
        const counterRef = doc(db, 'receiptCounters', 'BETTERCODE');
        await runTransaction(db, async (tx) => {
          const counterSnap = await tx.get(counterRef);
          if (counterSnap.exists()) {
            const data = counterSnap.data() as { next?: number };
            const currentNext = typeof data?.next === 'number' ? data.next : 1;
            // Prevent going below 1
            const newNext = Math.max(1, currentNext - count);
            tx.set(counterRef, { next: newNext }, { merge: true });
          }
        });
      } else {
        // ZICA
        if (!date) return; // Cannot decrement ZICA without date
        const ymd = formatYmd(date);
        const counterId = `ZICA_${ymd}`;
        const counterRef = doc(db, 'receiptCounters', counterId);
        
        await runTransaction(db, async (tx) => {
          const counterSnap = await tx.get(counterRef);
          if (counterSnap.exists()) {
            const data = counterSnap.data() as { next?: number };
            const currentNext = typeof data?.next === 'number' ? data.next : 1;
            // Prevent going below 1
            const newNext = Math.max(1, currentNext - count);
            tx.set(counterRef, { next: newNext }, { merge: true });
          }
        });
      }
      return;
    } catch (error: any) {
      if (attempt < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      console.warn('Failed to decrement receipt counter:', error);
      // Don't throw, just log warning as this is not critical for data integrity of the record itself
    }
  }
}
