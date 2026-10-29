import type { GstMonthUpload } from "@shared/annualGstTypes";

/** Indian financial year (April to March) start year for a YYYY-MM month. */
export function financialYearOf(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber >= 4 ? year : year - 1;
}

export function financialYearMonths(startYear: number): string[] {
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (3 + index) % 12;
    const year = index < 9 ? startYear : startYear + 1;
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  });
}

export function financialYearLabel(startYear: number): string {
  return `FY ${startYear}-${String(startYear + 1).slice(2)}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

export function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export interface CollectionTotal {
  key: string;
  files: number;
  amount: number;
}

function totalOf(key: string, uploads: GstMonthUpload[]): CollectionTotal {
  const amount = uploads.reduce((sum, upload) => sum + upload.totalAmount, 0);
  return { key, files: uploads.length, amount: Math.round(amount * 100) / 100 };
}

/** "financial" runs April to March; "calendar" runs January to December. */
export type YearMode = "financial" | "calendar";

export function yearOf(month: string, mode: YearMode): number {
  return mode === "financial" ? financialYearOf(month) : Number(month.slice(0, 4));
}

export function yearMonths(year: number, mode: YearMode): string[] {
  if (mode === "financial") return financialYearMonths(year);
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function yearLabel(year: number, mode: YearMode): string {
  return mode === "financial" ? financialYearLabel(year) : `Jan – Dec ${year}`;
}

/** Collection for each month of the given year. */
export function monthlyCollection(uploads: GstMonthUpload[], year: number, mode: YearMode): CollectionTotal[] {
  return yearMonths(year, mode).map((month) => totalOf(month, uploads.filter((upload) => upload.month === month)));
}

/** Collection for every year that has uploads, newest first. */
export function yearlyCollection(uploads: GstMonthUpload[], mode: YearMode): CollectionTotal[] {
  const years = [...new Set(uploads.map((upload) => yearOf(upload.month, mode)))].sort((a, b) => b - a);
  return years.map((year) => totalOf(String(year), uploads.filter((upload) => yearOf(upload.month, mode) === year)));
}

export function financialYearsWithData(uploads: GstMonthUpload[]): number[] {
  const years = new Set(uploads.map((upload) => financialYearOf(upload.month)));
  years.add(financialYearOf(currentMonth()));
  return [...years].sort((a, b) => b - a);
}
