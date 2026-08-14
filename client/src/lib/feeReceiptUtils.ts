import { Timestamp } from 'firebase/firestore';

import { getFeeRecordById, usePostgresCrmRecords } from '@/lib/crmRecordsStore';
import { getReceiptFieldName } from '@/lib/receiptCounterService';

export function buildReceiptLoadKey(
  feeId: string,
  receiptType: string,
  amount?: number | string,
): string {
  return `${feeId}|${receiptType}|${amount != null ? String(amount) : ''}`;
}

function serializeValueForCache(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeValueForCache);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValueForCache(v);
    }
    return out;
  }
  return value;
}

export function cacheReceiptDraft(loadKey: string, feeData: Record<string, unknown>): void {
  const serialized = serializeValueForCache(feeData) as Record<string, unknown>;
  sessionStorage.setItem(`receiptDraft:${loadKey}`, JSON.stringify({ feeData: serialized }));
}

export function loadCachedReceiptDraft(loadKey: string): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(`receiptDraft:${loadKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { feeData?: Record<string, unknown> };
    return parsed?.feeData ?? null;
  } catch {
    return null;
  }
}

export function resolveReceiptNumberFromFeeData(
  feeData: Record<string, unknown> | null,
  receiptType: string,
): string {
  if (!feeData) return '';
  const fieldName = getReceiptFieldName(receiptType);
  if (fieldName && typeof feeData[fieldName] === 'string' && feeData[fieldName] !== '-') {
    return feeData[fieldName] as string;
  }
  return (
    (typeof feeData.fullPaymentReceiptNumber === 'string' && feeData.fullPaymentReceiptNumber) ||
    (typeof feeData.registrationReceiptNumber === 'string' && feeData.registrationReceiptNumber) ||
    (typeof feeData.receiptNumber === 'string' && feeData.receiptNumber) ||
    ''
  );
}

export async function fetchFeeRecordForReceipt(feeId: string): Promise<Record<string, unknown>> {
  if (usePostgresCrmRecords()) {
    return getFeeRecordById(feeId);
  }

  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  const snap = await getDoc(doc(db, 'fees', feeId));
  if (!snap.exists()) {
    throw new Error('Fee record not found');
  }
  return { id: snap.id, ...snap.data() } as Record<string, unknown>;
}

export function buildReceiptPdfFilename(studentName: string, receiptNumber: string): string {
  const safeName = String(studentName || 'Receipt')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const safeReceipt = String(receiptNumber || 'receipt')
    .replace(/[/\\:*?"<>|]/g, '_')
    .trim();
  return `${safeName}_${safeReceipt}.pdf`;
}

export async function downloadReceiptAsPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function openReceiptPage(
  feeId: string,
  receiptType: string,
  amount: number,
  feeData: Record<string, unknown>,
  options?: { autoDownload?: boolean },
): void {
  const loadKey = buildReceiptLoadKey(feeId, receiptType, amount);
  cacheReceiptDraft(loadKey, feeData);
  const downloadParam = options?.autoDownload ? '&download=1' : '';
  window.open(
    `/receipt?feeId=${encodeURIComponent(feeId)}&type=${encodeURIComponent(receiptType)}&amount=${amount}${downloadParam}`,
    '_blank',
  );
}
