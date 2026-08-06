/**
 * Serial numbers for table rows: contiguous descending with no gaps.
 * Example: 4 rows → 4, 3, 2, 1 (newest at top). New entry → count + 1.
 */

/** Values above this are treated as invalid (e.g. old Date.now() timestamps used as srNo). */
const MAX_REASONABLE_SERIAL = 500_000;

export function parseSerialNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const n = parseInt(cleaned.split(".")[0] || "0", 10);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_REASONABLE_SERIAL) return 0;
  return n;
}

function getItemTime(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function getMaxSerialNumber(items: unknown[], field = "srNo"): number {
  return items.length > 0 ? items.length : 0;
}

export function getNextSerialNumber(items: unknown[], _field = "srNo"): number {
  return items.length + 1;
}

/**
 * Sort by date (newest first), assign contiguous serials N…1 (no gaps).
 * Ignores stored srNo values so deleted rows never leave holes in the list.
 */
export function enrichWithSerialNumbers<T extends Record<string, unknown>>(
  items: T[],
  options: { field?: string; createdAtField?: string } = {}
): T[] {
  const field = options.field ?? "srNo";
  const createdAtField = options.createdAtField ?? "createdAt";

  const sorted = [...items].sort(
    (a, b) => getItemTime(b[createdAtField]) - getItemTime(a[createdAtField])
  );

  const total = sorted.length;
  return sorted.map((item, index) => ({
    ...item,
    [field]: total - index,
  })) as T[];
}

export function getNextSerialNumberFromItems<T extends Record<string, unknown>>(
  items: T[],
  _options?: { field?: string; createdAtField?: string }
): number {
  return items.length + 1;
}

export function sortBySerialDescending<T>(
  items: T[],
  field = "srNo",
  createdAtField = "createdAt"
): T[] {
  return enrichWithSerialNumbers(items as T[] & Record<string, unknown>[], {
    field,
    createdAtField,
  }) as T[];
}

/** Serial for a paginated row (global position, no gaps). */
export function getDisplaySerialNumber(
  totalCount: number,
  pageStartIndex: number,
  rowIndex: number
): number {
  return Math.max(1, totalCount - pageStartIndex - rowIndex);
}

/** Re-number 1…N in current list order (top = highest). Use after table sort. */
export function assignContiguousSerialsToOrderedList<T extends Record<string, unknown>>(
  items: T[],
  field = "srNo"
): T[] {
  const total = items.length;
  return items.map((item, index) => ({
    ...item,
    [field]: total - index,
  })) as T[];
}

export const DEFAULT_SERIAL_SORT = { key: "srNo" as const, direction: "desc" as const };
export const DEFAULT_DATE_SORT = { key: "createdAt" as const, direction: "desc" as const };
