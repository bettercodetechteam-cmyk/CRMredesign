import * as XLSX from "xlsx";
import { DEFAULT_GST_RATE, type GstFeeRow, type GstParseResult } from "../shared/annualGstTypes";

export class GstFileError extends Error {}

type Field = "studentName" | "course" | "receiptNo" | "paidDate" | "amount" | "taxable";

const FIELD_PATTERNS: Record<Field, RegExp[]> = {
  studentName: [/student\s*name/i, /^name$/i, /student/i, /name/i],
  course: [/course/i, /program/i],
  receiptNo: [/receipt/i, /invoice\s*(no|num)/i, /bill\s*(no|num)/i, /voucher/i],
  paidDate: [/paid\s*date/i, /payment\s*date/i, /receipt\s*date/i, /date/i],
  amount: [
    /fees?\s*paid/i, /paid\s*amount/i, /amount\s*paid/i, /received/i, /collected/i, /total\s*amount/i,
    /total\s*invoice/i, /invoice\s*(amount|value|total)/i, /net\s*amount/i, /amount/i, /paid/i,
  ],
  taxable: [/taxable/i, /base\s*amount/i, /basic\s*amount/i],
};

const NOT_AMOUNT = /balance|actual|discount|due|pending|taxable|basic|base|gst|tax|concession|structure|mode|date|installment|no\.?$/i;
const TOTAL_GST = /^(total\s*)?gst(\s*amount)?$/i;
const SPLIT_GST = /^(c|s|i)gst/i;
const MAX_ROWS = 2000;

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function money(value: unknown): number {
  const text = clean(value).replace(/₹|rs\.?|inr|,|\s/gi, "");
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function columnMap(header: string[]): Partial<Record<Field, number>> {
  const used = new Set<number>();
  const map: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(FIELD_PATTERNS) as Field[]) {
    for (const pattern of FIELD_PATTERNS[field]) {
      const index = header.findIndex((cell, i) =>
        !used.has(i) && pattern.test(cell) && (field !== "amount" || !NOT_AMOUNT.test(cell)) && (field !== "studentName" || !/parent|father|mother/i.test(cell)),
      );
      if (index >= 0) {
        map[field] = index;
        used.add(index);
        break;
      }
    }
  }
  return map;
}

function gstColumns(header: string[]): number[] {
  const total = header.findIndex((cell) => TOTAL_GST.test(cell));
  if (total >= 0) return [total];
  return header.flatMap((cell, index) => (SPLIT_GST.test(cell) && !/%|rate|gstin/i.test(cell) ? [index] : []));
}

function findHeader(rows: string[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let index = 0; index < limit; index += 1) {
    const map = columnMap(rows[index]);
    if (map.studentName !== undefined && map.amount !== undefined) return index;
  }
  return -1;
}

/** Turns a grid of cells into fee rows. GST is read from the file when present, else 18% inclusive. */
export function feeRowsFromGrid(grid: string[][]): GstParseResult {
  const rows = grid.map((row) => row.map(clean));
  const headerIndex = findHeader(rows);
  if (headerIndex < 0) {
    throw new GstFileError("Could not find a header row with a student name column and a fees paid / amount column.");
  }
  const header = rows[headerIndex];
  const map = columnMap(header);
  const gstCols = gstColumns(header);  const warnings: string[] = [];
  const result: GstFeeRow[] = [];
  const cell = (row: string[], field: Field) => (map[field] === undefined ? "" : row[map[field]!] ?? "");

  for (const row of rows.slice(headerIndex + 1)) {
    const studentName = cell(row, "studentName");
    const amount = money(cell(row, "amount"));
    if (!studentName || /^(grand\s*)?total/i.test(studentName) || amount <= 0) continue;
    const repeatedHeader = columnMap(row);
    if (repeatedHeader.studentName !== undefined && repeatedHeader.amount !== undefined) continue;
    const fileGst = gstCols.reduce((sum, index) => sum + money(row[index]), 0);
    const fileTaxable = money(cell(row, "taxable"));
    let gst: number;
    let taxable: number;
    if (gstCols.length > 0) {
      gst = fileGst;
      taxable = fileTaxable || amount - fileGst;
    } else if (fileTaxable > 0) {
      taxable = fileTaxable;
      gst = amount - fileTaxable;
    } else {
      taxable = (amount * 100) / (100 + DEFAULT_GST_RATE);
      gst = amount - taxable;
    }
    result.push({
      studentName,
      course: cell(row, "course"),
      receiptNo: cell(row, "receiptNo"),
      paidDate: cell(row, "paidDate").replace(/^\d{1,4}\s+(?=\d{1,2}[-/.])/, ""),
      amount: round2(amount),
      taxable: round2(taxable),
      gst: round2(gst),
    });
    if (result.length >= MAX_ROWS) {
      warnings.push(`Only the first ${MAX_ROWS} rows were read.`);
      break;
    }
  }
  if (result.length === 0) throw new GstFileError("No student rows with a paid amount were found in this file.");
  const gstFromFile = gstCols.length > 0 || map.taxable !== undefined;
  if (!gstFromFile) warnings.push(`No GST column found, so GST was worked out at ${DEFAULT_GST_RATE}% included in the paid amount.`);
  return { rows: result, gstFromFile, warnings };
}

function gridFromExcel(file: Buffer): string[][] {
  const workbook = XLSX.read(file, { type: "buffer", cellDates: false });
  const grids = workbook.SheetNames.map((name) =>
    XLSX.utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets[name], { header: 1, raw: false, defval: "" })
      .map((row) => row.map((value) => clean(value))),
  );
  return grids.find((grid) => findHeader(grid) >= 0) ?? grids[0] ?? [];
}

export async function parseGstFeeFile(file: Buffer, fileName: string): Promise<GstParseResult & { fileType: "excel" }> {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["xls", "xlsx", "csv"].includes(extension)) return { ...feeRowsFromGrid(gridFromExcel(file)), fileType: "excel" };
  throw new GstFileError("Upload an Excel file (.xlsx, .xls or .csv).");
}
