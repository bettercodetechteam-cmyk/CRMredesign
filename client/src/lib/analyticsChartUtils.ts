/** Categories hidden from analytics charts (catch-all buckets, not real segments). */
const EXCLUDED = new Set(["other", "unknown", "n/a", ""]);

export function isExcludedChartCategory(name: string | undefined | null): boolean {
  if (!name) return true;
  return EXCLUDED.has(name.trim().toLowerCase());
}

/** Returns trimmed label or null when empty / excluded. */
export function sanitizeChartCategory(value: string | undefined | null): string | null {
  const v = (value || "").trim();
  if (isExcludedChartCategory(v)) return null;
  return v;
}

export function excludeOtherFromChartData<T extends { name: string }>(data: T[]): T[] {
  return data.filter((d) => !isExcludedChartCategory(d.name));
}

export function aggregateCounts<T>(
  items: T[],
  getKey: (item: T) => string | undefined | null,
  options?: { limit?: number }
): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = sanitizeChartCategory(getKey(item) ?? null);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, options?.limit ?? 10)
    .map(([name, value]) => ({ name, value }));
}

/** Left margin width for horizontal category charts based on longest label. */
export function categoryAxisWidth(labels: string[]): number {
  if (labels.length === 0) return 120;
  const longest = labels.reduce((max, l) => Math.max(max, l.length), 0);
  return Math.min(240, Math.max(108, longest * 6.5 + 20));
}

export const chartTooltipStyle: Record<string, string | number> = {
  backgroundColor: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
  padding: "10px 14px",
};
