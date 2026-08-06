import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { resolveOrGenerateReceiptNumber, isZicaReceiptLayout } from '@/lib/receiptCounterService';
import { Printer, Download } from 'lucide-react';
import { ReceiptTemplate, ReceiptData } from '@/components/receipts/ReceiptTemplate';



export default function ReceiptPage() {
  const [searchParams] = useSearchParams();
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // IMPORTANT: URLSearchParams object identity is not stable across renders,
  // so depend on its string value, not the object reference.
  const searchKey = useMemo(() => searchParams.toString(), [searchParams]);
  const feeId = useMemo(() => new URLSearchParams(searchKey).get('feeId') || '', [searchKey]);
  const receiptType = useMemo(() => new URLSearchParams(searchKey).get('type') || 'full', [searchKey]);
  const urlAmount = useMemo(() => new URLSearchParams(searchKey).get('amount'), [searchKey]);

  const loadKey = useMemo(() => {
    return `${feeId}|${receiptType}|${urlAmount ?? ''}`;
  }, [feeId, receiptType, urlAmount]);

  const lastLoadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const loadReceiptData = async () => {
      try {
        if (!feeId) {
          console.error('No fee ID provided');
          setLoading(false);
          return;
        }

        // Guard against repeated loads caused by URLSearchParams identity changes
        if (lastLoadKeyRef.current === loadKey) return;
        lastLoadKeyRef.current = loadKey;

        setErrorMessage(null);
        setLoading(true);

        // If we have a cached snapshot from the opener (FeeDetailsDialog), prefer it first
        // to avoid ANY Firestore reads in the receipt tab.
        let cachedFeeData: Record<string, unknown> | null = null;
        try {
          const raw = sessionStorage.getItem(`receiptDraft:${loadKey}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { feeData?: Record<string, unknown> };
            cachedFeeData = parsed?.feeData ?? null;
          }
        } catch {
          // ignore cache parse errors
        }

        const resolveReceiptNumberFromData = (data: Record<string, unknown> | null, type: string): string => {
          if (!data) return '';
          
          // 1. Try field-specific receipt number first
          const fieldName = resolveReceiptFieldName(type);
          if (fieldName && typeof data[fieldName] === 'string' && data[fieldName]) {
            return data[fieldName] as string;
          }

          // 2. Fallback to general receipt fields for compatibility
          return (
            (typeof data.fullPaymentReceiptNumber === 'string' && data.fullPaymentReceiptNumber) ||
            (typeof data.registrationReceiptNumber === 'string' && data.registrationReceiptNumber) ||
            (typeof data.receiptNumber === 'string' && data.receiptNumber) ||
            ''
          );
        };

        const resolveReceiptFieldName = (type: string): string | null => {
          if (type === 'onetime' || type === 'direct' || type === 'registration') {
            return 'registrationReceiptNumber';
          }
          if (type.startsWith('installment')) {
            const n = type.replace('installment', '').padStart(2, '0');
            return `installment${n}ReceiptNumber`;
          }
          if (type === 'full') {
            return 'fullPaymentReceiptNumber';
          }
          return null;
        };

        const cachedReceiptNumber = resolveReceiptNumberFromData(cachedFeeData, receiptType);

        let receiptNumber: string = cachedReceiptNumber;
        let feeData: Record<string, unknown> | null = cachedFeeData;

        // For installment receipts, always fetch from Firestore to ensure we have latest late fees data
        // (cache may have been set before payment was confirmed with late fees)
        const isInstallment = receiptType.startsWith('installment');
        const shouldHitFirestore = !feeData || !receiptNumber || isInstallment;

        const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
        const resolveWithBackoff = async (): Promise<{ receiptNumber: string; feeData: Record<string, unknown> }> => {
          const maxAttempts = 3;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              return await resolveOrGenerateReceiptNumber(db, feeId, receiptType);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              const code = (err as { code?: unknown })?.code;
              const codeStr = typeof code === 'string' ? code : '';

              const isRateLimited =
                message.includes('429') ||
                codeStr.includes('resource-exhausted') ||
                codeStr.includes('quota-exceeded') ||
                codeStr.includes('too-many-requests') ||
                message.toLowerCase().includes('quota') ||
                message.toLowerCase().includes('too many');

              if (!isRateLimited || attempt === maxAttempts - 1) throw err;

              // Exponential backoff: 800ms, 1600ms, 3200ms
              const delay = 800 * Math.pow(2, attempt);
              await sleep(delay);
            }
          }
          // unreachable
          throw new Error('Failed to resolve receipt number');
        };

        try {
          if (shouldHitFirestore) {
            const resolved = await resolveWithBackoff();
            receiptNumber = resolved.receiptNumber;
            feeData = resolved.feeData;
            try {
              sessionStorage.setItem(`receiptDraft:${loadKey}`, JSON.stringify({ feeData }));
            } catch {
              // ignore sessionStorage errors
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          const code = (error as { code?: unknown })?.code;
          const codeStr = typeof code === 'string' ? code : '';

          const isRateLimited =
            message.includes('429') ||
            codeStr.includes('resource-exhausted') ||
            codeStr.includes('quota-exceeded') ||
            codeStr.includes('too-many-requests') ||
            message.toLowerCase().includes('quota') ||
            message.toLowerCase().includes('too many');

          if (isRateLimited && cachedFeeData) {
            // Use cached data so the UI can still render during rate limiting.
            feeData = cachedFeeData;
            receiptNumber = cachedReceiptNumber || 'N/A';
          } else {
            throw error;
          }
        }

        if (!feeData) {
          throw new Error('Receipt data unavailable');
        }

        let amountPaid = Number(feeData.feesPaid) || 0;
        let lateFeesAmount: number | undefined;
        if (receiptType.startsWith('installment')) {
          const installmentNum = receiptType.replace('installment', '');
          const padded = installmentNum.padStart(2, '0');
          const installmentField = `installment${padded}`;
          const lateFeesField = `installment${padded}LateFees`;
          const installmentAmount = Number(feeData[installmentField]) || 0;
          if (urlAmount) {
            amountPaid = Number(urlAmount);
          } else if (installmentAmount > 0) {
            amountPaid = installmentAmount;
          }
          const stored = Number(feeData[lateFeesField]);
          if (stored > 0) lateFeesAmount = stored;
        } else if (urlAmount) {
          amountPaid = Number(urlAmount);
        } else if (receiptType === 'onetime' || receiptType === 'direct') {
          amountPaid = urlAmount ? Number(urlAmount) : Number(feeData.registrationAmount) || 0;
        } else if (receiptType === 'registration') {
          amountPaid = Number(feeData.registrationAmount) || 0;
        } else if (receiptType === 'partial') {
          amountPaid = urlAmount ? Number(urlAmount) : Number(feeData.feesPaid) || 0;
        }

        const taxableAmount = amountPaid / 1.18;
        const totalGst = amountPaid - taxableAmount;
        const cgst = totalGst / 2;
        const sgst = totalGst / 2;

        // Format date as DD-MM-YYYY
        const formatDate = (date: Date | Timestamp | string): string => {
          let d: Date;
          if (date instanceof Timestamp) {
            d = date.toDate();
          } else if (date instanceof Date) {
            d = date;
          } else if (typeof date === 'string') {
            d = new Date(date);
          } else {
            d = new Date();
          }
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          return `${day}-${month}-${year}`;
        };

        // Receipt Date: use only fees paid date from fee record (set in Mark Payment popup)
        // Handle: Timestamp (from Firestore), Date, string, or plain { seconds, nanoseconds } from sessionStorage cache
        let formattedDate = '-';
        const feesPaidDate = feeData.feesPaidDate;
        if (feesPaidDate != null) {
          if (feesPaidDate instanceof Timestamp) {
            formattedDate = formatDate(feesPaidDate.toDate());
          } else if (feesPaidDate instanceof Date) {
            formattedDate = formatDate(feesPaidDate);
          } else if (typeof feesPaidDate === 'string') {
            // Support ISO, YYYY-MM-DD, or DD/MM/YYYY (as shown in Fee Records table)
            const s = feesPaidDate.trim();
            if (s.includes('/')) {
              const parts = s.split('/');
              if (parts.length >= 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                formattedDate = `${day}-${month}-${year}`;
              } else {
                formattedDate = formatDate(new Date(s));
              }
            } else {
              formattedDate = formatDate(feesPaidDate);
            }
          } else if (typeof feesPaidDate === 'object' && ('seconds' in feesPaidDate || '_seconds' in feesPaidDate)) {
            const seconds = (feesPaidDate as { seconds?: number; _seconds?: number }).seconds ?? (feesPaidDate as { _seconds?: number })._seconds;
            if (typeof seconds === 'number') {
              const d = new Date(seconds * 1000);
              if (!isNaN(d.getTime())) {
                formattedDate = formatDate(d);
              }
            }
          }
        }

        // Remarks: only user-entered remarks from the fee record. Do not show payment narrative (e.g. "Paid Installment 1: ₹8000 via UPI..." or installmentDetails).
        const remarks = (typeof feeData.remarks === 'string' && feeData.remarks.trim()) ? feeData.remarks.trim() : '';

// Compute next installment due date (first unpaid installment)
        let nextInstallmentDueDate: string | undefined;
        const totalInstallments = Number(feeData.numberOfInstallments) || 0;
        if (totalInstallments > 0) {
          // Dynamic import is not strictly needed since we can statically import at top, but we already have static imports in mind. Wait, let me check if I should use static imports.
          // The constants might not be imported. I'll define the arrays locally to be safe, or just use the pattern.
          const receiptFields = Array.from({ length: 36 }, (_, i) => `installment${String(i + 1).padStart(2, '0')}ReceiptNumber`);
          const dueDateFields = Array.from({ length: 36 }, (_, i) => `installment${String(i + 1).padStart(2, '0')}DueDate`);
          const amountFields = Array.from({ length: 36 }, (_, i) => `installment${String(i + 1).padStart(2, '0')}`);
          
          let firstUnpaidIndex = -1;
          for (let i = 0; i < totalInstallments && i < receiptFields.length; i++) {
            const r = feeData[receiptFields[i]];
            const amt = Number(feeData[amountFields[i]]) || 0;
            if ((!r || r === '-' || String(r).length <= 3) && amt > 0) {
              firstUnpaidIndex = i;
              break;
            }
          }
          if (firstUnpaidIndex >= 0) {
            const storedDueDate = feeData[dueDateFields[firstUnpaidIndex]];
            if (storedDueDate) {
              const str = typeof storedDueDate === 'string' ? storedDueDate : '';
              if (str && /^\d{4}-\d{2}-\d{2}/.test(str)) {
                const parts = str.split('T')[0].split('-');
                if (parts.length >= 3) {
                  nextInstallmentDueDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
              } else if (storedDueDate instanceof Timestamp) {
                const d = storedDueDate.toDate();
                if (!isNaN(d.getTime())) {
                  nextInstallmentDueDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                }
              } else if (typeof storedDueDate === 'object' && ('seconds' in storedDueDate || '_seconds' in storedDueDate)) {
                const seconds = (storedDueDate as any).seconds || (storedDueDate as any)._seconds;
                if (typeof seconds === 'number') {
                  const d = new Date(seconds * 1000);
                  if (!isNaN(d.getTime())) {
                    nextInstallmentDueDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                  }
                }
              }
            }
            
            const dateOfAdm = feeData.dateOfAdmission;
            if (!nextInstallmentDueDate && dateOfAdm) {
              let baseDate: Date | null = null;
              if (dateOfAdm instanceof Timestamp) {
                baseDate = dateOfAdm.toDate();
              } else if (typeof dateOfAdm === 'string' || dateOfAdm instanceof Date) {
                baseDate = new Date(dateOfAdm);
              } else if (typeof dateOfAdm === 'object' && ('seconds' in dateOfAdm || '_seconds' in dateOfAdm)) {
                const seconds = (dateOfAdm as any).seconds || (dateOfAdm as any)._seconds;
                if (typeof seconds === 'number') {
                  baseDate = new Date(seconds * 1000);
                }
              }

              if (baseDate && !isNaN(baseDate.getTime())) {
                const monthOffset = firstUnpaidIndex + 1;
                const calc = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 15);
                if (!isNaN(calc.getTime())) {
                  const day = String(calc.getDate()).padStart(2, '0');
                  const month = String(calc.getMonth() + 1).padStart(2, '0');
                  const year = calc.getFullYear();
                  nextInstallmentDueDate = `${day}/${month}/${year}`;
                }
              }
            }
          }
        }

        // Gross Total on receipt only: base amount + late fees (late fees NOT added elsewhere in app)
        const receiptGrossTotal = amountPaid + (lateFeesAmount || 0);

        // For installment receipts, use the payment mode from Mark Payment (per-installment field)
        let receiptPaymentMode = String(feeData.paymentMode ?? 'Cash');
        if (receiptType.startsWith('installment')) {
          const padded = receiptType.replace('installment', '').padStart(2, '0');
          const installmentPaymentModeField = `installment${padded}PaymentMode`;
          const installmentMode = feeData[installmentPaymentModeField];
          if (installmentMode && String(installmentMode).trim()) {
            receiptPaymentMode = String(installmentMode);
          }
        }

        const receipt: ReceiptData = {
          studentName: String(feeData.studentName ?? ''),
          course: String(feeData.course ?? ''),
          contactNumber: String(feeData.contactNumber ?? ''),
          receiptNumber: receiptNumber || 'N/A',
          date: formattedDate,
          paymentMode: receiptPaymentMode,
          chequeNumber: String(feeData.chequeNumber ?? ''),
          totalInstallments: Number(feeData.numberOfInstallments) || 0,
          nextInstallmentDueDate: nextInstallmentDueDate,
          totalCourseFees: Number(feeData.discountedFees) || Number(feeData.actualFees) || 0,
          balanceDue: Number(feeData.feesBalance) || 0,
          amountPaid: taxableAmount,
          cgst: cgst,
          sgst: sgst,
          grossTotal: receiptGrossTotal,
          lateFeesAmount,
          zicaBettercode: String(feeData.zicaBettercode ?? 'ZICA'),
          remarks: remarks,
          feeData: feeData,
          receiptType: receiptType,
          urlAmount: urlAmount ? Number(urlAmount) : undefined,
          dateOfAdmission: feeData.dateOfAdmission ? (feeData.dateOfAdmission instanceof Timestamp ? feeData.dateOfAdmission.toDate().toISOString() : String(feeData.dateOfAdmission)) : undefined,
          parentsContactNumber: String(feeData.parentsContactNumber ?? '')
        };

        setReceiptData(receipt);
        setLoading(false);
      } catch (error) {
        console.error('Error loading receipt data:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to load receipt data. Please try again.';
        setErrorMessage(message);
        setLoading(false);
      }
    };

    loadReceiptData();
  }, [feeId, receiptType, urlAmount, loadKey]);

  // Set document title to StudentName_ReceiptNo so "Save as PDF" suggests that filename
  useEffect(() => {
    if (!receiptData?.studentName || !receiptData?.receiptNumber) return;
    const prevTitle = document.title;
    const name = String(receiptData.studentName).trim();
    const receiptNo = String(receiptData.receiptNumber).trim();
    const safeName = name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'Receipt';
    document.title = `${safeName}_${receiptNo}`;
    return () => {
      document.title = prevTitle;
    };
  }, [receiptData?.studentName, receiptData?.receiptNumber]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading receipt...</div>
      </div>
    );
  }

  if (!receiptData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-lg text-red-600">Receipt not found</div>
        {errorMessage ? (
          <div className="max-w-xl text-sm text-gray-600 text-center px-4">
            {errorMessage}
          </div>
        ) : null}
        <button
          className="px-4 py-2 border border-gray-300 rounded bg-white hover:bg-gray-50"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  const isZica = isZicaReceiptLayout(
    (receiptData.feeData as Record<string, unknown> | undefined) ?? {
      zicaBettercode: receiptData.zicaBettercode,
    }
  );

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .receipt-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .receipt-container {
            box-shadow: none;
            padding: 10mm;
          }
        }

        @media screen {
          body {
            margin: 0;
            padding: 0;
            background: #f5f5f5;
          }
          
          .receipt-page {
            background: #f5f5f5;
            min-height: 100vh;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
        }

        .receipt-container {
          width: 210mm;
          min-height: 297mm;
          background: white;
          padding: 10mm;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          margin: 0 auto;
        }

        .header-section {
          display: flex;
          border: 2px solid #000;
          margin-bottom: 10px;
        }

        .logo-section {
          width: 25%;
          border-right: 2px solid #000;
          padding: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-section img {
          max-width: 100%;
          max-height: 80px;
          object-fit: contain;
        }

        .header-info {
          width: 75%;
          padding: 15px;
          text-align: center;
        }

        .receipt-title {
          font-size: 10px;
          margin-bottom: 5px;
          color: #333;
        }

        .brand-name {
          font-size: 20px;
          font-weight: 900;
          margin: 8px 0;
          color: #000;
          letter-spacing: 0.5px;
        }

        .franchise-text {
          font-size: 11px;
          margin: 3px 0;
          font-weight: 600;
        }

        .registered-name {
          font-size: 11px;
          margin: 3px 0;
          font-weight: 600;
        }

        .gst-info {
          font-size: 11px;
          margin-top: 3px;
          font-weight: 600;
        }

        .info-section {
          width: 100%;
          border: 2px solid #000;
          border-collapse: collapse;
          margin-bottom: 10px;
        }

        .info-section td {
          padding: 6px 10px;
          border: 1px solid #000;
        }

        .info-label {
          width: 40%;
          font-weight: bold;
          background-color: #f8f9fa;
        }

        .info-value {
          width: 60%;
        }

        .fee-section {
          width: 100%;
          border: 2px solid #000;
          border-collapse: collapse;
          margin-bottom: 10px;
        }

        .fee-section td {
          padding: 8px 10px;
          border: 1px solid #000;
        }

        .fee-label {
          width: 60%;
          font-weight: bold;
        }

        .fee-value {
          width: 40%;
          text-align: right;
          font-family: 'Courier New', monospace;
        }

        .total-row {
          background-color: #f8f9fa;
          font-weight: bold;
          font-size: 14px;
        }

        .total-row .fee-value {
          border-top: 2px double #000;
          padding-top: 10px;
        }

        .remarks-section {
          width: 100%;
          border: 2px solid #000;
          border-collapse: collapse;
          margin-bottom: 10px;
        }

        .remarks-section td {
          padding: 6px 10px;
          border: 1px solid #000;
        }

        .terms-section {
          width: 100%;
          border: 2px solid #000;
          padding: 10px;
          margin-bottom: 10px;
          font-size: 10px;
        }

        .terms-title {
          font-weight: bold;
          margin-bottom: 5px;
        }

        .terms-list {
          margin: 0;
          padding-left: 20px;
        }

        .terms-list li {
          margin-bottom: 3px;
        }

        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }

        .signature-box {
          width: 48%;
          text-align: center;
        }

        .signature-label {
          font-weight: bold;
          margin-bottom: 40px;
        }

        .action-buttons {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          display: flex;
          gap: 10px;
        }

        .action-button {
          padding: 12px 24px;
          border: 2px solid #000;
          background: white;
          color: #000;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .action-button:hover {
          background: #f0f0f0;
        }

        .action-button:active {
          background: #e0e0e0;
        }
      `}</style>

      <div className="action-buttons no-print">
        <button className="action-button" onClick={handleDownload}>
          <Download size={18} />
          Download Receipt
        </button>
        <button className="action-button" onClick={handlePrint}>
          <Printer size={18} />
          Print Receipt
        </button>
      </div>

      <div className="receipt-page">
        <ReceiptTemplate 
          data={receiptData} 
          isZica={isZica} 
        />
      </div>
    </>
  );
}
