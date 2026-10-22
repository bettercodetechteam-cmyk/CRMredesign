import { auth } from "@/lib/firebase";
import type {
  BatchPlanDetail,
  BatchSummary,
  DashboardFilters,
  DashboardReport,
  MyClass,
  ParentProgress,
  ParentStudentCard,
  SyllabusAccess,
  SyllabusDetail,
  SyllabusDirectory,
  SyllabusMeta,
  SyllabusModule,
  SyllabusPdfPreview,
  StudentFeedbackNote,
  SyllabusRecord,
  TeachAgenda,
  TeachTopic,
} from "@shared/syllabusTypes";

async function authHeaders(): Promise<HeadersInit> {
  if (!auth?.currentUser) throw new Error("You must be signed in.");
  const token = await auth.currentUser.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...(await authHeaders()), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body.data as T;
}

function dashboardQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.course) params.set("course", filters.course);
  if (filters.batchId) params.set("batchId", filters.batchId);
  if (filters.facultyUid) params.set("facultyUid", filters.facultyUid);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const syllabusApi = {
  access: () => request<SyllabusAccess>("/api/syllabus/access"),
  meta: () => request<SyllabusMeta>("/api/syllabus/meta"),
  courseNames: () => request<string[]>("/api/syllabus/courses"),
  directory: () => request<SyllabusDirectory>("/api/syllabus/directory"),
  list: () => request<SyllabusRecord[]>("/api/syllabus"),
  get: (id: string) => request<SyllabusDetail>(`/api/syllabus/${id}`),
  courseFeedback: (id: string) => request<Record<string, StudentFeedbackNote[]>>(`/api/syllabus/${encodeURIComponent(id)}/feedback`),
  create: (courseName: string) =>
    request<SyllabusDetail>("/api/syllabus", { method: "POST", body: JSON.stringify({ courseName }) }),
  save: (id: string, modules: SyllabusModule[]) =>
    request<SyllabusDetail>(`/api/syllabus/${id}`, { method: "PUT", body: JSON.stringify({ modules }) }),
  publish: (id: string, effectiveDate?: string) =>
    request<SyllabusDetail>(`/api/syllabus/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ effectiveDate }),
    }),
  importPdf: async (id: string, file: File): Promise<SyllabusPdfPreview> => {
    if (!auth?.currentUser) throw new Error("You must be signed in.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Choose a file of 8 MB or less.");
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/syllabus/${encodeURIComponent(id)}/import-pdf?name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
      body: file,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
    return body.data as SyllabusPdfPreview;
  },
  removeDraft: (id: string) => request<{ deleted: boolean }>(`/api/syllabus/${id}`, { method: "DELETE" }),
  deleteVersion: (id: string, version: number) =>
    request<SyllabusDetail | null>(`/api/syllabus/${encodeURIComponent(id)}/versions/${version}`, { method: "DELETE" }),
  batches: () => request<BatchSummary[]>("/api/syllabus/batches"),
  batch: (batchId: string) => request<BatchPlanDetail>(`/api/syllabus/batches/${batchId}`),
  savePlan: (batchId: string, body: Record<string, unknown>) =>
    request<BatchPlanDetail>(`/api/syllabus/batches/${batchId}/plan`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  saveSchedule: (batchId: string, body: Record<string, unknown>) =>
    request<BatchPlanDetail>(`/api/syllabus/batches/${batchId}/schedule`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  teach: () => request<TeachAgenda>("/api/syllabus/teach"),
  saveLesson: (body: Record<string, unknown>) =>
    request<TeachTopic>("/api/syllabus/lessons", { method: "PUT", body: JSON.stringify(body) }),
  myClass: () => request<MyClass>("/api/syllabus/my-class"),
  saveFeedback: (body: Record<string, unknown>) =>
    request<{ saved: boolean }>("/api/syllabus/feedback", { method: "PUT", body: JSON.stringify(body) }),
  parentHome: () => request<ParentStudentCard[]>("/api/syllabus/progress"),
  parentProgress: (studentId: string) => request<ParentProgress>(`/api/syllabus/progress/${encodeURIComponent(studentId)}`),
  dashboard: (filters: DashboardFilters) => request<DashboardReport>(`/api/syllabus/dashboard${dashboardQuery(filters)}`),
  linkParent: (body: { studentId: string; email: string }) =>
    request<{ linked: boolean; message: string }>("/api/syllabus/parents/link", { method: "POST", body: JSON.stringify(body) }),
  unlinkParent: (body: { studentId: string; email: string }) =>
    request<{ unlinked: boolean }>("/api/syllabus/parents/unlink", { method: "POST", body: JSON.stringify(body) }),
  enrollStudent: (body: { studentId: string; email?: string; phone?: string; parentPhone?: string; course: string }) =>
    request<{ linked: boolean; message: string }>("/api/syllabus/students/enroll", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  linkStudent: (body: { studentId: string; email: string; syllabusBatchId?: string }) =>
    request<{ linked: boolean; message: string }>("/api/syllabus/students/link", { method: "POST", body: JSON.stringify(body) }),
  unlinkStudent: (studentId: string) =>
    request<{ unlinked: boolean }>("/api/syllabus/students/unlink", {
      method: "POST",
      body: JSON.stringify({ studentId }),
    }),
  setCentreHeadEdit: (uid: string, canEdit: boolean) =>
    request<{ canEditSyllabus: boolean }>(`/api/syllabus/centre-heads/${uid}/edit`, {
      method: "PUT",
      body: JSON.stringify({ canEdit }),
    }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
