/**
 * Institute Syllabus Tracker
 *
 * Collections added: syllabi, syllabusVersions, batchPlans, topicSchedules,
 * lessonUpdates, topicFeedback, parentLinks.
 * Existing student documents also receive studentUid and syllabusBatchId.
 * Those two fields are written only by this service. batchEntriesData is
 * read to resolve batch ids and course names, and is never rewritten.
 *
 * Single-field lookups use automatic indexes. Composite indexes for
 * A course version moves draft -> submitted -> approved -> published.
 * Faculty can draft and submit. Only a director or academic head can approve and publish.
 * Older documents stay draft or published. Submitted and approved are stored on the version.
 *
 * syllabi (centreId + courseName), syllabusVersions (syllabusId + status),
 * topicFeedback (batchId + topicId), and batchPlans (centreId + facultyUid)
 * are in firestore.indexes.json.
 *
 * Deploy rules and indexes before use:
 * firebase deploy --only firestore:rules,firestore:indexes
 */
import { randomUUID } from "crypto";
import { SyllabusPdfError } from "../syllabusPdf";
import { extractSyllabusFile } from "../syllabusOffice";
import type { Firestore } from "firebase-admin/firestore";
import type { AuthCaller } from "../middleware/requireAuth";
import {
  canAccess,
  normalizeRole,
  resolvePermissions,
  type ModulePermission,
} from "../../shared/permissions";
import {
  isCalendarDate,
  isOverdueTopic,
  summarizeProgress,
  todayInKolkata,
  displayLessonStatus,
  phoneLoginEmail,
} from "../../shared/syllabusLogic";
import { readSyllabusStatus } from "../../shared/courseSetup";
import type {
  BatchPlanDetail,
  BatchSummary,
  DashboardFilters,
  DashboardReport,
  DashboardTopicRow,
  DirectoryUser,
  FacultyOption,
  LessonStatus,
  MyClass,
  ParentCourse,
  ParentProgress,
  ParentStudentCard,
  ParentTopic,
  ParentTopicStatus,
  PlanHistoryEntry,
  ProgressGroup,
  ScheduleHistoryEntry,
  SyllabusAccess,
  SyllabusDetail,
  SyllabusDirectory,
  SyllabusMeta,
  SyllabusModule,
  SyllabusPdfPreview,
  SyllabusPdfWarning,
  SyllabusRecord,
  SyllabusTopic,
  StudentFeedbackNote,
  SyllabusVersion,
  TeachAgenda,
  TeachTopic,
  TopicScheduleView,
  Understanding,
} from "../../shared/syllabusTypes";

export class SyllabusError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SyllabusError";
    this.status = status;
  }
}

const LESSON_STATUSES = new Set(["not_covered", "partly_covered", "completed"]);
const UNDERSTANDING = new Set(["understood", "partly_understood", "need_help"]);
const NON_CONVERTIBLE = new Set([
  "director",
  "academic_head",
  "faculty",
  "centre_head",
  "accounting",
  "digital_marketing",
  "bdm",
  "marketing",
  "admin",
  "designer",
]);

type DocData = Record<string, unknown>;

interface BatchRecord {
  id: string;
  name: string;
  course: string;
  teacherName: string;
  startDate: string;
  endDate: string;
}

interface FlatTopic {
  batchId: string;
  batchName: string;
  courseName: string;
  moduleTitle: string;
  moduleOrder: number;
  topicId: string;
  topicTitle: string;
  topicOrder: number;
  plannedDate: string;
  status: LessonStatus | null;
  facultyName: string;
  teacherUid: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parentTopicStatus(status: LessonStatus | null): ParentTopicStatus {
  if (status === "completed") return "covered";
  if (status === "partly_covered") return "partly_covered";
  if (status === "not_covered") return "incomplete";
  return "not_started";
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function personName(data: DocData): string {
  const combined = [text(data.firstName) || text(data.leadName) || text(data.name), text(data.lastName)]
    .filter(Boolean)
    .join(" ");
  return combined || text(data.email) || "Unnamed";
}

function calendar(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    if (match) return match[1];
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : todayInKolkata(parsed);
  }
  if (value instanceof Date) return todayInKolkata(value);
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? todayInKolkata(date) : "";
  }
  return "";
}

function requireDate(value: unknown, label: string): string {
  const date = text(value);
  if (!isCalendarDate(date)) {
    throw new SyllabusError(`${label} must be a calendar date.`, 400);
  }
  return date;
}

function optionalDate(value: unknown, label: string): string {
  if (value === undefined || value === null || value === "") return "";
  return requireDate(value, label);
}

function centreOf(profile: DocData): string {
  return text(profile.centreId) || "default-centre";
}

function permissionList(value: unknown): ModulePermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ModulePermission => typeof item === "string");
}

function versionDocId(syllabusId: string, version: number): string {
  return `${syllabusId}_v${version}`;
}

function scheduleDocId(batchId: string, topicId: string): string {
  return `${batchId}_${topicId}`;
}

function feedbackDocId(batchId: string, topicId: string, studentId: string): string {
  return `${batchId}_${topicId}_${studentId}`;
}

function assertId(value: string, label: string): string {
  const id = value.trim();
  if (!id || id.includes("/")) throw new SyllabusError(`${label} is invalid.`, 400);
  return id;
}

function readModules(value: unknown): SyllabusModule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const module = (item ?? {}) as DocData;
      const topics = Array.isArray(module.topics) ? module.topics : [];
      const weekLabel = text(module.weekLabel);
      return {
        id: text(module.id),
        title: text(module.title),
        displayOrder: Number(module.displayOrder ?? 0),
        ...(weekLabel ? { weekLabel } : {}),
        topics: topics
          .map((topic) => {
            const row = (topic ?? {}) as DocData;
            return {
              id: text(row.id),
              title: text(row.title),
              description: text(row.description),
              displayOrder: Number(row.displayOrder ?? 0),
              estimatedMinutes: typeof row.estimatedMinutes === "number" ? row.estimatedMinutes : null,
            };
          })
          .sort((a, b) => a.displayOrder - b.displayOrder),
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function sanitizeModules(value: unknown): SyllabusModule[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new SyllabusError("Add at least one module.", 400);
  }
  if (value.length > 40) throw new SyllabusError("A syllabus can have at most 40 modules.", 400);
  return value.map((item, moduleIndex) => {
    const module = (item ?? {}) as DocData;
    const title = text(module.title);
    if (!title) throw new SyllabusError("Every module needs a title.", 400);
    if (title.length > 200) throw new SyllabusError("Module titles must be 200 characters or fewer.", 400);
    const topicsIn = Array.isArray(module.topics) ? module.topics : [];
    if (topicsIn.length === 0) {
      throw new SyllabusError(`Add at least one topic to "${title}".`, 400);
    }
    if (topicsIn.length > 80) throw new SyllabusError(`"${title}" has too many topics.`, 400);
    const weekLabel = text(module.weekLabel).replace(/\s+/g, " ").slice(0, 80);
    const topics: SyllabusTopic[] = topicsIn.map((topic, topicIndex) => {
      const row = (topic ?? {}) as DocData;
      const topicTitle = text(row.title);
      if (!topicTitle) throw new SyllabusError(`Every topic in "${title}" needs a title.`, 400);
      if (topicTitle.length > 200) throw new SyllabusError("Topic titles must be 200 characters or fewer.", 400);
      let estimatedMinutes: number | null = null;
      if (row.estimatedMinutes !== undefined && row.estimatedMinutes !== null && row.estimatedMinutes !== "") {
        const minutes = Number(row.estimatedMinutes);
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 600) {
          throw new SyllabusError("Estimated minutes must be a whole number from 0 to 600.", 400);
        }
        estimatedMinutes = minutes;
      }
      const description = text(row.description);
      if (description.length > 2000) throw new SyllabusError("Topic descriptions must be 2000 characters or fewer.", 400);
      return {
        id: /^[A-Za-z0-9_-]{8,80}$/.test(text(row.id)) ? text(row.id) : randomUUID(),
        title: topicTitle,
        description,
        displayOrder: Number.isFinite(Number(row.displayOrder)) ? Number(row.displayOrder) : topicIndex + 1,
        estimatedMinutes,
      };
    });
    return {
      id: /^[A-Za-z0-9_-]{8,80}$/.test(text(module.id)) ? text(module.id) : randomUUID(),
      title,
      displayOrder: Number.isFinite(Number(module.displayOrder)) ? Number(module.displayOrder) : moduleIndex + 1,
      ...(weekLabel ? { weekLabel } : {}),
      topics,
    };
  });
}

function lessonStatus(value: unknown): LessonStatus | null {
  return LESSON_STATUSES.has(String(value)) ? (value as LessonStatus) : null;
}

export class SyllabusService {
  constructor(private db: Firestore) {}

  async access(caller: AuthCaller): Promise<SyllabusAccess> {
    const profile = await this.profile(caller);
    this.assertModule(caller, profile);
    const role = normalizeRole(text(profile.role) || caller.role);
    const canAuthor = this.canAuthor(caller, profile);
    return {
      role,
      canAuthor,
      canEditSyllabus: canAuthor,
      canReview: this.isReviewer(caller, profile),
      canCoordinate: this.isCoordinator(caller),
      canTeach: role === "faculty",
      canSubmitFeedback: role === "student",
      canViewParentProgress: role === "parent",
      canLinkAccounts: this.canLink(caller),
      canGrantEdit: caller.isDirector,
    };
  }

  async courseNames(caller: AuthCaller): Promise<string[]> {
    const ctx = await this.context(caller);
    this.assertStaff(caller, ctx.profile);
    const snap = await this.db.collection("syllabi").where("centreId", "==", ctx.centreId).get();
    return [...new Set(snap.docs.map((docSnap) => text(docSnap.data().courseName)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  async meta(caller: AuthCaller): Promise<SyllabusMeta> {
    const { centreId } = await this.coordinatorContext(caller);
    const syllabiSnap = await this.db.collection("syllabi").where("centreId", "==", centreId).get();
    const courses = [...new Set(syllabiSnap.docs.map((docSnap) => text(docSnap.data().courseName)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    const batches = await this.listBatchRecords(centreId);
    return {
      courses,
      faculty: await this.facultyOptions(),
      batches: batches.map((batch) => ({ id: batch.id, name: batch.name, course: batch.course })),
    };
  }

  async listSyllabi(caller: AuthCaller): Promise<SyllabusRecord[]> {
    const { centreId } = await this.readerContext(caller);
    const [syllabiSnap, plans, batches] = await Promise.all([
      this.db.collection("syllabi").where("centreId", "==", centreId).get(),
      this.plansForCentre(centreId),
      this.listBatchRecords(centreId),
    ]);
    const batchNames = new Map(batches.map((batch) => [batch.id, batch.name]));
    const records = await Promise.all(
      syllabiSnap.docs.map(async (docSnap) => this.toSyllabusRecord(docSnap.id, docSnap.data(), plans, batchNames))
    );
    return records.sort((a, b) => a.courseName.localeCompare(b.courseName));
  }

  async getSyllabus(caller: AuthCaller, syllabusId: string): Promise<SyllabusDetail> {
    const { centreId } = await this.readerContext(caller);
    return this.loadSyllabusDetail(assertId(syllabusId, "Syllabus"), centreId);
  }

  async courseFeedback(caller: AuthCaller, syllabusIdRaw: string): Promise<Record<string, StudentFeedbackNote[]>> {
    const { profile, centreId } = await this.context(caller);
    this.assertModule(caller, profile);
    const role = normalizeRole(text(profile.role) || caller.role);
    if (role === "student" || role === "parent") {
      throw new SyllabusError("Only staff on this course can see student feedback.", 403);
    }
    if (!this.isCoordinator(caller) && role !== "faculty" && !this.canEdit(caller, profile)) {
      throw new SyllabusError("Only staff on this course can see student feedback.", 403);
    }
    const syllabusId = assertId(syllabusIdRaw, "Syllabus");
    const syllabus = await this.db.collection("syllabi").doc(syllabusId).get();
    if (!syllabus.exists || text(syllabus.data()?.centreId) !== centreId) {
      throw new SyllabusError("Syllabus not found.", 404);
    }
    const plans = (await this.plansForCentre(centreId)).filter((plan) => plan.syllabusId === syllabusId);
    const visible = this.isCoordinator(caller) || this.canEdit(caller, profile)
      ? plans
      : plans.filter((plan) => plan.facultyUid === caller.id);
    const grouped = await this.feedbackByTopic(visible.map((plan) => plan.batchId));
    const byTopic: Record<string, StudentFeedbackNote[]> = {};
    Object.entries(grouped).forEach(([key, notes]) => {
      const topicId = key.split("::")[1] || "";
      if (!topicId) return;
      byTopic[topicId] = [...(byTopic[topicId] ?? []), ...notes];
    });
    return byTopic;
  }

  async createSyllabus(caller: AuthCaller, body: DocData): Promise<SyllabusDetail> {
    const { centreId } = await this.editorContext(caller);
    const courseName = text(body.courseName);
    if (!courseName) throw new SyllabusError("Type a course name.", 400);
    if (courseName.length > 80) throw new SyllabusError("Course names must be 80 characters or fewer.", 400);
    const modules = Array.isArray(body.modules) && body.modules.length > 0 ? sanitizeModules(body.modules) : [];
    const ref = this.db.collection("syllabi").doc();
    const versionRef = this.db.collection("syllabusVersions").doc(versionDocId(ref.id, 1));
    const now = new Date().toISOString();
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(this.db.collection("syllabi").where("centreId", "==", centreId));
      if (existing.docs.some((docSnap) => text(docSnap.data().courseName).toLowerCase() === courseName.toLowerCase())) {
        throw new SyllabusError("A syllabus already exists for this course.", 409);
      }
      transaction.create(ref, {
        courseName,
        status: "draft",
        currentVersion: 0,
        createdBy: caller.id,
        updatedAt: now,
        createdAt: now,
        centreId,
      });
      transaction.create(versionRef, {
        syllabusId: ref.id,
        version: 1,
        status: "draft",
        modules,
        createdBy: caller.id,
        createdAt: now,
      });
    });
    return this.loadSyllabusDetail(ref.id, centreId);
  }

  async updateSyllabus(caller: AuthCaller, syllabusId: string, body: DocData): Promise<SyllabusDetail> {
    const { centreId, profile } = await this.editorContext(caller);
    const id = assertId(syllabusId, "Syllabus");
    const syllabus = await this.requireSyllabus(id, centreId);
    const modules = sanitizeModules(body.modules);
    const versions = await this.versionsFor(id);
    const draft = versions.find((version) => version.status !== "published");
    if (draft && draft.status !== "draft" && !this.isReviewer(caller, profile)) {
      throw new SyllabusError("This course is in review. Withdraw the submission before editing it.", 403);
    }
    const now = new Date().toISOString();
    if (draft) {
      await this.db.collection("syllabusVersions").doc(draft.id).update({ modules, createdBy: caller.id });
    } else {
      const next = Math.max(syllabus.currentVersion, 0) + 1;
      await this.db.collection("syllabusVersions").doc(versionDocId(id, next)).set({
        syllabusId: id,
        version: next,
        status: "draft",
        modules,
        createdBy: caller.id,
        createdAt: now,
      });
    }
    await this.db.collection("syllabi").doc(id).update({ updatedAt: now });
    return this.loadSyllabusDetail(id, centreId);
  }

  /** Creates or updates one course from the syllabus title inside a file. Saves a draft and does not publish. */
  async importCourseFile(
    caller: AuthCaller,
    file: Buffer,
    fileName = "",
    preferredName = "",
  ): Promise<{ syllabus: SyllabusDetail; warnings: SyllabusPdfWarning[]; unimported: SyllabusPdfWarning[]; created: boolean }> {
    const { centreId } = await this.editorContext(caller);
    if (!file.length) throw new SyllabusError("Upload a PDF, Word, or Excel file.", 400);
    let preview: SyllabusPdfPreview;
    try {
      preview = await extractSyllabusFile(file, fileName);
    } catch (error) {
      if (error instanceof SyllabusPdfError) throw new SyllabusError(error.message, 400);
      throw new SyllabusError("This file could not be read. Use a PDF, Word, or Excel syllabus table and try again.", 400);
    }
    const courseName = (text(preferredName) || text(preview.courseName)).slice(0, 80);
    if (!courseName) throw new SyllabusError("This file has no course name. Type a course name, then upload it.", 400);
    const existing = await this.syllabusByCourse(centreId, courseName);
    const created = !existing;
    const id = existing?.id ?? (await this.createSyllabus(caller, { courseName })).id;
    const syllabus = await this.updateSyllabus(caller, id, { modules: preview.modules });
    return { syllabus, warnings: preview.warnings, unimported: preview.unimported, created };
  }

  /** Reads a syllabus file for the setup preview. It does not save or publish. */
  async previewFile(caller: AuthCaller, file: Buffer, fileName = ""): Promise<SyllabusPdfPreview> {
    await this.editorContext(caller);
    if (!file.length) throw new SyllabusError("Upload a PDF, Word, or Excel file.", 400);
    try {
      return await extractSyllabusFile(file, fileName);
    } catch (error) {
      if (error instanceof SyllabusPdfError) throw new SyllabusError(error.message, 400);
      throw new SyllabusError("This file could not be read. Use a PDF, Word, or Excel syllabus table and try again.", 400);
    }
  }

  /** Reads a PDF, Word, or Excel file into modules for the editor. Does not save or publish. */
  async previewPdf(caller: AuthCaller, syllabusId: string, file: Buffer, fileName = ""): Promise<SyllabusPdfPreview> {
    const { centreId } = await this.editorContext(caller);
    await this.requireSyllabus(assertId(syllabusId, "Syllabus"), centreId);
    if (!file.length) throw new SyllabusError("Upload a PDF, Word, or Excel file.", 400);
    try {
      return await extractSyllabusFile(file, fileName);
    } catch (error) {
      if (error instanceof SyllabusPdfError) throw new SyllabusError(error.message, 400);
      throw new SyllabusError("This file could not be read. Use a PDF, Word, or Excel syllabus table and try again.", 400);
    }
  }

  async submitSyllabus(caller: AuthCaller, syllabusId: string): Promise<SyllabusDetail> {
    const { id, centreId, open } = await this.workingCopy(caller, syllabusId, "author");
    if (open.status !== "draft") throw new SyllabusError("Only a draft can be submitted for review.", 400);
    this.assertTopics(open.modules);
    const now = new Date().toISOString();
    await this.db.collection("syllabusVersions").doc(open.id).update({
      status: "submitted",
      submittedAt: now,
      submittedBy: caller.id,
      reviewNote: "",
    });
    await this.db.collection("syllabi").doc(id).update({ updatedAt: now });
    return this.loadSyllabusDetail(id, centreId);
  }

  async approveSyllabus(caller: AuthCaller, syllabusId: string): Promise<SyllabusDetail> {
    const { id, centreId, open } = await this.workingCopy(caller, syllabusId, "reviewer");
    if (open.status !== "submitted") throw new SyllabusError("Submit the course before approving it.", 400);
    this.assertTopics(open.modules);
    const now = new Date().toISOString();
    await this.db.collection("syllabusVersions").doc(open.id).update({
      status: "approved",
      approvedAt: now,
      approvedBy: caller.id,
    });
    await this.db.collection("syllabi").doc(id).update({ updatedAt: now });
    return this.loadSyllabusDetail(id, centreId);
  }

  async withdrawSyllabus(caller: AuthCaller, syllabusId: string, body: DocData): Promise<SyllabusDetail> {
    const { profile, centreId } = await this.context(caller);
    this.assertModule(caller, profile);
    const reviewer = this.isReviewer(caller, profile);
    if (!this.canAuthor(caller, profile) && !reviewer) {
      throw new SyllabusError("You cannot change this course.", 403);
    }
    const id = assertId(syllabusId, "Syllabus");
    await this.requireSyllabus(id, centreId);
    const open = (await this.versionsFor(id)).find((version) => version.status !== "published");
    if (!open || (open.status !== "submitted" && open.status !== "approved")) {
      throw new SyllabusError("Only a submitted or approved course can return to draft.", 400);
    }
    if (open.status === "approved" && !reviewer) {
      throw new SyllabusError("An approved course can be returned by a director or academic head.", 403);
    }
    const note = text(body.note).slice(0, 500);
    const now = new Date().toISOString();
    await this.db.collection("syllabusVersions").doc(open.id).update({
      status: "draft",
      reviewNote: note,
    });
    await this.db.collection("syllabi").doc(id).update({ updatedAt: now });
    return this.loadSyllabusDetail(id, centreId);
  }

  async publishSyllabus(caller: AuthCaller, syllabusId: string, body: DocData): Promise<SyllabusDetail> {
    const { centreId } = await this.reviewerContext(caller);
    const id = assertId(syllabusId, "Syllabus");
    await this.requireSyllabus(id, centreId);
    const versions = await this.versionsFor(id);
    const draft = versions.find((version) => version.status === "approved");
    if (!draft) throw new SyllabusError("Approve the course before publishing it.", 400);
    if (draft.modules.length === 0 || draft.modules.every((module) => module.topics.length === 0)) {
      throw new SyllabusError("Add at least one module with a topic before publishing.", 400);
    }
    const effectiveDate = text(body.effectiveDate)
      ? requireDate(body.effectiveDate, "Effective date")
      : todayInKolkata();
    const now = new Date().toISOString();
    const batch = this.db.batch();
    batch.update(this.db.collection("syllabusVersions").doc(draft.id), {
      status: "published",
      effectiveDate,
    });
    batch.update(this.db.collection("syllabi").doc(id), {
      status: "published",
      currentVersion: draft.version,
      updatedAt: now,
    });
    await batch.commit();
    return this.loadSyllabusDetail(id, centreId);
  }

  async deleteDraftSyllabus(caller: AuthCaller, syllabusId: string): Promise<{ deleted: boolean }> {
    const { centreId, profile } = await this.editorContext(caller);
    const id = assertId(syllabusId, "Syllabus");
    const syllabus = await this.requireSyllabus(id, centreId);
    const open = (await this.versionsFor(id)).find((version) => version.status !== "published");
    if (open?.status === "approved" && !this.isReviewer(caller, profile)) {
      throw new SyllabusError("An approved course can only be removed by a director or academic head.", 403);
    }
    if (syllabus.currentVersion > 0) {
      throw new SyllabusError("A published syllabus cannot be deleted. Edit it to create the next version.", 400);
    }
    const plans = await this.plansForCentre(centreId);
    if (plans.some((plan) => plan.syllabusId === id)) {
      throw new SyllabusError("This syllabus is pinned to a batch.", 400);
    }
    const versions = await this.db.collection("syllabusVersions").where("syllabusId", "==", id).get();
    const batch = this.db.batch();
    versions.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    batch.delete(this.db.collection("syllabi").doc(id));
    await batch.commit();
    return { deleted: true };
  }

  async deleteVersion(caller: AuthCaller, syllabusIdRaw: string, versionRaw: string): Promise<SyllabusDetail | null> {
    const { centreId } = await this.reviewerContext(caller);
    const id = assertId(syllabusIdRaw, "Syllabus");
    const versionNumber = Number(versionRaw);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw new SyllabusError("Choose a version to delete.", 400);
    }
    await this.requireSyllabus(id, centreId);
    const versions = await this.versionsFor(id);
    const target = versions.find((version) => version.version === versionNumber);
    if (!target) throw new SyllabusError("That version was not found.", 404);

    const remaining = versions.filter((version) => version.version !== versionNumber);
    const latestPublished = remaining
      .filter((version) => version.status === "published")
      .sort((a, b) => b.version - a.version)[0];
    const pinned = target.status === "published"
      ? (await this.plansForCentre(centreId)).filter((plan) => plan.syllabusId === id && plan.syllabusVersion === versionNumber)
      : [];
    const names = pinned.length > 0 && latestPublished ? await this.userNames() : new Map<string, string>();
    const planSnaps = latestPublished
      ? await Promise.all(pinned.map((plan) => this.db.collection("batchPlans").doc(plan.batchId).get()))
      : [];
    const now = new Date().toISOString();
    const write = this.db.batch();
    write.delete(this.db.collection("syllabusVersions").doc(versionDocId(id, versionNumber)));

    if (remaining.length === 0) {
      pinned.forEach((plan) => write.delete(this.db.collection("batchPlans").doc(plan.batchId)));
      write.delete(this.db.collection("syllabi").doc(id));
      await write.commit();
      return null;
    }

    const open = remaining.find((version) => version.status !== "published");
    write.update(this.db.collection("syllabi").doc(id), {
      status: latestPublished ? "published" : (open?.status ?? "draft"),
      currentVersion: latestPublished?.version ?? 0,
      updatedAt: now,
    });
    if (latestPublished) {
      planSnaps.forEach((snap) => {
        if (!snap.exists) return;
        const history = Array.isArray(snap.data()?.planHistory) ? [...(snap.data()?.planHistory as PlanHistoryEntry[])] : [];
        history.push({
          at: now,
          byUid: caller.id,
          byName: names.get(caller.id) || "Coordinator",
          fromVersion: versionNumber,
          toVersion: latestPublished.version,
          fromSyllabusId: id,
          toSyllabusId: id,
        });
        write.update(snap.ref, { syllabusVersion: latestPublished.version, planHistory: history, updatedAt: now });
      });
    } else {
      pinned.forEach((plan) => write.delete(this.db.collection("batchPlans").doc(plan.batchId)));
    }
    await write.commit();
    return this.loadSyllabusDetail(id, centreId);
  }

  async listBatches(caller: AuthCaller): Promise<BatchSummary[]> {
    const { centreId } = await this.coordinatorContext(caller);
    const [batches, plans, names] = await Promise.all([
      this.listBatchRecords(centreId),
      this.plansForCentre(centreId),
      this.userNames(),
    ]);
    const planMap = new Map(plans.map((plan) => [plan.batchId, plan]));
    const summaries: BatchSummary[] = [];
    for (const batch of batches) {
      const plan = planMap.get(batch.id);
      let currentPublishedVersion: number | null = null;
      if (plan) {
        const syllabus = await this.db.collection("syllabi").doc(plan.syllabusId).get();
        currentPublishedVersion = syllabus.exists ? Number(syllabus.data()?.currentVersion ?? 0) : null;
      }
      summaries.push({
        ...batch,
        plan: plan
          ? {
              syllabusId: plan.syllabusId,
              syllabusVersion: plan.syllabusVersion,
              facultyUid: plan.facultyUid,
              facultyName: names.get(plan.facultyUid) || "Unassigned",
              startDate: plan.startDate,
              targetCompletionDate: plan.targetCompletionDate,
              currentPublishedVersion,
            }
          : null,
      });
    }
    return summaries;
  }

  async getBatchPlan(caller: AuthCaller, batchId: string): Promise<BatchPlanDetail> {
    const { centreId } = await this.coordinatorContext(caller);
    return this.buildBatchDetail(centreId, assertId(batchId, "Batch"));
  }

  async saveBatchPlan(caller: AuthCaller, batchId: string, body: DocData): Promise<BatchPlanDetail> {
    const { centreId } = await this.coordinatorContext(caller);
    const id = assertId(batchId, "Batch");
    const batchRecord = await this.requireBatch(centreId, id);
    if (!batchRecord.course) {
      throw new SyllabusError("This batch has no course name, so a syllabus cannot be pinned.", 400);
    }
    const syllabusId = assertId(text(body.syllabusId), "Syllabus");
    const syllabusVersion = Number(body.syllabusVersion);
    if (!Number.isInteger(syllabusVersion) || syllabusVersion < 1) {
      throw new SyllabusError("Choose a published syllabus version.", 400);
    }
    const syllabus = await this.requireSyllabus(syllabusId, centreId);
    if (syllabus.courseName !== batchRecord.course) {
      throw new SyllabusError("The syllabus course must match this batch's course.", 400);
    }
    const versionSnap = await this.db.collection("syllabusVersions").doc(versionDocId(syllabusId, syllabusVersion)).get();
    if (!versionSnap.exists || versionSnap.data()?.status !== "published") {
      throw new SyllabusError("Only a published version can be pinned. Published versions are not edited in place.", 400);
    }
    const facultyUid = assertId(text(body.facultyUid), "Faculty");
    await this.requireFaculty(facultyUid);
    const startDate = requireDate(body.startDate, "Start date");
    const targetCompletionDate = requireDate(body.targetCompletionDate, "Target completion date");
    if (targetCompletionDate < startDate) {
      throw new SyllabusError("The target completion date must be on or after the start date.", 400);
    }
    const ref = this.db.collection("batchPlans").doc(id);
    const existingSnap = await ref.get();
    const now = new Date().toISOString();
    const names = await this.userNames();
    const history: PlanHistoryEntry[] = existingSnap.exists && Array.isArray(existingSnap.data()?.planHistory)
      ? (existingSnap.data()?.planHistory as PlanHistoryEntry[])
      : [];
    const previousVersion = existingSnap.exists ? Number(existingSnap.data()?.syllabusVersion ?? 0) : null;
    const previousSyllabus = existingSnap.exists ? text(existingSnap.data()?.syllabusId) : "";
    if (!existingSnap.exists || previousVersion !== syllabusVersion || previousSyllabus !== syllabusId) {
      history.push({
        at: now,
        byUid: caller.id,
        byName: names.get(caller.id) || "Coordinator",
        fromVersion: existingSnap.exists ? previousVersion : null,
        toVersion: syllabusVersion,
        fromSyllabusId: existingSnap.exists ? previousSyllabus : null,
        toSyllabusId: syllabusId,
      });
    }
    const teacherUids = existingSnap.exists && Array.isArray(existingSnap.data()?.teacherUids)
      ? (existingSnap.data()?.teacherUids as string[])
      : [];
    await ref.set({
      batchId: id,
      courseName: batchRecord.course,
      syllabusId,
      syllabusVersion,
      facultyUid,
      startDate,
      targetCompletionDate,
      centreId,
      teacherUids: [...new Set([...teacherUids, facultyUid])],
      planHistory: history,
      createdBy: existingSnap.exists ? text(existingSnap.data()?.createdBy) || caller.id : caller.id,
      updatedAt: now,
    });
    await this.refreshTeacherUids(id, facultyUid);
    return this.buildBatchDetail(centreId, id);
  }

  async saveSchedule(caller: AuthCaller, batchId: string, body: DocData): Promise<BatchPlanDetail> {
    const { centreId } = await this.coordinatorContext(caller);
    const id = assertId(batchId, "Batch");
    const planSnap = await this.db.collection("batchPlans").doc(id).get();
    if (!planSnap.exists || text(planSnap.data()?.centreId) !== centreId) {
      throw new SyllabusError("Assign a syllabus version to this batch before scheduling topics.", 400);
    }
    const plan = planSnap.data() as DocData;
    const topicId = assertId(text(body.topicId), "Topic");
    const moduleId = assertId(text(body.moduleId), "Module");
    const version = await this.versionData(text(plan.syllabusId), Number(plan.syllabusVersion));
    const module = version.modules.find((item) => item.id === moduleId);
    const topic = module?.topics.find((item) => item.id === topicId);
    if (!topic) throw new SyllabusError("That topic is not on the pinned syllabus version.", 400);
    const plannedDate = requireDate(body.plannedDate, "Planned date");
    const teacherUid = assertId(text(body.teacherUid), "Teacher");
    await this.requireFaculty(teacherUid);
    const ref = this.db.collection("topicSchedules").doc(scheduleDocId(id, topicId));
    const existingSnap = await ref.get();
    const now = new Date().toISOString();
    const names = await this.userNames();
    const history: ScheduleHistoryEntry[] =
      existingSnap.exists && Array.isArray(existingSnap.data()?.scheduleHistory)
        ? [...(existingSnap.data()?.scheduleHistory as ScheduleHistoryEntry[])]
        : [];
    let originalPlannedDate = plannedDate;
    if (existingSnap.exists) {
      const previous = existingSnap.data() as DocData;
      originalPlannedDate = text(previous.originalPlannedDate) || text(previous.plannedDate) || plannedDate;
      const fromDate = text(previous.plannedDate);
      const fromTeacher = text(previous.teacherUid);
      if (fromDate !== plannedDate || fromTeacher !== teacherUid) {
        history.push({
          at: now,
          byUid: caller.id,
          byName: names.get(caller.id) || "Coordinator",
          fromDate,
          toDate: plannedDate,
          fromTeacherUid: fromTeacher,
          toTeacherUid: teacherUid,
        });
      }
    }
    await ref.set({
      batchPlanId: id,
      batchId: id,
      moduleId,
      topicId,
      originalPlannedDate,
      plannedDate,
      teacherUid,
      scheduleHistory: history,
      centreId,
      updatedAt: now,
    });
    await this.refreshTeacherUids(id, text(plan.facultyUid));
    return this.buildBatchDetail(centreId, id);
  }

  async teach(caller: AuthCaller): Promise<TeachAgenda> {
    const { profile, centreId } = await this.context(caller);
    this.assertModule(caller, profile);
    if (normalizeRole(text(profile.role)) !== "faculty" && !caller.isDirector) {
      throw new SyllabusError("Lesson updates are for faculty assigned to a batch.", 403);
    }
    const [ownedPlans, taughtSchedules] = await Promise.all([
      this.db.collection("batchPlans").where("centreId", "==", centreId).where("facultyUid", "==", caller.id).get(),
      this.db.collection("topicSchedules").where("teacherUid", "==", caller.id).get(),
    ]);
    const planIds = new Set(ownedPlans.docs.map((docSnap) => docSnap.id));
    const extraPlanIds = [...new Set(taughtSchedules.docs.map((docSnap) => text(docSnap.data().batchId)))].filter(
      (batchId) => batchId && !planIds.has(batchId)
    );
    const extraPlans = await Promise.all(extraPlanIds.map((batchId) => this.db.collection("batchPlans").doc(batchId).get()));
    const plans = [...ownedPlans.docs, ...extraPlans.filter((snap) => snap.exists && text(snap.data()?.centreId) === centreId)];
    const batchIds = plans.map((planSnap) => planSnap.id);
    const versionCache = new Map<string, Promise<SyllabusVersion>>();
    const [groups, notes, batchMap] = await Promise.all([
      Promise.all(plans.map(async (planSnap) => {
      const plan = planSnap.data() as DocData;
      if (text(plan.centreId) !== centreId) return [] as TeachTopic[];
      const batchName = "Batch";
      const versionKey = `${text(plan.syllabusId)}:${Number(plan.syllabusVersion)}`;
      const cachedVersion = versionCache.get(versionKey);
      const version = cachedVersion ?? this.versionData(text(plan.syllabusId), Number(plan.syllabusVersion));
      if (!cachedVersion) versionCache.set(versionKey, version);
      const ownsPlan = text(plan.facultyUid) === caller.id;
      const [scheduleSnap, lessonSnap, syllabusVersion] = await Promise.all([
        this.db.collection("topicSchedules").where("batchId", "==", planSnap.id).get(),
        this.db.collection("lessonUpdates").where("batchId", "==", planSnap.id).get(),
        version,
      ]);
      const schedules = new Map<string, DocData>();
      scheduleSnap.docs.forEach((docSnap) => {
        const topicId = text(docSnap.data().topicId) || docSnap.id.slice(planSnap.id.length + 1);
        if (topicId) schedules.set(topicId, docSnap.data() as DocData);
      });
      const lessons = new Map<string, DocData>();
      lessonSnap.docs.forEach((docSnap) => {
        const topicId = text(docSnap.data().topicId) || docSnap.id.slice(planSnap.id.length + 1);
        if (topicId) lessons.set(topicId, docSnap.data() as DocData);
      });
      const rows: TeachTopic[] = [];
      for (const module of syllabusVersion.modules) {
        for (const topic of module.topics) {
          const schedule = schedules.get(topic.id) ?? null;
          const isTopicTeacher = text(schedule?.teacherUid) === caller.id;
          if (!ownsPlan && !isTopicTeacher) continue;
          const lesson = lessons.get(topic.id) ?? null;
          rows.push({
            batchId: planSnap.id,
            batchName,
            courseName: text(plan.courseName),
            moduleTitle: module.title,
            topicId: topic.id,
            topicTitle: topic.title,
            plannedDate: text(schedule?.plannedDate),
            originalPlannedDate: text(schedule?.originalPlannedDate),
            lessonStatus: lessonStatus(lesson?.status),
            classDate: text(lesson?.classDate),
            minutesSpent: typeof lesson?.minutesSpent === "number" ? lesson.minutesSpent : null,
            note: text(lesson?.note),
            weekLabel: text(module.weekLabel),
            description: text(topic.description),
          });
        }
      }
      return rows;
    })),
      this.feedbackByTopic(batchIds),
      this.batchDisplayNames(batchIds),
    ]);
    const topics = groups.flat().map((topic) => ({ ...topic, batchName: batchMap.get(topic.batchId) || "Batch" }));
    const upcoming = topics.filter((row) => row.lessonStatus !== "completed");
    const completed = topics.filter((row) => row.lessonStatus === "completed");
    const byDate = (a: TeachTopic, b: TeachTopic) => (a.plannedDate || "9999").localeCompare(b.plannedDate || "9999");
    topics.forEach((topic) => {
      topic.feedback = notes[`${topic.batchId}::${topic.topicId}`] ?? [];
    });
    upcoming.sort(byDate);
    completed.sort(byDate);
    topics.sort(byDate);
    return { upcoming, completed, topics };
  }

  async saveLesson(caller: AuthCaller, body: DocData): Promise<TeachTopic> {
    const { profile, centreId } = await this.context(caller);
    this.assertModule(caller, profile);
    const batchId = assertId(text(body.batchId), "Batch");
    const topicId = assertId(text(body.topicId), "Topic");
    const status = text(body.status);
    if (!LESSON_STATUSES.has(status)) throw new SyllabusError("Choose Incomplete, Partly covered, or Covered.", 400);
    const classDate = optionalDate(body.classDate, "Class date");
    if (!classDate) {
      throw new SyllabusError("Enter the class date. Leave the topic unsaved if it has not started.", 400);
    }
    let minutesSpent: number | null = null;
    if (body.minutesSpent !== undefined && body.minutesSpent !== null && body.minutesSpent !== "") {
      const minutes = Number(body.minutesSpent);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 600) {
        throw new SyllabusError("Time spent must be a whole number of minutes from 0 to 600.", 400);
      }
      minutesSpent = minutes;
    }
    const note = text(body.note);
    if (note.length > 2000) throw new SyllabusError("Notes must be 2000 characters or fewer.", 400);
    const planSnap = await this.db.collection("batchPlans").doc(batchId).get();
    if (!planSnap.exists || text(planSnap.data()?.centreId) !== centreId) {
      throw new SyllabusError("That batch does not exist.", 404);
    }
    const plan = planSnap.data() as DocData;
    const scheduleSnap = await this.db.collection("topicSchedules").doc(scheduleDocId(batchId, topicId)).get();
    const schedule = scheduleSnap.exists ? (scheduleSnap.data() as DocData) : null;
    const allowed = text(plan.facultyUid) === caller.id || text(schedule?.teacherUid) === caller.id;
    if (!scheduleSnap.exists && text(plan.facultyUid) !== caller.id) {
      throw new SyllabusError("Schedule this topic before recording a lesson.", 400);
    }
    if (!allowed) {
      throw new SyllabusError("You can update lessons only for batches assigned to you.", 403);
    }
    const version = await this.versionData(text(plan.syllabusId), Number(plan.syllabusVersion));
    const topic = version.modules.flatMap((module) => module.topics).find((item) => item.id === topicId);
    const module = version.modules.find((item) => item.topics.some((itemTopic) => itemTopic.id === topicId));
    if (!topic || !module) throw new SyllabusError("That topic is not on the pinned syllabus version.", 400);
    const ref = this.db.collection("lessonUpdates").doc(scheduleDocId(batchId, topicId));
    const existingSnap = await ref.get();
    const now = new Date().toISOString();
    const history = existingSnap.exists && Array.isArray(existingSnap.data()?.history) ? [...(existingSnap.data()?.history as DocData[])] : [];
    if (existingSnap.exists) {
      const previous = existingSnap.data() as DocData;
      history.push({
        status: text(previous.status),
        classDate: text(previous.classDate),
        minutesSpent: typeof previous.minutesSpent === "number" ? previous.minutesSpent : null,
        note: text(previous.note),
        updatedBy: text(previous.updatedBy),
        updatedAt: text(previous.updatedAt) || now,
      });
    }
    await ref.set({
      topicScheduleId: scheduleDocId(batchId, topicId),
      batchId,
      topicId,
      status,
      classDate,
      minutesSpent,
      note,
      updatedBy: caller.id,
      updatedAt: now,
      history,
      centreId,
    });
    const batches = await this.listBatchRecords(centreId);
    return {
      batchId,
      batchName: batches.find((batch) => batch.id === batchId)?.name || "Batch",
      courseName: text(plan.courseName),
      moduleTitle: module.title,
      topicId: topic.id,
      plannedDate: text(schedule?.plannedDate),
      originalPlannedDate: text(schedule?.originalPlannedDate),
      topicTitle: topic.title,
      lessonStatus: status as LessonStatus,
      classDate,
      minutesSpent,
      note,
    };
  }

  async myClass(caller: AuthCaller): Promise<MyClass> {
    const { profile, centreId } = await this.context(caller);
    this.assertModule(caller, profile);
    const student = await this.studentForUid(caller.id, text(profile.email), text(profile.phone), normalizeRole(text(profile.role) || caller.role));
    if (!student) throw new SyllabusError("Your login is not linked to a student record.", 403);
    const studentCentre = text(student.data.centreId) || centreId;
    const batches = await this.listBatchRecords(studentCentre);
    const courses = [];
    for (const enrollment of this.enrollmentsOf(student.id, student.data, new Set(batches.map((batch) => batch.id)))) {
      const batch = batches.find((item) => item.id === enrollment.batchId);
      const topics = await this.classTopics(studentCentre, enrollment.batchId, student.id, enrollment.courseName);
      courses.push({
        courseName: enrollment.courseName || batch?.course || "Course",
        batchId: enrollment.batchId,
        batchName: batch?.name || personName(student.data),
        topics,
      });
    }
    const first = courses[0];
    return {
      studentId: student.id,
      batchId: first?.batchId || student.id,
      batchName: first?.batchName || personName(student.data),
      courseName: first?.courseName || "",
      topics: first?.topics ?? [],
      courses,
    };
  }

  async saveFeedback(caller: AuthCaller, body: DocData): Promise<{ saved: boolean }> {
    const { profile } = await this.context(caller);
    this.assertModule(caller, profile);
    const understanding = text(body.understanding);
    if (!UNDERSTANDING.has(understanding)) {
      throw new SyllabusError("Choose Understood, Partly understood, or Need help.", 400);
    }
    const comment = text(body.comment);
    if (comment.length > 2000) throw new SyllabusError("Comments must be 2000 characters or fewer.", 400);
    const topicId = assertId(text(body.topicId), "Topic");
    const student = await this.studentForUid(caller.id, text(profile.email), text(profile.phone), normalizeRole(text(profile.role) || caller.role));
    if (!student) throw new SyllabusError("Your login is not linked to a student record.", 403);
    const { centreId } = await this.context(caller);
    const batches = await this.listBatchRecords(text(student.data.centreId) || centreId);
    const batchIds = new Set(batches.map((batch) => batch.id));
    const owned = new Set(this.enrollmentsOf(student.id, student.data, batchIds).map((enrollment) => enrollment.batchId));
    const requested = text(body.batchId);
    const batchId = owned.has(requested) ? requested : this.resolveStudentBatch(student.id, student.data, batchIds);
    if (!batchId) throw new SyllabusError("No batch is assigned to your student record.", 404);
    const planSnap = await this.db.collection("batchPlans").doc(batchId).get();
    if (!planSnap.exists) throw new SyllabusError("Your batch does not have a syllabus plan yet.", 404);
    const plan = planSnap.data() as DocData;
    const version = await this.versionData(text(plan.syllabusId), Number(plan.syllabusVersion));
    if (!version.modules.some((module) => module.topics.some((topic) => topic.id === topicId))) {
      throw new SyllabusError("That topic is not on your syllabus.", 404);
    }
    const lessonSnap = await this.db.collection("lessonUpdates").doc(scheduleDocId(batchId, topicId)).get();
    const status = lessonSnap.exists ? lessonStatus(lessonSnap.data()?.status) : null;
    if (status !== "not_covered" && status !== "partly_covered" && status !== "completed") {
      throw new SyllabusError("Feedback opens after the teacher marks this topic incomplete, partly covered, or covered.", 400);
    }
    await this.db.collection("topicFeedback").doc(feedbackDocId(batchId, topicId, student.id)).set({
      batchId,
      topicId,
      studentId: student.id,
      studentUid: caller.id,
      understanding,
      comment,
      updatedAt: new Date().toISOString(),
    });
    return { saved: true };
  }

  async parentHome(caller: AuthCaller): Promise<ParentStudentCard[]> {
    const { profile } = await this.context(caller);
    this.assertModule(caller, profile);
    if (normalizeRole(text(profile.role)) !== "parent" && !caller.isDirector) {
      throw new SyllabusError("Parent progress is available to linked parent accounts.", 403);
    }
    const links = await this.db.collection("parentLinks").where("parentUid", "==", caller.id).get();
    const cards: ParentStudentCard[] = [];
    for (const link of links.docs) {
      const studentId = text(link.data().studentId);
      if (!studentId || text(link.data().parentUid) !== caller.id) continue;
      const studentSnap = await this.db.collection("students").doc(studentId).get();
      if (!studentSnap.exists) continue;
      const data = studentSnap.data() as DocData;
      const batches = this.studentBatches(studentId, data);
      const enrollments = this.enrollmentsOf(studentId, data, new Set(batches.map((batch) => batch.id)));
      for (const enrollment of enrollments) {
        const batch = batches.find((item) => item.id === enrollment.batchId);
        cards.push({
          studentId,
          studentName: personName(data),
          courseName: enrollment.courseName || batch?.course || "Course",
          batchName: batch?.name || personName(data),
        });
      }
    }
    return cards;
  }

  async parentProgress(caller: AuthCaller, studentIdRaw: string): Promise<ParentProgress> {
    const { profile } = await this.context(caller);
    this.assertModule(caller, profile);
    const studentId = assertId(studentIdRaw, "Student");
    const link = await this.db.collection("parentLinks").doc(`${caller.id}_${studentId}`).get();
    if (!link.exists || text(link.data()?.parentUid) !== caller.id || text(link.data()?.studentId) !== studentId) {
      throw new SyllabusError("You are not allowed to view this student.", 403);
    }
    if (normalizeRole(text(profile.role)) !== "parent" && !caller.isDirector) {
      throw new SyllabusError("You are not allowed to view this student.", 403);
    }
    const studentSnap = await this.db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) throw new SyllabusError("You are not allowed to view this student.", 403);
    const student = studentSnap.data() as DocData;
    const batches = this.studentBatches(studentId, student);
    const enrollments = this.enrollmentsOf(studentId, student, new Set(batches.map((batch) => batch.id)));
    const courses: ParentCourse[] = [];
    for (const enrollment of enrollments) {
      courses.push(await this.parentCourse(student, enrollment, batches));
    }
    const first = courses[0];
    return {
      studentId,
      studentName: personName(student),
      courseName: first?.courseName || text(student.course),
      batchId: first?.batchId || "",
      batchName: first?.batchName || "",
      topics: first?.topics ?? [],
      completionPercent: first?.completionPercent ?? 0,
      progress: first?.progress ?? summarizeProgress([]),
      upcoming: first?.upcoming ?? [],
      completedTopics: first?.completedTopics ?? [],
      feedbackCounts: { understood: 0, partlyUnderstood: 0, needHelp: 0 },
      hasPlan: first?.hasPlan ?? false,
      courses,
    };
  }

  async dashboard(caller: AuthCaller, filters: DashboardFilters): Promise<DashboardReport> {
    const { centreId } = await this.coordinatorContext(caller);
    const from = filters.from ? requireDate(filters.from, "From date") : "";
    const to = filters.to ? requireDate(filters.to, "To date") : "";
    if (from && to && to < from) throw new SyllabusError("The end date must be on or after the start date.", 400);
    const [plans, batches, names] = await Promise.all([
      this.plansForCentre(centreId),
      this.listBatchRecords(centreId),
      this.userNames(),
    ]);
    const batchMap = new Map(batches.map((batch) => [batch.id, batch]));
    const feedbackByTopic = new Map<string, number>();
    const versionCache = new Map<string, Promise<SyllabusVersion>>();
    const parts = await Promise.all(plans.map(async (plan) => {
      if (filters.course && plan.courseName !== filters.course) return [] as FlatTopic[];
      if (filters.batchId && plan.batchId !== filters.batchId) return [] as FlatTopic[];
      const versionKey = `${plan.syllabusId}:${plan.syllabusVersion}`;
      const cachedVersion = versionCache.get(versionKey);
      const version = cachedVersion ?? this.versionData(plan.syllabusId, plan.syllabusVersion);
      if (!cachedVersion) versionCache.set(versionKey, version);
      const syllabusVersion = await version;
      const [rows, feedbackSnap] = await Promise.all([
        this.flattenPlan(
          plan.batchId,
          batchMap.get(plan.batchId)?.name || "Batch",
          syllabusVersion,
          names,
          plan.courseName,
          plan.facultyUid
        ),
        this.db.collection("topicFeedback").where("batchId", "==", plan.batchId).get(),
      ]);
      feedbackSnap.docs.forEach((docSnap) => {
        if (text(docSnap.data().understanding) !== "need_help") return;
        const key = `${plan.batchId}_${text(docSnap.data().topicId)}`;
        feedbackByTopic.set(key, (feedbackByTopic.get(key) ?? 0) + 1);
      });
      return rows.filter(
        (topic) =>
          !filters.facultyUid ||
          plan.facultyUid === filters.facultyUid ||
          topic.teacherUid === filters.facultyUid
      );
    }));
    const scoped = parts.flat();
    const scheduleIncomplete = scoped.some((topic) => !topic.plannedDate);
    const lessonsIncomplete = scoped.some((topic) => !topic.status);
    const ranged = scoped.filter((topic) => {
      if (!from && !to) return true;
      if (!topic.plannedDate) return false;
      if (from && topic.plannedDate < from) return false;
      if (to && topic.plannedDate > to) return false;
      return true;
    });
    const today = todayInKolkata();
    const toRow = (topic: FlatTopic): DashboardTopicRow => ({
      batchId: topic.batchId,
      batchName: topic.batchName,
      courseName: topic.courseName,
      moduleTitle: topic.moduleTitle,
      topicTitle: topic.topicTitle,
      plannedDate: topic.plannedDate,
      statusLabel: displayLessonStatus(topic.status),
      facultyName: topic.facultyName,
    });
    const group = (keyer: (topic: FlatTopic) => { key: string; label: string }): ProgressGroup[] => {
      const buckets = new Map<string, { label: string; topics: FlatTopic[] }>();
      ranged.forEach((topic) => {
        const { key, label } = keyer(topic);
        const bucket = buckets.get(key) ?? { label, topics: [] };
        bucket.topics.push(topic);
        buckets.set(key, bucket);
      });
      return [...buckets.entries()].map(([key, bucket]) => {
        const progress = summarizeProgress(bucket.topics.map((topic) => ({ plannedDate: topic.plannedDate, status: topic.status })));
        if (scheduleIncomplete) progress.scheduleComplete = false;
        if (lessonsIncomplete) progress.lessonsComplete = false;
        if (scheduleIncomplete || lessonsIncomplete) progress.percent = null;
        return {
          key,
          label: bucket.label,
          progress,
          planned: bucket.topics.filter((topic) => topic.plannedDate).length,
          completed: bucket.topics.filter((topic) => topic.status === "completed").length,
        };
      });
    };
    const visibleIds = new Set(ranged.map((topic) => `${topic.batchId}_${topic.topicId}`));
    let needHelpCount = 0;
    feedbackByTopic.forEach((count, key) => {
      if (count > 0 && visibleIds.has(key)) needHelpCount += 1;
    });
    return {
      scheduleIncomplete,
      lessonsIncomplete,
      byCourse: group((topic) => ({ key: topic.courseName, label: topic.courseName || "Course" })),
      byBatch: group((topic) => ({ key: topic.batchId, label: `${topic.batchName} · ${topic.courseName}` })),
      byModule: group((topic) => ({
        key: `${topic.batchId}_${topic.moduleTitle}`,
        label: `${topic.moduleTitle} · ${topic.batchName}`,
      })),
      byTopic: ranged.map(toRow),
      overdue: ranged.filter((topic) => isOverdueTopic(topic.plannedDate, topic.status, today)).map(toRow),
      upcoming: ranged
        .filter((topic) => topic.plannedDate >= today && topic.status !== "completed" && topic.plannedDate)
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
        .slice(0, 40)
        .map(toRow),
      partlyCoveredCount: ranged.filter((topic) => topic.status === "partly_covered").length,
      needHelpCount,
      plannedCount: ranged.filter((topic) => topic.plannedDate).length,
      completedCount: ranged.filter((topic) => topic.status === "completed").length,
    };
  }

  async directory(caller: AuthCaller): Promise<SyllabusDirectory> {
    const { centreId } = await this.linkerContext(caller);
    const [studentsSnap, users, batches] = await Promise.all([
      this.db.collection("students").where("centreId", "==", centreId).get(),
      this.userDocs(),
      this.listBatchRecords(centreId),
    ]);
    const batchIds = new Set(batches.map((batch) => batch.id));
    const students = studentsSnap.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: personName(data),
          course: text(data.course),
          studentUid: text(data.studentUid),
          syllabusBatchId: batchIds.has(text(data.syllabusBatchId)) ? text(data.syllabusBatchId) : "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const directoryUsers: DirectoryUser[] = [...users.entries()]
      .filter(([, data]) => data.approved === true)
      .map(([uid, data]) => ({
        uid,
        name: personName(data),
        email: text(data.email),
        role: normalizeRole(text(data.role)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const centreHeads = caller.isDirector
      ? directoryUsers
          .filter((user) => user.role === "centre_head")
          .map((user) => ({
            ...user,
            canEditSyllabus: permissionList(users.get(user.uid)?.permissionsGranted).includes("syllabus"),
          }))
      : [];
    return { students, users: directoryUsers, centreHeads };
  }

  async linkParent(caller: AuthCaller, body: DocData): Promise<{ linked: boolean; message: string }> {
    const { centreId } = await this.linkerContext(caller);
    const studentId = assertId(text(body.studentId), "Student");
    const contact = text(body.email);
    const phone = contact.includes("@") ? "" : this.phoneKey(contact);
    const user = await this.loginForContact(contact, "Parent", centreId, "parent", Boolean(phone));
    if (user.data.approved !== true) throw new SyllabusError("That user is not approved yet.", 400);
    const role = normalizeRole(text(user.data.role));
    if (role === "student" || NON_CONVERTIBLE.has(role)) {
      throw new SyllabusError("Use an approved parent or employee account. Staff logins cannot be converted into parents.", 400);
    }
    const studentSnap = await this.db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) throw new SyllabusError("Student not found.", 404);
    if (text(studentSnap.data()?.studentUid) === user.id) {
      throw new SyllabusError("A student login cannot also be the parent login for the same student.", 400);
    }
    if (role !== "parent") {
      await this.db.collection("users").doc(user.id).update({
        role: "parent",
        permissionsGranted: [],
        permissionsRevoked: [],
        updatedAt: new Date().toISOString(),
      });
    }
    await this.db.collection("parentLinks").doc(`${user.id}_${studentId}`).set({
      parentUid: user.id,
      studentId,
      createdBy: caller.id,
      createdAt: new Date().toISOString(),
    });
    const message = user.createdPassword
      ? `Parent login created for ${phone}. Sign in with this mobile number. Password: ${user.createdPassword}`
      : "Parent linked.";
    return { linked: true, message };
  }

  async unlinkParent(caller: AuthCaller, body: DocData): Promise<{ unlinked: boolean }> {
    await this.linkerContext(caller);
    const studentId = assertId(text(body.studentId), "Student");
    const user = await this.loginForContact(text(body.email), "Parent", "default-centre", "parent", false);
    await this.db.collection("parentLinks").doc(`${user.id}_${studentId}`).delete();
    return { unlinked: true };
  }

  async enrollStudent(caller: AuthCaller, body: DocData): Promise<{ linked: boolean; message: string }> {
    const ctx = await this.context(caller);
    this.assertStaff(caller, ctx.profile);
    const studentId = assertId(text(body.studentId), "Student");
    const studentSnap = await this.db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) throw new SyllabusError("Student not found.", 404);
    const student = studentSnap.data() as DocData;
    const studentCentre = text(student.centreId) || ctx.centreId;
    const studentName = personName(student);
    const courseName = text(body.course) || text(student.course);
    const email = text(body.email).toLowerCase();
    const studentPhone = this.phoneKey(text(body.phone) || text(student.phone));
    const contact = email || studentPhone;
    const notes = ["Student saved."];
    let studentUid = text(student.studentUid);

    if (!studentUid) {
      if (!contact) {
        notes.push("Add a mobile number or email before this student can open My class.");
      } else {
        const linked = await this.attachStudentLogin(studentSnap.ref, studentId, contact, studentName, studentCentre, courseName);
        notes.push(linked.note);
        if (linked.uid) studentUid = linked.uid;
      }
    }

    const parentPhone = this.phoneKey(text(body.parentPhone) || text(body.parentsContactNumber) || text(student.parentsContactNumber));
    if (parentPhone && parentPhone === studentPhone) {
      notes.push("The parent number matches the student number, so a separate parent login was not created.");
    } else if (parentPhone) {
      notes.push(await this.attachParentLogin(studentId, studentUid, parentPhone, studentName, studentCentre));
    }

    if (courseName) {
      const syllabus = await this.syllabusByCourse(studentCentre, courseName);
      if (!syllabus) notes.push("Create that course on the Syllabus page before the class topics appear.");
    }
    return { linked: Boolean(studentUid), message: notes.join(" ") };
  }

  async linkStudentLogin(caller: AuthCaller, body: DocData): Promise<{ linked: boolean; message: string }> {
    const { centreId } = await this.linkerContext(caller);
    const studentId = assertId(text(body.studentId), "Student");
    const studentSnap = await this.db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) throw new SyllabusError("Student not found.", 404);
    const studentName = personName(studentSnap.data() as DocData);
    const contact = text(body.email);
    const user = await this.loginForContact(contact, studentName, text(studentSnap.data()?.centreId) || centreId, "student", true);
    const role = normalizeRole(text(user.data.role));
    if (role === "parent" || NON_CONVERTIBLE.has(role)) {
      throw new SyllabusError("Use a student email. Staff and parent logins cannot be student logins.", 400);
    }
    const existing = await this.db.collection("students").where("studentUid", "==", user.id).get();
    if (existing.docs.some((docSnap) => docSnap.id !== studentId)) {
      throw new SyllabusError("That login is already linked to another student.", 409);
    }
    let syllabusBatchId = text(body.syllabusBatchId);
    if (syllabusBatchId) {
      syllabusBatchId = assertId(syllabusBatchId, "Batch");
      await this.requireBatch(centreId, syllabusBatchId);
    }
    const update: DocData = {
      studentUid: user.id,
      updatedAt: new Date().toISOString(),
    };
    if (syllabusBatchId) update.syllabusBatchId = syllabusBatchId;
    await studentSnap.ref.update(update);
    if (role !== "student" || user.data.approved !== true) {
      await this.db.collection("users").doc(user.id).update({
        role: "student",
        approved: true,
        permissionsGranted: [],
        permissionsRevoked: [],
        updatedAt: new Date().toISOString(),
      });
    }
    const phone = contact.includes("@") ? "" : this.phoneKey(contact);
    const message = user.createdPassword
      ? `Login created for ${phone || text(user.data.email)}. Sign in with this ${phone ? "mobile number" : "email"}. Password: ${user.createdPassword}`
      : "Student login linked.";
    return { linked: true, message };
  }

  async unlinkStudentLogin(caller: AuthCaller, body: DocData): Promise<{ unlinked: boolean }> {
    await this.linkerContext(caller);
    const studentId = assertId(text(body.studentId), "Student");
    const studentSnap = await this.db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) throw new SyllabusError("Student not found.", 404);
    const uid = text(studentSnap.data()?.studentUid);
    await studentSnap.ref.update({ studentUid: "", updatedAt: new Date().toISOString() });
    if (uid) {
      const userSnap = await this.db.collection("users").doc(uid).get();
      if (userSnap.exists && normalizeRole(text(userSnap.data()?.role)) === "student") {
        await userSnap.ref.update({
          role: "employee",
          permissionsGranted: [],
          permissionsRevoked: [],
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return { unlinked: true };
  }

  async setCentreHeadEdit(caller: AuthCaller, targetUid: string, canEdit: boolean): Promise<{ canEditSyllabus: boolean }> {
    if (!caller.isDirector) throw new SyllabusError("Only a director can grant syllabus editing.", 403);
    const uid = assertId(targetUid, "User");
    const userSnap = await this.db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new SyllabusError("User not found.", 404);
    if (normalizeRole(text(userSnap.data()?.role)) !== "centre_head") {
      throw new SyllabusError("Syllabus editing can be granted to a centre head.", 400);
    }
    const granted = new Set(permissionList(userSnap.data()?.permissionsGranted));
    if (canEdit) granted.add("syllabus");
    else granted.delete("syllabus");
    await userSnap.ref.update({
      permissionsGranted: [...granted],
      updatedAt: new Date().toISOString(),
    });
    return { canEditSyllabus: canEdit };
  }

  private async context(caller: AuthCaller): Promise<{ profile: DocData; centreId: string }> {
    const profile = await this.profile(caller);
    return { profile, centreId: centreOf(profile) };
  }

  private async coordinatorContext(caller: AuthCaller): Promise<{ profile: DocData; centreId: string }> {
    const ctx = await this.context(caller);
    this.assertModule(caller, ctx.profile);
    if (!this.isCoordinator(caller)) {
      throw new SyllabusError("This page is for directors, academic heads, and centre heads.", 403);
    }
    return ctx;
  }

  private async editorContext(caller: AuthCaller): Promise<{ profile: DocData; centreId: string }> {
    const ctx = await this.context(caller);
    this.assertModule(caller, ctx.profile);
    if (!this.canAuthor(caller, ctx.profile)) {
      throw new SyllabusError("Faculty can draft a course. A director can also allow a centre head to draft.", 403);
    }
    return ctx;
  }

  private async readerContext(caller: AuthCaller): Promise<{ profile: DocData; centreId: string }> {
    const ctx = await this.context(caller);
    this.assertModule(caller, ctx.profile);
    if (!this.isCoordinator(caller) && !this.canAuthor(caller, ctx.profile)) {
      throw new SyllabusError("This page is for faculty and coordinators.", 403);
    }
    return ctx;
  }

  private async reviewerContext(caller: AuthCaller): Promise<{ profile: DocData; centreId: string }> {
    const ctx = await this.context(caller);
    this.assertModule(caller, ctx.profile);
    if (!this.isReviewer(caller, ctx.profile)) {
      throw new SyllabusError("Only a director or academic head can approve or publish a course.", 403);
    }
    return ctx;
  }

  private async workingCopy(
    caller: AuthCaller,
    syllabusId: string,
    mode: "author" | "reviewer"
  ): Promise<{ id: string; centreId: string; open: SyllabusVersion }> {
    const { centreId } = mode === "reviewer" ? await this.reviewerContext(caller) : await this.editorContext(caller);
    const id = assertId(syllabusId, "Syllabus");
    await this.requireSyllabus(id, centreId);
    const open = (await this.versionsFor(id)).find((version) => version.status !== "published");
    if (!open) throw new SyllabusError("Save a draft before continuing.", 400);
    return { id, centreId, open };
  }

  private assertTopics(modules: SyllabusModule[]): void {
    if (modules.length === 0 || modules.every((module) => module.topics.length === 0)) {
      throw new SyllabusError("Add at least one module with a topic first.", 400);
    }
  }

  private async linkerContext(caller: AuthCaller): Promise<{ profile: DocData; centreId: string }> {
    const ctx = await this.context(caller);
    this.assertModule(caller, ctx.profile);
    if (!this.canLink(caller)) {
      throw new SyllabusError("Only a director or academic head can link parent and student logins.", 403);
    }
    return ctx;
  }

  private async profile(caller: AuthCaller): Promise<DocData> {
    const snap = await this.db.collection("users").doc(caller.id).get();
    if (!snap.exists) throw new SyllabusError("User profile not found.", 403);
    return snap.data() as DocData;
  }

  private assertStaff(caller: AuthCaller, profile: DocData): void {
    const role = normalizeRole(text(profile.role) || caller.role);
    if (role === "student" || role === "parent") {
      throw new SyllabusError("Students and parents cannot change enrollment.", 403);
    }
  }

  private assertModule(caller: AuthCaller, profile: DocData): void {
    if (caller.isDirector) return;
    const permissions = resolvePermissions(
      text(profile.role) || caller.role,
      permissionList(profile.permissionsGranted),
      permissionList(profile.permissionsRevoked)
    );
    if (!canAccess(permissions, "syllabus")) {
      throw new SyllabusError("You do not have access to the syllabus module.", 403);
    }
  }

  private isCoordinator(caller: AuthCaller): boolean {
    if (caller.isDirector) return true;
    const role = normalizeRole(caller.role);
    return role === "academic_head" || role === "centre_head";
  }

  private canEdit(caller: AuthCaller, profile: DocData): boolean {
    if (caller.isDirector) return true;
    const role = normalizeRole(text(profile.role) || caller.role);
    if (role === "academic_head") return true;
    return permissionList(profile.permissionsGranted).includes("syllabus");
  }

  /** Faculty draft and submit. Centre heads draft only after a director grants syllabus editing. */
  private canAuthor(caller: AuthCaller, profile: DocData): boolean {
    if (caller.isDirector) return true;
    const role = normalizeRole(text(profile.role) || caller.role);
    if (role === "student" || role === "parent") return false;
    if (role === "academic_head" || role === "faculty") return true;
    return permissionList(profile.permissionsGranted).includes("syllabus");
  }

  private isReviewer(caller: AuthCaller, profile: DocData): boolean {
    if (caller.isDirector) return true;
    return normalizeRole(text(profile.role) || caller.role) === "academic_head";
  }

  private canLink(caller: AuthCaller): boolean {
    if (caller.isDirector) return true;
    return normalizeRole(caller.role) === "academic_head";
  }

  private async requireSyllabus(syllabusId: string, centreId: string): Promise<SyllabusRecord> {
    const snap = await this.db.collection("syllabi").doc(syllabusId).get();
    if (!snap.exists || text(snap.data()?.centreId) !== centreId) {
      throw new SyllabusError("Syllabus not found.", 404);
    }
    const plans = await this.plansForCentre(centreId);
    const batches = await this.listBatchRecords(centreId);
    return this.toSyllabusRecord(
      snap.id,
      snap.data() as DocData,
      plans,
      new Map(batches.map((batch) => [batch.id, batch.name]))
    );
  }

  private async loadSyllabusDetail(syllabusId: string, centreId: string): Promise<SyllabusDetail> {
    const record = await this.requireSyllabus(syllabusId, centreId);
    const versions = await this.versionsFor(syllabusId);
    const draft = versions.find((version) => version.status !== "published") ?? null;
    const published = versions
      .filter((version) => version.status === "published")
      .sort((a, b) => b.version - a.version)[0] ?? null;
    return {
      ...record,
      draftVersion: draft?.version ?? null,
      draft,
      published,
      versions: versions.map((version) => ({
        id: version.id,
        version: version.version,
        status: version.status,
        effectiveDate: version.effectiveDate,
      })),
    };
  }

  private async versionsFor(syllabusId: string): Promise<SyllabusVersion[]> {
    const snap = await this.db.collection("syllabusVersions").where("syllabusId", "==", syllabusId).get();
    return snap.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          syllabusId,
          version: Number(data.version ?? 0),
          effectiveDate: text(data.effectiveDate) || undefined,
          status: readSyllabusStatus(data.status),
          modules: readModules(data.modules),
          createdBy: text(data.createdBy),
          createdAt: text(data.createdAt) || undefined,
          submittedAt: text(data.submittedAt) || undefined,
          approvedAt: text(data.approvedAt) || undefined,
          reviewNote: text(data.reviewNote) || undefined,
        };
      })
      .sort((a, b) => a.version - b.version);
  }

  private async versionData(syllabusId: string, version: number): Promise<SyllabusVersion> {
    const snap = await this.db.collection("syllabusVersions").doc(versionDocId(syllabusId, version)).get();
    if (!snap.exists) throw new SyllabusError("The pinned syllabus version no longer exists.", 404);
    const data = snap.data() as DocData;
    return {
      id: snap.id,
      syllabusId,
      version: Number(data.version ?? version),
      effectiveDate: text(data.effectiveDate) || undefined,
      status: readSyllabusStatus(data.status),
      modules: readModules(data.modules),
      createdBy: text(data.createdBy),
      reviewNote: text(data.reviewNote) || undefined,
    };
  }

  private async toSyllabusRecord(
    id: string,
    data: DocData,
    plans: { batchId: string; syllabusId: string; syllabusVersion: number }[],
    batchNames: Map<string, string>
  ): Promise<SyllabusRecord> {
    const versions = await this.versionsFor(id);
    const currentVersion = Number(data.currentVersion ?? 0);
    const open = versions.find((version) => version.status !== "published");
    const status = open ? open.status : currentVersion > 0 ? "published" : "draft";
    return {
      id,
      courseName: text(data.courseName),
      status,
      openStatus: open?.status ?? null,
      currentVersion,
      draftVersion: open?.version ?? null,
      createdBy: text(data.createdBy),
      updatedAt: text(data.updatedAt) || undefined,
      batchesOnOlderVersion: plans
        .filter((plan) => plan.syllabusId === id && currentVersion > 0 && plan.syllabusVersion < currentVersion)
        .map((plan) => ({
          batchId: plan.batchId,
          batchName: batchNames.get(plan.batchId) || plan.batchId,
          syllabusVersion: plan.syllabusVersion,
        })),
    };
  }

  private async feedbackByTopic(batchIds: string[]): Promise<Record<string, StudentFeedbackNote[]>> {
    const grouped: Record<string, StudentFeedbackNote[]> = {};
    const ids = [...new Set(batchIds.filter(Boolean))];
    const snaps = await Promise.all(ids.map((batchId) => this.db.collection("topicFeedback").where("batchId", "==", batchId).get()));
    const studentIds = new Set<string>();
    snaps.forEach((snap) => {
      snap.docs.forEach((docSnap) => {
        const studentId = text(docSnap.data().studentId);
        if (studentId) studentIds.add(studentId);
      });
    });
    const names = new Map<string, string>();
    await Promise.all([...studentIds].map(async (studentId) => {
      const student = await this.db.collection("students").doc(studentId).get();
      names.set(studentId, student.exists ? personName(student.data() as DocData) : "Student");
    }));
    snaps.forEach((snap, index) => {
      const batchId = ids[index];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const understanding = text(data.understanding);
        if (!UNDERSTANDING.has(understanding)) return;
        const studentId = text(data.studentId);
        const key = `${batchId}::${text(data.topicId)}`;
        const note: StudentFeedbackNote = {
          studentName: names.get(studentId) || "Student",
          understanding: understanding as Understanding,
          comment: text(data.comment),
        };
        grouped[key] = [...(grouped[key] ?? []), note];
      });
    });
    return grouped;
  }

  private async plansForCentre(centreId: string): Promise<
    {
      batchId: string;
      courseName: string;
      syllabusId: string;
      syllabusVersion: number;
      facultyUid: string;
      startDate: string;
      targetCompletionDate: string;
      planHistory: PlanHistoryEntry[];
    }[]
  > {
    const snap = await this.db.collection("batchPlans").where("centreId", "==", centreId).get();
    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        batchId: docSnap.id,
        courseName: text(data.courseName),
        syllabusId: text(data.syllabusId),
        syllabusVersion: Number(data.syllabusVersion ?? 0),
        facultyUid: text(data.facultyUid),
        startDate: text(data.startDate),
        targetCompletionDate: text(data.targetCompletionDate),
        planHistory: Array.isArray(data.planHistory) ? (data.planHistory as PlanHistoryEntry[]) : [],
      };
    });
  }

  private async listBatchRecords(centreId: string): Promise<BatchRecord[]> {
    const [batchSnap, studentsSnap, leadsSnap] = await Promise.all([
      this.db.collection("batchEntriesData").doc(centreId).get(),
      this.db.collection("students").where("centreId", "==", centreId).get(),
      this.db.collection("leads").where("status", "in", ["Admission Done", "Converted (Admission Done)"]).get(),
    ]);
    const data = batchSnap.exists ? (batchSnap.data() as DocData) : {};
    const entries =
      data.entries && typeof data.entries === "object" ? (data.entries as Record<string, DocData>) : {};
    const removed = new Set(Array.isArray(data.removedFromBatchIds) ? data.removedFromBatchIds.map(String) : []);
    const map = new Map<string, BatchRecord>();
    leadsSnap.docs.forEach((docSnap) => {
      const lead = docSnap.data();
      if (lead.centreId && lead.centreId !== centreId) return;
      if (removed.has(docSnap.id)) return;
      const entry = entries[docSnap.id] ?? {};
      map.set(docSnap.id, {
        id: docSnap.id,
        name: text(entry.name) || text(lead.leadName) || text(lead.name) || "Batch",
        course: text(entry.course) || text(lead.course) || text(lead.courseInterest),
        teacherName: text(entry.teacherId),
        startDate: calendar(entry.startDate) || calendar(lead.admissionDate),
        endDate: calendar(entry.endDate),
      });
    });
    studentsSnap.docs.forEach((docSnap) => {
      if (removed.has(docSnap.id)) return;
      const student = docSnap.data();
      const entry = entries[docSnap.id] ?? {};
      map.set(docSnap.id, {
        id: docSnap.id,
        name: text(entry.name) || personName(student),
        course: text(entry.course) || text(student.course) || text(student.courseInterest),
        teacherName: text(entry.teacherId),
        startDate: calendar(entry.startDate) || calendar(student.courseStartDate) || calendar(student.admissionDate),
        endDate: calendar(entry.endDate) || calendar(student.courseEndDate),
      });
      const extras = Array.isArray(student.courseEnrollments) ? (student.courseEnrollments as DocData[]) : [];
      extras.forEach((item) => {
        const batchId = text(item.batchId);
        const course = text(item.course) || text(item.courseName);
        if (!batchId || !course || map.has(batchId) || removed.has(batchId)) return;
        map.set(batchId, {
          id: batchId,
          name: personName(student),
          course,
          teacherName: "",
          startDate: calendar(student.courseStartDate) || calendar(student.admissionDate),
          endDate: calendar(student.courseEndDate),
        });
      });
    });
    Object.entries(entries).forEach(([id, entry]) => {
      if (!id.startsWith("manual-")) return;
      map.set(id, {
        id,
        name: text(entry.name) || "Manual batch",
        course: text(entry.course),
        teacherName: text(entry.teacherId),
        startDate: calendar(entry.startDate),
        endDate: calendar(entry.endDate),
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private async requireBatch(centreId: string, batchId: string): Promise<BatchRecord> {
    const direct = await this.batchRecord(centreId, batchId);
    if (direct) return direct;
    const batches = await this.listBatchRecords(centreId);
    const batch = batches.find((item) => item.id === batchId);
    if (!batch) throw new SyllabusError("That batch does not exist.", 404);
    return batch;
  }

  private async batchRecord(centreId: string, batchId: string): Promise<BatchRecord | null> {
    const entrySnap = await this.db.collection("batchEntriesData").doc(centreId).get();
    const data = entrySnap.exists ? (entrySnap.data() as DocData) : {};
    const entries = data.entries && typeof data.entries === "object" ? (data.entries as Record<string, DocData>) : {};
    const removed = new Set(Array.isArray(data.removedFromBatchIds) ? data.removedFromBatchIds.map(String) : []);
    if (removed.has(batchId)) return null;
    const entry = entries[batchId] ?? {};
    if (batchId.startsWith("manual-")) {
      if (!entries[batchId]) return null;
      return {
        id: batchId,
        name: text(entry.name) || "Manual batch",
        course: text(entry.course),
        teacherName: text(entry.teacherId),
        startDate: calendar(entry.startDate),
        endDate: calendar(entry.endDate),
      };
    }
    const studentId = batchId.includes("__") ? batchId.slice(0, batchId.indexOf("__")) : batchId;
    const snap = await this.db.collection("students").doc(studentId).get();
    if (!snap.exists) return null;
    const student = snap.data() as DocData;
    if (text(student.centreId) && text(student.centreId) !== centreId) return null;
    let course = text(student.course);
    if (studentId !== batchId) {
      const extras = Array.isArray(student.courseEnrollments) ? (student.courseEnrollments as DocData[]) : [];
      const match = extras.find((item) => text(item.batchId) === batchId);
      if (!match) return null;
      course = text(match.course) || text(match.courseName);
    }
    return {
      id: batchId,
      name: text(entry.name) || personName(student),
      course: text(entry.course) || course,
      teacherName: text(entry.teacherId),
      startDate: calendar(entry.startDate) || calendar(student.courseStartDate) || calendar(student.admissionDate),
      endDate: calendar(entry.endDate) || calendar(student.courseEndDate),
    };
  }

  private async parentCourse(
    student: DocData,
    enrollment: { courseName: string; batchId: string },
    batches: BatchRecord[]
  ): Promise<ParentCourse> {
    const batch = batches.find((item) => item.id === enrollment.batchId);
    const courseName = enrollment.courseName || batch?.course || "Course";
    const batchName = batch?.name || personName(student);
    const empty: ParentCourse = {
      courseName,
      batchId: enrollment.batchId,
      batchName,
      topics: [],
      completionPercent: 0,
      hasPlan: false,
      progress: summarizeProgress([]),
      upcoming: [],
      completedTopics: [],
    };
    const planSnap = await this.db.collection("batchPlans").doc(enrollment.batchId).get();
    if (!planSnap.exists) return empty;
    const plan = planSnap.data() as DocData;
    const version = await this.versionData(text(plan.syllabusId), Number(plan.syllabusVersion));
    const topicDetails = new Map<string, { description: string; weekLabel: string }>();
    version.modules.forEach((module) => {
      module.topics.forEach((topic) => {
        topicDetails.set(topic.id, {
          description: text(topic.description),
          weekLabel: text(module.weekLabel),
        });
      });
    });
    const state = await this.batchTopicState(enrollment.batchId);
    const today = new Date().toISOString().slice(0, 10);
    const flat = version.modules.flatMap((module) =>
      module.topics.map((topic) => ({
        moduleTitle: module.title,
        topicTitle: topic.title,
        topicId: topic.id,
        plannedDate: state.plannedDates.get(topic.id) || "",
        status: state.statuses.get(topic.id) ?? null,
      }))
    );
    const topics: ParentTopic[] = flat.map((topic) => {
      const detail = topicDetails.get(topic.topicId);
      return {
        topicId: topic.topicId,
        moduleTitle: topic.moduleTitle,
        topicTitle: topic.topicTitle,
        description: detail?.description || "",
        weekLabel: detail?.weekLabel || "",
        plannedDate: topic.plannedDate,
        status: parentTopicStatus(topic.status),
      };
    });
    const coveredCount = topics.filter((topic) => topic.status === "covered").length;
    return {
      courseName: text(plan.courseName) || courseName,
      batchId: enrollment.batchId,
      batchName,
      topics,
      completionPercent: topics.length === 0 ? 0 : Math.round((coveredCount / topics.length) * 100),
      hasPlan: true,
      progress: summarizeProgress(flat.map((topic) => ({ plannedDate: topic.plannedDate, status: topic.status }))),
      upcoming: flat
        .filter((topic) => topic.plannedDate >= today && topic.status !== "completed" && topic.plannedDate)
        .slice(0, 8)
        .map((topic) => ({ moduleTitle: topic.moduleTitle, topicTitle: topic.topicTitle, plannedDate: topic.plannedDate })),
      completedTopics: flat
        .filter((topic) => topic.status === "completed")
        .map((topic) => ({ moduleTitle: topic.moduleTitle, topicTitle: topic.topicTitle })),
    };
  }

  private async batchDisplayNames(batchIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    await Promise.all([...new Set(batchIds.filter(Boolean))].map(async (batchId) => {
      const direct = await this.db.collection("students").doc(batchId).get();
      const snap = direct.exists || !batchId.includes("__")
        ? direct
        : await this.db.collection("students").doc(batchId.slice(0, batchId.indexOf("__"))).get();
      if (snap.exists) names.set(batchId, personName(snap.data() as DocData));
    }));
    return names;
  }

  private studentBatches(studentId: string, data: DocData): BatchRecord[] {
    const name = personName(data);
    const startDate = calendar(data.courseStartDate) || calendar(data.admissionDate);
    const endDate = calendar(data.courseEndDate);
    const records: BatchRecord[] = [{
      id: studentId,
      name,
      course: text(data.course),
      teacherName: "",
      startDate,
      endDate,
    }];
    const add = (batchId: string, course: string) => {
      if (!batchId || records.some((record) => record.id === batchId)) return;
      records.push({ id: batchId, name, course, teacherName: "", startDate, endDate });
    };
    add(text(data.syllabusBatchId), text(data.course));
    const extras = Array.isArray(data.courseEnrollments) ? (data.courseEnrollments as DocData[]) : [];
    extras.forEach((item) => add(text(item.batchId), text(item.course) || text(item.courseName)));
    return records;
  }

  private async batchTopicDocs(batchId: string): Promise<{ schedules: Map<string, DocData>; lessons: Map<string, DocData> }> {
    const [scheduleSnap, lessonSnap] = await Promise.all([
      this.db.collection("topicSchedules").where("batchId", "==", batchId).get(),
      this.db.collection("lessonUpdates").where("batchId", "==", batchId).get(),
    ]);
    const schedules = new Map<string, DocData>();
    const lessons = new Map<string, DocData>();
    const remember = (docSnap: { id: string; data: () => DocData }, target: Map<string, DocData>) => {
      const topicId = text(docSnap.data().topicId) || docSnap.id.slice(batchId.length + 1);
      if (topicId) target.set(topicId, docSnap.data());
    };
    scheduleSnap.docs.forEach((docSnap) => remember(docSnap, schedules));
    lessonSnap.docs.forEach((docSnap) => remember(docSnap, lessons));
    return { schedules, lessons };
  }

  private async batchTopicState(batchId: string): Promise<{ plannedDates: Map<string, string>; statuses: Map<string, LessonStatus | null> }> {
    const { schedules, lessons } = await this.batchTopicDocs(batchId);
    const plannedDates = new Map<string, string>();
    schedules.forEach((schedule, topicId) => plannedDates.set(topicId, text(schedule.plannedDate)));
    const statuses = new Map<string, LessonStatus | null>();
    lessons.forEach((lesson, topicId) => statuses.set(topicId, lessonStatus(lesson.status)));
    return { plannedDates, statuses };
  }

  private enrollmentsOf(studentId: string, data: DocData, batchIds: Set<string>): { courseName: string; batchId: string }[] {
    const primaryBatch = this.resolveStudentBatch(studentId, data, batchIds) || studentId;
    const list: { courseName: string; batchId: string }[] = [];
    const primaryCourse = text(data.course);
    if (primaryCourse || primaryBatch) list.push({ courseName: primaryCourse, batchId: primaryBatch });
    const extras = Array.isArray(data.courseEnrollments) ? (data.courseEnrollments as DocData[]) : [];
    extras.forEach((item) => {
      const courseName = text(item.course) || text(item.courseName);
      const batchId = text(item.batchId);
      if (!courseName || !batchId) return;
      if (list.some((row) => row.batchId === batchId || row.courseName.toLowerCase() === courseName.toLowerCase())) return;
      list.push({ courseName, batchId });
    });
    return list;
  }

  private async classTopics(centreId: string, batchId: string, studentId: string, courseName: string): Promise<MyClass["topics"]> {
    const planSnap = await this.db.collection("batchPlans").doc(batchId).get();
    if (!planSnap.exists) {
      const modules = await this.modulesForCourse(centreId, courseName);
      return modules.flatMap((module) =>
        module.topics.map((topic) => ({
          topicId: topic.id,
          moduleTitle: module.title,
          topicTitle: topic.title,
          description: text(topic.description),
          weekLabel: text(module.weekLabel),
          classDate: "",
          lessonStatus: null,
          understanding: null,
          comment: "",
        }))
      );
    }
    const plan = planSnap.data() as DocData;
    const version = await this.versionData(text(plan.syllabusId), Number(plan.syllabusVersion));
    const [{ lessons }, feedbackSnap] = await Promise.all([
      this.batchTopicDocs(batchId),
      this.db.collection("topicFeedback").where("batchId", "==", batchId).get(),
    ]);
    const feedbackByTopic = new Map<string, DocData>();
    feedbackSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocData;
      if (text(data.studentId) !== studentId) return;
      const topicId = text(data.topicId) || docSnap.id.slice(batchId.length + 1);
      if (topicId) feedbackByTopic.set(topicId, data);
    });
    const topics: MyClass["topics"] = [];
    for (const module of version.modules) {
      for (const topic of module.topics) {
        const lesson = lessons.get(topic.id);
        const status = lessonStatus(lesson?.status);
        const feedback = status === "not_covered" || status === "partly_covered" || status === "completed"
          ? feedbackByTopic.get(topic.id)
          : undefined;
        topics.push({
          description: text(topic.description),
          topicId: topic.id,
          moduleTitle: module.title,
          topicTitle: topic.title,
          weekLabel: text(module.weekLabel),
          classDate: text(lesson?.classDate),
          lessonStatus: status,
          understanding: UNDERSTANDING.has(text(feedback?.understanding)) ? (text(feedback?.understanding) as Understanding) : null,
          comment: text(feedback?.comment),
        });
      }
    }
    return topics;
  }

  private resolveStudentBatch(studentId: string, data: DocData, batchIds: Set<string>): string | null {
    const explicit = text(data.syllabusBatchId);
    if (explicit) return batchIds.has(explicit) ? explicit : null;
    return batchIds.has(studentId) ? studentId : null;
  }

  private async studentForUid(uid: string, email = "", phone = "", role = ""): Promise<{ id: string; data: DocData } | null> {
    const snap = await this.db.collection("students").where("studentUid", "==", uid).get();
    if (snap.size > 1) {
      throw new SyllabusError("This login is linked to more than one student. Ask a coordinator to fix it.", 409);
    }
    if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
    if (role !== "student") return null;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = digits(phone);
    const students = await this.db.collection("students").get();
    const match = students.docs.find((docSnap) => {
      const data = docSnap.data();
      if (text(data.studentUid)) return false;
      const studentEmail = text(data.email).toLowerCase();
      const studentPhone = digits(text(data.phone) || text(data.contact));
      return (normalizedEmail && studentEmail === normalizedEmail) || (normalizedPhone.length >= 10 && studentPhone.endsWith(normalizedPhone.slice(-10)));
    });
    if (!match) return null;
    await match.ref.update({ studentUid: uid, updatedAt: new Date().toISOString() });
    return { id: match.id, data: { ...match.data(), studentUid: uid } };
  }

  private async syllabusByCourse(centreId: string, courseName: string): Promise<{ id: string; data: DocData } | null> {
    if (!courseName) return null;
    const snap = await this.db.collection("syllabi").where("centreId", "==", centreId).get();
    const match = snap.docs.find((docSnap) => text(docSnap.data().courseName).toLowerCase() === courseName.toLowerCase());
    return match ? { id: match.id, data: match.data() } : null;
  }

  private async modulesForCourse(centreId: string, courseName: string): Promise<SyllabusModule[]> {
    const syllabus = await this.syllabusByCourse(centreId, courseName);
    if (!syllabus) return [];
    const versions = await this.versionsFor(syllabus.id);
    const published = [...versions].reverse().find((version) => version.status === "published");
    const source = published ?? versions.find((version) => version.status !== "published");
    return source?.modules ?? [];
  }

  private async userByContact(email: string, phone: string): Promise<{ id: string; data: DocData } | null> {
    const users = await this.userDocs();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = digits(phone);
    const matches = [...users.entries()].filter(([, data]) => {
      const userEmail = text(data.email).toLowerCase();
      const userPhone = digits(text(data.phone) || text(data.contact) || text(data.mobile));
      return (normalizedEmail && userEmail === normalizedEmail) || (normalizedPhone.length >= 10 && userPhone.endsWith(normalizedPhone.slice(-10)));
    });
    if (matches.length !== 1) return null;
    return { id: matches[0][0], data: matches[0][1] };
  }

  private async userDocs(): Promise<Map<string, DocData>> {
    const snap = await this.db.collection("users").get();
    const map = new Map<string, DocData>();
    snap.docs.forEach((docSnap) => map.set(docSnap.id, docSnap.data()));
    return map;
  }

  private async userNames(): Promise<Map<string, string>> {
    const users = await this.userDocs();
    const names = new Map<string, string>();
    users.forEach((data, uid) => names.set(uid, personName(data)));
    return names;
  }

  private async facultyOptions(): Promise<FacultyOption[]> {
    const users = await this.userDocs();
    const options: FacultyOption[] = [];
    users.forEach((data, uid) => {
      if (data.approved !== true || normalizeRole(text(data.role)) !== "faculty") return;
      options.push({ uid, name: personName(data), email: text(data.email) });
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async requireFaculty(uid: string): Promise<void> {
    const snap = await this.db.collection("users").doc(uid).get();
    if (!snap.exists || snap.data()?.approved !== true || normalizeRole(text(snap.data()?.role)) !== "faculty") {
      throw new SyllabusError("Choose a faculty member with an approved login.", 400);
    }
  }

  private async attachStudentLogin(
    studentRef: { update: (data: DocData) => Promise<unknown> },
    studentId: string,
    contact: string,
    studentName: string,
    centreId: string,
    courseName: string
  ): Promise<{ uid: string; note: string }> {
    try {
      const user = await this.loginForContact(contact, studentName, centreId, "student", true);
      const role = normalizeRole(text(user.data.role));
      if (role === "parent" || NON_CONVERTIBLE.has(role)) {
        return { uid: "", note: "That mobile number or email belongs to a staff or parent login, so My class was not linked." };
      }
      const existing = await this.db.collection("students").where("studentUid", "==", user.id).get();
      if (existing.docs.some((docSnap) => docSnap.id !== studentId)) {
        return { uid: "", note: "That login is already linked to another student." };
      }
      await studentRef.update({
        studentUid: user.id,
        ...(courseName ? { course: courseName } : {}),
        updatedAt: new Date().toISOString(),
      });
      if (role !== "student" || user.data.approved !== true) {
        await this.db.collection("users").doc(user.id).update({
          role: "student",
          approved: true,
          permissionsGranted: [],
          permissionsRevoked: [],
          updatedAt: new Date().toISOString(),
        });
      }
      const shown = contact.includes("@") ? contact : this.phoneKey(contact);
      return {
        uid: user.id,
        note: user.createdPassword
          ? `Student signs in with ${shown}. Password: ${user.createdPassword}`
          : `Student signs in with ${shown}.`,
      };
    } catch (error) {
      return { uid: "", note: error instanceof SyllabusError ? error.message : "The student login could not be created." };
    }
  }

  private async attachParentLogin(
    studentId: string,
    studentUid: string,
    parentPhone: string,
    studentName: string,
    centreId: string
  ): Promise<string> {
    try {
      const user = await this.loginForContact(parentPhone, `Parent of ${studentName}`, centreId, "parent", true);
      const role = normalizeRole(text(user.data.role));
      if (role === "student" || NON_CONVERTIBLE.has(role) || user.id === studentUid) {
        return "The parent number belongs to a student or staff login, so it was not linked.";
      }
      if (role !== "parent") {
        await this.db.collection("users").doc(user.id).update({
          role: "parent",
          permissionsGranted: [],
          permissionsRevoked: [],
          updatedAt: new Date().toISOString(),
        });
      }
      await this.db.collection("parentLinks").doc(`${user.id}_${studentId}`).set({
        parentUid: user.id,
        studentId,
        createdBy: "student-form",
        createdAt: new Date().toISOString(),
      });
      return user.createdPassword
        ? `Parent signs in with ${parentPhone}. Password: ${user.createdPassword}`
        : `Parent ${parentPhone} is linked.`;
    } catch (error) {
      return error instanceof SyllabusError ? error.message : "The parent login could not be created.";
    }
  }

  private phoneKey(value: string): string {
    const numbers = digits(value);
    return numbers.length >= 10 ? numbers.slice(-10) : "";
  }

  private userPhone(data: DocData): string {
    return this.phoneKey(text(data.phone) || text(data.contact) || text(data.mobile));
  }

  private async loginForContact(
    contact: string,
    person: string,
    centreId: string,
    role: "student" | "parent",
    createIfMissing: boolean
  ): Promise<{ id: string; data: DocData; createdPassword: string }> {
    const raw = contact.trim();
    const email = raw.includes("@") ? raw.toLowerCase() : "";
    const phone = email ? "" : this.phoneKey(raw);
    if (!email && !phone) {
      throw new SyllabusError("Enter an email address or a 10-digit mobile number.", 400);
    }
    const loginEmail = email || phoneLoginEmail(phone);
    const users = await this.userDocs();
    const matches = [...users.entries()].filter(([, data]) => {
      if (email) return text(data.email).toLowerCase() === email;
      return this.userPhone(data) === phone || text(data.email).toLowerCase() === loginEmail;
    });
    if (matches.length > 1) {
      throw new SyllabusError(email ? "More than one user has that email." : "More than one user has that mobile number.", 409);
    }
    if (matches.length === 1) return { id: matches[0][0], data: matches[0][1], createdPassword: "" };
    if (!createIfMissing) {
      throw new SyllabusError(email ? "No user with that email was found." : "No user with that mobile number was found.", 404);
    }

    const admin = await import("firebase-admin");
    const [firstName, ...rest] = person.split(" ").filter(Boolean);
    let createdPassword = "";
    let authUser;
    try {
      authUser = await admin.auth().getUserByEmail(loginEmail);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "auth/user-not-found") throw error;
      createdPassword = role === "parent" ? "Parent#2026" : "Student#2026";
      authUser = await admin.auth().createUser({
        email: loginEmail,
        password: createdPassword,
        displayName: person || loginEmail,
        emailVerified: true,
      });
    }
    const now = new Date().toISOString();
    const profile: DocData = {
      uid: authUser.uid,
      email: loginEmail,
      ...(phone ? { phone } : {}),
      firstName: firstName || (role === "parent" ? "Parent" : "Student"),
      lastName: rest.join(" "),
      role,
      approved: true,
      rejected: false,
      centreId: centreId || "default-centre",
      permissionsGranted: [],
      permissionsRevoked: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collection("users").doc(authUser.uid).set(profile, { merge: true });
    return { id: authUser.uid, data: profile, createdPassword };
  }

  private async userByEmail(email: string): Promise<{ id: string; data: DocData }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) throw new SyllabusError("Enter the user's email address.", 400);
    const users = await this.userDocs();
    const matches = [...users.entries()].filter(([, data]) => text(data.email).toLowerCase() === normalized);
    if (matches.length === 0) throw new SyllabusError("No user with that email was found.", 404);
    if (matches.length > 1) throw new SyllabusError("More than one user has that email.", 409);
    return { id: matches[0][0], data: matches[0][1] };
  }

  private async refreshTeacherUids(batchId: string, facultyUid: string): Promise<void> {
    const schedules = await this.db.collection("topicSchedules").where("batchId", "==", batchId).get();
    const teacherUids = new Set<string>([facultyUid]);
    schedules.docs.forEach((docSnap) => {
      const teacherUid = text(docSnap.data().teacherUid);
      if (teacherUid) teacherUids.add(teacherUid);
    });
    await this.db.collection("batchPlans").doc(batchId).update({ teacherUids: [...teacherUids] });
  }

  private async flattenPlan(
    batchId: string,
    batchName: string,
    version: SyllabusVersion,
    names: Map<string, string>,
    courseName: string,
    facultyUid: string
  ): Promise<FlatTopic[]> {
    const { schedules, lessons } = await this.batchTopicDocs(batchId);
    const facultyName = names.get(facultyUid) || "Unassigned";
    const rows: FlatTopic[] = [];
    for (const module of version.modules) {
      for (const topic of module.topics) {
        const schedule = schedules.get(topic.id);
        const lesson = lessons.get(topic.id);
        rows.push({
          batchId,
          batchName,
          courseName,
          moduleTitle: module.title,
          moduleOrder: module.displayOrder,
          topicId: topic.id,
          topicTitle: topic.title,
          topicOrder: topic.displayOrder,
          plannedDate: text(schedule?.plannedDate),
          status: lessonStatus(lesson?.status),
          facultyName,
          teacherUid: text(schedule?.teacherUid),
        });
      }
    }
    return rows;
  }

  private async buildBatchDetail(centreId: string, batchId: string): Promise<BatchPlanDetail> {
    const [batch, names, planSnap] = await Promise.all([
      this.requireBatch(centreId, batchId),
      this.userNames(),
      this.db.collection("batchPlans").doc(batchId).get(),
    ]);
    const syllabusSnap = batch.course
      ? await this.db.collection("syllabi").where("centreId", "==", centreId).where("courseName", "==", batch.course).limit(1).get()
      : null;
    const syllabusId = planSnap.exists
      ? text(planSnap.data()?.syllabusId)
      : syllabusSnap && !syllabusSnap.empty
        ? syllabusSnap.docs[0].id
        : "";
    const published = syllabusId
      ? (
          await this.db.collection("syllabusVersions").where("syllabusId", "==", syllabusId).where("status", "==", "published").get()
        ).docs
          .map((docSnap) => ({
            syllabusId,
            version: Number(docSnap.data().version ?? 0),
            effectiveDate: text(docSnap.data().effectiveDate),
          }))
          .sort((a, b) => a.version - b.version)
      : [];
    const plan = planSnap.exists ? (planSnap.data() as DocData) : null;
    let topics: TopicScheduleView[] = [];
    let progress = summarizeProgress([]);
    if (plan) {
      const [version, docs, notes] = await Promise.all([
        this.versionData(text(plan.syllabusId), Number(plan.syllabusVersion)),
        this.batchTopicDocs(batchId),
        this.feedbackByTopic([batchId]),
      ]);
      const { schedules, lessons } = docs;
      topics = [];
      for (const module of version.modules) {
        for (const topic of module.topics) {
          const schedule = schedules.get(topic.id) ?? null;
          const lesson = lessons.get(topic.id) ?? null;
          const teacherUid = text(schedule?.teacherUid);
          topics.push({
            moduleId: module.id,
            topicId: topic.id,
            moduleTitle: module.title,
            topicTitle: topic.title,
            description: topic.description,
            weekLabel: text(module.weekLabel),
            feedback: notes[`${batchId}::${topic.id}`] ?? [],
            displayOrder: topic.displayOrder,
            moduleOrder: module.displayOrder,
            estimatedMinutes: topic.estimatedMinutes,
            originalPlannedDate: text(schedule?.originalPlannedDate),
            plannedDate: text(schedule?.plannedDate),
            teacherUid,
            teacherName: names.get(teacherUid) || "",
            scheduleHistory: Array.isArray(schedule?.scheduleHistory) ? (schedule?.scheduleHistory as ScheduleHistoryEntry[]) : [],
            lessonStatus: lessonStatus(lesson?.status),
            classDate: text(lesson?.classDate),
            minutesSpent: typeof lesson?.minutesSpent === "number" ? (lesson?.minutesSpent as number) : null,
            note: text(lesson?.note),
          });
        }
      }
      progress = summarizeProgress(topics.map((topic) => ({ plannedDate: topic.plannedDate, status: topic.lessonStatus })));
    }
    return {
      batch: {
        ...batch,
        plan: plan
          ? {
              syllabusId: text(plan.syllabusId),
              syllabusVersion: Number(plan.syllabusVersion ?? 0),
              facultyUid: text(plan.facultyUid),
              facultyName: names.get(text(plan.facultyUid)) || "",
              startDate: text(plan.startDate),
              targetCompletionDate: text(plan.targetCompletionDate),
              currentPublishedVersion: published.length ? published[published.length - 1].version : null,
            }
          : null,
      },
      syllabusId: plan ? text(plan.syllabusId) : syllabusId,
      syllabusVersion: plan ? Number(plan.syllabusVersion ?? 0) : null,
      facultyUid: text(plan?.facultyUid),
      startDate: text(plan?.startDate),
      targetCompletionDate: text(plan?.targetCompletionDate),
      planHistory: Array.isArray(plan?.planHistory) ? (plan?.planHistory as PlanHistoryEntry[]) : [],
      topics,
      publishedVersions: published,
      progress,
    };
  }
}
