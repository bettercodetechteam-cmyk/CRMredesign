export interface ProgressInput {
  plannedDate?: string | null;
  status?: string | null;
}

export interface ProgressSummary {
  completed: number;
  total: number;
  scheduleComplete: boolean;
  lessonsComplete: boolean;
  percent: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function todayInKolkata(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/** Calendar dates are shown as 14 Oct 2026, never as raw timestamps. */
export function formatCalendarDate(value?: string | null): string {
  if (!value) return "—";
  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return formatCalendarDate(todayInKolkata(parsed));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "—";
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || day < 1 || day > 31) return "—";
  return `${day} ${month} ${match[1]}`;
}

export function summarizeProgress(topics: ProgressInput[]): ProgressSummary {
  const total = topics.length;
  const completed = topics.filter((topic) => topic.status === "completed").length;
  const scheduleComplete = total > 0 && topics.every((topic) => Boolean(topic.plannedDate));
  const lessonsComplete =
    total > 0 &&
    topics.every(
      (topic) =>
        topic.status === "not_covered" ||
        topic.status === "partly_covered" ||
        topic.status === "completed"
    );
  const percent =
    total > 0 && scheduleComplete && lessonsComplete ? Math.round((completed / total) * 100) : null;
  return { completed, total, scheduleComplete, lessonsComplete, percent };
}

export function isOverdueTopic(
  plannedDate: string | null | undefined,
  status: string | null | undefined,
  today: string
): boolean {
  if (!plannedDate) return false;
  if (status === "completed") return false;
  return plannedDate < today;
}

export function displayLessonStatus(status?: string | null): string {
  if (status === "partly_covered") return "Partly covered";
  if (status === "completed") return "Covered";
  if (status === "not_covered") return "Incomplete";
  return "Not started";
}

/** Mobile-only logins use this address inside Firebase. People sign in with the number. */
export function phoneLoginEmail(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return "";
  return `${local}@phone.zicacrm.local`;
}

/** An email is used as typed. A 10-digit mobile number becomes its login address. */
export function loginEmailForContact(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return phoneLoginEmail(trimmed);
}

/** A student can respond only after the teacher records the topic as taught. */
export function feedbackAllowed(status?: string | null): boolean {
  return status === "not_covered" || status === "partly_covered" || status === "completed";
}
