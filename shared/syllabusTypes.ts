import type { ProgressSummary } from "./syllabusLogic";

export type SyllabusStatus = "draft" | "published";
export type LessonStatus = "not_covered" | "partly_covered" | "completed";
export type Understanding = "understood" | "partly_understood" | "need_help";

export interface SyllabusTopic {
  id: string;
  title: string;
  description: string;
  displayOrder: number;
  estimatedMinutes: number | null;
}

export interface SyllabusModule {
  id: string;
  title: string;
  displayOrder: number;
  weekLabel?: string;
  topics: SyllabusTopic[];
}

export interface SyllabusPdfWarning {
  page: number;
  row: string;
  message: string;
}

export interface SyllabusPdfPreview {
  modules: SyllabusModule[];
  warnings: SyllabusPdfWarning[];
}

export interface SyllabusVersion {
  id: string;
  syllabusId: string;
  version: number;
  effectiveDate?: string;
  status: SyllabusStatus;
  modules: SyllabusModule[];
  createdBy: string;
  createdAt?: string;
}

export interface OlderBatchUse {
  batchId: string;
  batchName: string;
  syllabusVersion: number;
}

export interface SyllabusRecord {
  id: string;
  courseName: string;
  status: SyllabusStatus;
  currentVersion: number;
  draftVersion: number | null;
  createdBy: string;
  updatedAt?: string;
  batchesOnOlderVersion: OlderBatchUse[];
}

export interface SyllabusDetail extends SyllabusRecord {
  draft: SyllabusVersion | null;
  published: SyllabusVersion | null;
  versions: Pick<SyllabusVersion, "id" | "version" | "status" | "effectiveDate">[];
}

export interface FacultyOption {
  uid: string;
  name: string;
  email: string;
}

export interface BatchSummary {
  id: string;
  name: string;
  course: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  plan: {
    syllabusId: string;
    syllabusVersion: number;
    facultyUid: string;
    facultyName: string;
    startDate: string;
    targetCompletionDate: string;
    currentPublishedVersion: number | null;
  } | null;
}

export interface ScheduleHistoryEntry {
  at: string;
  byUid: string;
  byName: string;
  fromDate: string;
  toDate: string;
  fromTeacherUid: string;
  toTeacherUid: string;
}

export interface PlanHistoryEntry {
  at: string;
  byUid: string;
  byName: string;
  fromVersion: number | null;
  toVersion: number;
  fromSyllabusId: string | null;
  toSyllabusId: string;
}

export interface TopicScheduleView {
  moduleId: string;
  topicId: string;
  moduleTitle: string;
  topicTitle: string;
  description: string;
  displayOrder: number;
  moduleOrder: number;
  estimatedMinutes: number | null;
  weekLabel: string;
  feedback?: StudentFeedbackNote[];
  originalPlannedDate: string;
  plannedDate: string;
  teacherUid: string;
  teacherName: string;
  scheduleHistory: ScheduleHistoryEntry[];
  lessonStatus: LessonStatus | null;
  classDate: string;
  minutesSpent: number | null;
  note: string;
}

export interface PublishedVersionOption {
  syllabusId: string;
  version: number;
  effectiveDate: string;
}

export interface BatchPlanDetail {
  batch: BatchSummary;
  syllabusId: string;
  syllabusVersion: number | null;
  facultyUid: string;
  startDate: string;
  targetCompletionDate: string;
  planHistory: PlanHistoryEntry[];
  topics: TopicScheduleView[];
  publishedVersions: PublishedVersionOption[];
  progress: ProgressSummary;
}

export interface SyllabusAccess {
  role: string;
  canEditSyllabus: boolean;
  canCoordinate: boolean;
  canTeach: boolean;
  canSubmitFeedback: boolean;
  canViewParentProgress: boolean;
  canLinkAccounts: boolean;
  canGrantEdit: boolean;
}

export interface SyllabusMeta {
  courses: string[];
  faculty: FacultyOption[];
  batches: { id: string; name: string; course: string }[];
}

export interface TeachTopic {
  batchId: string;
  batchName: string;
  courseName: string;
  moduleTitle: string;
  topicId: string;
  topicTitle: string;
  plannedDate: string;
  originalPlannedDate: string;
  lessonStatus: LessonStatus | null;
  classDate: string;
  minutesSpent: number | null;
  note: string;
  weekLabel?: string;
  description?: string;
  feedback?: StudentFeedbackNote[];
}

export interface TeachAgenda {
  upcoming: TeachTopic[];
  completed: TeachTopic[];
  topics: TeachTopic[];
}

export interface MyClassTopic {
  topicId: string;
  moduleTitle: string;
  topicTitle: string;
  description?: string;
  weekLabel: string;
  classDate: string;
  lessonStatus: LessonStatus | null;
  understanding: Understanding | null;
  comment: string;
}

export interface MyClassCourse {
  courseName: string;
  batchId: string;
  batchName: string;
  topics: MyClassTopic[];
}

export interface MyClass {
  studentId: string;
  batchId: string;
  batchName: string;
  courseName: string;
  topics: MyClassTopic[];
  courses?: MyClassCourse[];
}

export interface FeedbackCounts {
  understood: number;
  partlyUnderstood: number;
  needHelp: number;
}

export interface StudentFeedbackNote {
  studentName: string;
  understanding: Understanding;
  comment: string;
}

export interface ParentStudentCard {
  studentId: string;
  studentName: string;
  courseName: string;
  batchName: string;
}

export type ParentTopicStatus = "covered" | "partly_covered" | "incomplete" | "not_started";

export interface ParentTopic {
  topicId: string;
  moduleTitle: string;
  topicTitle: string;
  description: string;
  weekLabel: string;
  plannedDate: string;
  status: ParentTopicStatus;
}

export interface ParentCourse {
  courseName: string;
  batchId: string;
  batchName: string;
  topics: ParentTopic[];
  completionPercent: number;
  hasPlan: boolean;
  progress: ProgressSummary;
  upcoming: { moduleTitle: string; topicTitle: string; plannedDate: string }[];
  completedTopics: { moduleTitle: string; topicTitle: string }[];
}

export interface ParentProgress {
  studentId: string;
  studentName: string;
  courseName: string;
  batchId: string;
  batchName: string;
  progress: ProgressSummary;
  upcoming: { moduleTitle: string; topicTitle: string; plannedDate: string }[];
  completedTopics: { moduleTitle: string; topicTitle: string }[];
  topics: ParentTopic[];
  completionPercent: number;
  feedbackCounts: FeedbackCounts;
  hasPlan: boolean;
  courses?: ParentCourse[];
}

export interface DashboardFilters {
  course?: string;
  batchId?: string;
  facultyUid?: string;
  from?: string;
  to?: string;
}

export interface ProgressGroup {
  key: string;
  label: string;
  progress: ProgressSummary;
  planned: number;
  completed: number;
}

export interface DashboardTopicRow {
  batchId: string;
  batchName: string;
  courseName: string;
  moduleTitle: string;
  topicTitle: string;
  plannedDate: string;
  statusLabel: string;
  facultyName: string;
}

export interface DashboardReport {
  scheduleIncomplete: boolean;
  lessonsIncomplete: boolean;
  byCourse: ProgressGroup[];
  byBatch: ProgressGroup[];
  byModule: ProgressGroup[];
  byTopic: DashboardTopicRow[];
  overdue: DashboardTopicRow[];
  upcoming: DashboardTopicRow[];
  partlyCoveredCount: number;
  needHelpCount: number;
  plannedCount: number;
  completedCount: number;
}

export interface DirectoryStudent {
  id: string;
  name: string;
  course: string;
  studentUid: string;
  syllabusBatchId: string;
}

export interface DirectoryUser {
  uid: string;
  name: string;
  email: string;
  role: string;
}

export interface SyllabusDirectory {
  students: DirectoryStudent[];
  users: DirectoryUser[];
  centreHeads: (DirectoryUser & { canEditSyllabus: boolean })[];
}
