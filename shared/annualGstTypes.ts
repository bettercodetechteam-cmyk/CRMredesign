export const DEFAULT_GST_RATE = 18;

export interface GstFeeRow {
  studentName: string;
  course: string;
  receiptNo: string;
  paidDate: string;
  amount: number;
  taxable: number;
  gst: number;
}

export interface GstMonthUpload {
  id: string;
  /** Calendar month in YYYY-MM form. */
  month: string;
  fileName: string;
  fileType: "excel" | "pdf";
  /** Link to the original uploaded file, when it was saved. */
  fileUrl?: string;
  fileSize?: number;
  rows: GstFeeRow[];
  totalAmount: number;
  totalTaxable: number;
  totalGst: number;
  gstFromFile: boolean;
  warnings: string[];
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface GstParseResult {
  rows: GstFeeRow[];
  gstFromFile: boolean;
  warnings: string[];
}
