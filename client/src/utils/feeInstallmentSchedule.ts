import {
  INSTALLMENT_AMOUNT_FIELDS,
  INSTALLMENT_DUE_DATE_FIELDS,
  INSTALLMENT_RECEIPT_FIELDS,
} from '@/constants/feeInstallments';

export interface FeeInstallmentDisplayRow {
  index: number;
  name: string;
  amount: number;
  dueDate: Date | null;
  status: 'Paid' | 'Pending';
  isPaid: boolean;
  dueDateMissing: boolean;
}

/** Parse fee/installment due dates (ISO, DD/MM/YYYY, Firestore Timestamp). */
export function parseFeeDueDate(val: unknown): Date | null {
  if (val == null) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[/-T]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return null;
}

/** Normalize due date the same way Fee Details parses for display/comparison. */
export function normalizeDueDateLikeFeeDetails(dueDateObj: Date | string | undefined | null): Date | null {
  if (dueDateObj == null) return null;
  if (dueDateObj instanceof Date) return isNaN(dueDateObj.getTime()) ? null : dueDateObj;
  if (typeof dueDateObj === 'string') {
    const parts = dueDateObj.split(/[-T]/);
    if (parts.length >= 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    const d = new Date(dueDateObj);
    return isNaN(d.getTime()) ? null : d;
  }
  return parseFeeDueDate(dueDateObj);
}

function hasInstallmentReceipt(record: Record<string, unknown>, index: number): boolean {
  if (index >= INSTALLMENT_RECEIPT_FIELDS.length) return false;
  const receipt = record[INSTALLMENT_RECEIPT_FIELDS[index]];
  return Boolean(receipt && receipt !== '-' && String(receipt).length > 3);
}

export function hasStoredInstallmentDueDate(record: Record<string, unknown>, installmentIndex: number): boolean {
  if (installmentIndex >= INSTALLMENT_DUE_DATE_FIELDS.length) return false;
  const storedRaw = record[INSTALLMENT_DUE_DATE_FIELDS[installmentIndex]];
  return (
    (typeof storedRaw === 'string' && storedRaw.trim() !== '') ||
    (storedRaw != null && typeof storedRaw !== 'string')
  );
}

function getAdmissionBaseDate(record: Record<string, unknown>): Date {
  if (record.dateOfAdmission) {
    const d = new Date(record.dateOfAdmission as string | Date);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Fee Details: monthOffset = i+1 from admission, day 15. */
function calcDueFromAdmission(admissionBase: Date, installmentIndex: number): Date {
  const monthOffset = installmentIndex + 1;
  const calc = new Date(admissionBase);
  calc.setDate(1);
  calc.setMonth(admissionBase.getMonth() + monthOffset);
  calc.setDate(15);
  return calc;
}

/**
 * Course often starts before admission (e.g. start 03/06, admission 19/06, 1st due 15/06).
 * Schedule from courseStartDate: installment i due on day 15 of (startMonth + i).
 */
function calcDueFromCourseStart(courseStart: Date, installmentIndex: number): Date {
  const calc = new Date(courseStart);
  calc.setDate(1);
  calc.setMonth(courseStart.getMonth() + installmentIndex);
  calc.setDate(15);
  return calc;
}

/** Count installments from declared count or populated Firestore fields (existing students). */
export function resolveInstallmentCount(record: Record<string, unknown>): number {
  const declared = Number(record.numberOfInstallments) || 0;
  let highestPopulated = 0;
  for (let i = 0; i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
    const amount = Number(record[INSTALLMENT_AMOUNT_FIELDS[i]]) || 0;
    const hasDue = hasStoredInstallmentDueDate(record, i);
    const hasReceipt = hasInstallmentReceipt(record, i);
    if (amount > 0 || hasDue || hasReceipt) {
      highestPopulated = i + 1;
    }
  }
  return Math.max(declared, highestPopulated);
}

/** Shared due date for Fee Details + This Month's Due (read-only for display). */
export function getResolvedInstallmentDueDate(
  record: Record<string, unknown>,
  installmentIndex: number
): { due: Date | null; missing: boolean } {
  return resolveInstallmentDueDate(record, installmentIndex, getAdmissionBaseDate(record));
}

function resolveInstallmentDueDate(
  record: Record<string, unknown>,
  installmentIndex: number,
  admissionBase: Date
): { due: Date | null; missing: boolean } {
  const storedRaw = installmentIndex < INSTALLMENT_DUE_DATE_FIELDS.length
    ? record[INSTALLMENT_DUE_DATE_FIELDS[installmentIndex]]
    : null;
  const hasStored =
    (typeof storedRaw === 'string' && storedRaw.trim() !== '') ||
    (storedRaw != null && typeof storedRaw !== 'string');

  if (hasStored) {
    const dueDateObj =
      typeof storedRaw === 'string' ? storedRaw : new Date(storedRaw as Date | string);
    return { due: normalizeDueDateLikeFeeDetails(dueDateObj), missing: false };
  }

  const courseStart = parseFeeDueDate(record.courseStartDate);
  const admission = parseFeeDueDate(record.dateOfAdmission);

  if (courseStart && !isNaN(courseStart.getTime())) {
    const fromStart = calcDueFromCourseStart(courseStart, installmentIndex);
    if (!admission || fromStart.getTime() <= admission.getTime() || installmentIndex === 0) {
      return { due: fromStart, missing: true };
    }
  }

  return { due: calcDueFromAdmission(admissionBase, installmentIndex), missing: true };
}

function getFirstUnpaidInstallmentIndex(record: Record<string, unknown>, totalInstallments: number): number {
  for (let i = 0; i < totalInstallments && i < INSTALLMENT_RECEIPT_FIELDS.length; i++) {
    if (!hasInstallmentReceipt(record, i)) return i;
  }
  return totalInstallments;
}

function buildInstallmentAmounts(record: Record<string, unknown>, totalInstallments: number): number[] {
  const feesPaid = Number(record.feesPaid) || 0;
  const discountedFees = Number(record.discountedFees) || 0;

  let totalPaidInstallmentAmount = 0;
  let paidInstallmentCount = 0;
  for (let i = 0; i < totalInstallments && i < INSTALLMENT_RECEIPT_FIELDS.length; i++) {
    if (hasInstallmentReceipt(record, i)) {
      totalPaidInstallmentAmount += Number(record[INSTALLMENT_AMOUNT_FIELDS[i]]) || 0;
      paidInstallmentCount++;
    }
  }

  const initialPaymentAmount =
    paidInstallmentCount === 0 && feesPaid > 0
      ? feesPaid
      : Math.max(0, feesPaid - totalPaidInstallmentAmount);

  let hasStoredAmounts = false;
  for (let i = 0; i < totalInstallments && i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
    if (Number(record[INSTALLMENT_AMOUNT_FIELDS[i]]) > 0) {
      hasStoredAmounts = true;
      break;
    }
  }

  const amounts: number[] = [];
  if (hasStoredAmounts) {
    for (let i = 0; i < totalInstallments && i < INSTALLMENT_AMOUNT_FIELDS.length; i++) {
      amounts.push(Number(record[INSTALLMENT_AMOUNT_FIELDS[i]]) || 0);
    }
  } else {
    const balanceAfterInitial = Math.max(0, discountedFees - initialPaymentAmount);
    const equalAmount =
      balanceAfterInitial > 0
        ? parseFloat((balanceAfterInitial / totalInstallments).toFixed(2))
        : 0;
    const totalDistributed =
      balanceAfterInitial > 0
        ? parseFloat((equalAmount * (totalInstallments - 1)).toFixed(2))
        : 0;
    const lastAmount =
      balanceAfterInitial > 0
        ? parseFloat((balanceAfterInitial - totalDistributed).toFixed(2))
        : 0;
    for (let i = 0; i < totalInstallments; i++) {
      amounts.push(i === totalInstallments - 1 ? lastAmount : equalAmount);
    }
  }

  return amounts;
}

/** Pending balance — use stored feesBalance or derive from discounted − paid. */
export function getEffectiveFeesBalance(record: Record<string, unknown>): number {
  const stored = Number(record.feesBalance);
  if (!Number.isNaN(stored) && stored > 0) return stored;
  const discounted = Number(record.discountedFees) || 0;
  const paid = Number(record.feesPaid) || 0;
  return Math.max(0, discounted - paid);
}

/** Same installment rows as Fee Details (pending/paid per slot, amount > 0 only). */
function resolveDisplayAmount(
  installmentAmounts: number[],
  index: number,
  record: Record<string, unknown>,
  installmentIndex: number
): number {
  let amount = installmentAmounts[index] || 0;
  if (amount <= 0 && !hasInstallmentReceipt(record, installmentIndex)) {
    const positive = installmentAmounts.find((a) => a > 0);
    if (positive) return positive;
  }
  return amount;
}

export function getFeeInstallmentDisplayRows(record: Record<string, unknown>): FeeInstallmentDisplayRow[] {
  const totalInstallments = resolveInstallmentCount(record);
  if (totalInstallments <= 0) return [];

  const installmentAmounts = buildInstallmentAmounts(record, totalInstallments);
  const admissionBase = getAdmissionBaseDate(record);
  const rows: FeeInstallmentDisplayRow[] = [];

  for (let i = 0; i < totalInstallments && i < installmentAmounts.length; i++) {
    const isPaid = hasInstallmentReceipt(record, i);
    const amount = resolveDisplayAmount(installmentAmounts, i, record, i);
    if (amount <= 0 && !hasStoredInstallmentDueDate(record, i)) continue;
    if (amount <= 0) continue;

    const { due, missing } = resolveInstallmentDueDate(record, i, admissionBase);

    rows.push({
      index: i,
      name: `Installment ${i + 1}`,
      amount,
      dueDate: due,
      status: isPaid ? 'Paid' : 'Pending',
      isPaid,
      dueDateMissing: missing,
    });
  }

  return rows;
}

export function isDueInCalendarMonth(dueDate: Date, referenceDate: Date): boolean {
  return (
    dueDate.getFullYear() === referenceDate.getFullYear() &&
    dueDate.getMonth() === referenceDate.getMonth()
  );
}

type DueInMonthCandidate = { dueDate: Date; expectedAmount: number; installmentIndex: number };

/**
 * Unpaid installment due in the same calendar month + year as referenceDate.
 */
export function getInstallmentDueInMonth(
  record: Record<string, unknown>,
  referenceDate: Date = new Date()
): { dueDate: Date; expectedAmount: number; installmentIndex: number } | null {
  if (getEffectiveFeesBalance(record) <= 0) return null;

  const candidates: DueInMonthCandidate[] = [];
  const totalInstallments = resolveInstallmentCount(record);
  const installmentAmounts = buildInstallmentAmounts(record, totalInstallments);
  const admissionBase = getAdmissionBaseDate(record);

  for (let i = 0; i < totalInstallments; i++) {
    if (hasInstallmentReceipt(record, i)) continue;
    const { due } = resolveInstallmentDueDate(record, i, admissionBase);
    if (!due || isNaN(due.getTime())) continue;
    const amount = resolveDisplayAmount(installmentAmounts, i, record, i);
    if (amount <= 0) continue;
    candidates.push({ dueDate: due, expectedAmount: amount, installmentIndex: i });
  }

  const displayRows = getFeeInstallmentDisplayRows(record);
  for (const row of displayRows) {
    if (row.isPaid || !row.dueDate || isNaN(row.dueDate.getTime())) continue;
    if (candidates.some((c) => c.installmentIndex === row.index)) continue;
    candidates.push({
      dueDate: row.dueDate,
      expectedAmount: row.amount,
      installmentIndex: row.index,
    });
  }

  const recordDue = parseFeeDueDate(record.dueDate);
  if (recordDue && !isNaN(recordDue.getTime())) {
    const balanceInstallments = Number(record.balanceInstallments) || 0;
    const expectedAmount =
      balanceInstallments > 0
        ? Math.round(getEffectiveFeesBalance(record) / balanceInstallments)
        : getEffectiveFeesBalance(record);
    if (expectedAmount > 0) {
      candidates.push({
        dueDate: recordDue,
        expectedAmount,
        installmentIndex: -1,
      });
    }
  }

  const inThisMonth = candidates.filter((c) => isDueInCalendarMonth(c.dueDate, referenceDate));
  if (inThisMonth.length === 0) return null;

  inThisMonth.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return inThisMonth[0];
}

export interface ThisMonthDueEntry {
  record: Record<string, unknown>;
  dueDateParsed: Date;
  expectedAmount: number;
  status: 'Due' | 'Overdue';
}

export interface ThisMonthDueBuildResult {
  entries: ThisMonthDueEntry[];
  skipped: { studentName: string; reason: string }[];
}

/** Evaluate every fee record for the current calendar month. */
export function buildThisMonthDueEntries(
  feeRecords: Record<string, unknown>[],
  referenceDate: Date = new Date()
): ThisMonthDueBuildResult {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const todayStart = new Date(currentYear, currentMonth, referenceDate.getDate());
  const entries: ThisMonthDueEntry[] = [];
  const skipped: { studentName: string; reason: string }[] = [];

  feeRecords.forEach((record) => {
    const name = String(record.studentName ?? record.id ?? 'Unknown');

    const balance = getEffectiveFeesBalance(record);
    if (balance <= 0) {
      skipped.push({ studentName: name, reason: 'No pending balance' });
      return;
    }

    try {
      const dueInMonth = getInstallmentDueInMonth(record, referenceDate);
      if (!dueInMonth) {
        skipped.push({
          studentName: name,
          reason: `No unpaid installment due in ${referenceDate.toLocaleString('default', { month: 'long', year: 'numeric' })} (installments: ${Number(record.numberOfInstallments) || 0}, balance: ₹${balance})`,
        });
        return;
      }

      const status: 'Due' | 'Overdue' =
        dueInMonth.dueDate >= todayStart ? 'Due' : 'Overdue';

      entries.push({
        record,
        dueDateParsed: dueInMonth.dueDate,
        expectedAmount: dueInMonth.expectedAmount,
        status,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      skipped.push({ studentName: name, reason: `Error: ${message}` });
    }
  });

  return { entries, skipped };
}

/**
 * Persist month-wise installment due dates on fee payload (create/update student).
 */
export function applyInstallmentDueDatesToFeePayload(
  payload: Record<string, unknown>,
  options: {
    noOfInstallments: number;
    installmentsPaid?: number;
    firstDueDate?: unknown;
    admissionDate?: unknown;
    courseStartDate?: unknown;
  }
): void {
  const { noOfInstallments, firstDueDate, admissionDate, courseStartDate } = options;
  if (noOfInstallments <= 0) return;

  const firstUnpaidIndex = getFirstUnpaidInstallmentIndex(payload, noOfInstallments);

  let anchor = parseFeeDueDate(firstDueDate);
  if (!anchor || isNaN(anchor.getTime())) {
    const courseStart = parseFeeDueDate(courseStartDate);
    if (courseStart && !isNaN(courseStart.getTime())) {
      anchor = calcDueFromCourseStart(courseStart, firstUnpaidIndex);
    } else {
      const admission =
        parseFeeDueDate(admissionDate) ?? new Date();
      anchor = calcDueFromAdmission(admission, firstUnpaidIndex);
    }
  }

  const y0 = anchor.getFullYear();
  const m0 = anchor.getMonth();
  const day = anchor.getDate();

  for (let i = firstUnpaidIndex; i < noOfInstallments && i < INSTALLMENT_DUE_DATE_FIELDS.length; i++) {
    const offset = i - firstUnpaidIndex;
    const d = new Date(y0, m0 + offset, day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    payload[INSTALLMENT_DUE_DATE_FIELDS[i]] = `${y}-${m}-${dayStr}`;
  }
}
