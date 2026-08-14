import { nestCoursesApi } from '@/services/nest/coursesApi';
import { nestLeadsApi } from '@/services/nest/leadsApi';
import { nestStudentsApi, type NestStudent } from '@/services/nest/studentsApi';
import { splitLeadName, normalizeNestPhone } from '@/lib/nestLeadMapper';

type NestStudentWithRelations = NestStudent & {
  leadId?: string | null;
  course?: { id?: string; name?: string; code?: string; durationMonths?: number };
  batch?: { id?: string; name?: string };
  centre?: { id?: string; code?: string; name?: string };
  metadata?: Record<string, unknown> | null;
};

const STUDENT_METADATA_KEYS = [
  'srNo',
  'source',
  'admissionMonth',
  'zicaZima',
  'zicaSubCategory',
  'feesStructure',
  'course',
  'courseDuration',
  'courseStartDate',
  'actualFees',
  'discountedFees',
  'feesPaid',
  'feesPaidDate',
  'feesBalance',
  'paymentMode',
  'chequeNumber',
  'noOfInstallments',
  'installmentsPaid',
  'remainingInstallments',
  'dueDate',
  'remarks',
] as const;

function extractStudentMetadata(studentData: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of STUDENT_METADATA_KEYS) {
    if (studentData[key] !== undefined) metadata[key] = studentData[key];
  }
  if (studentData.course && !metadata.course) metadata.course = studentData.course;
  return metadata;
}

let courseCache: Array<{ id: string; name: string; code: string }> | null = null;

async function loadCourses(): Promise<Array<{ id: string; name: string; code: string }>> {
  if (courseCache) return courseCache;
  const collected: Array<{ id: string; name: string; code: string }> = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 20) {
    const result = await nestCoursesApi.list({ limit: 100, page });
    collected.push(
      ...(result?.items ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })),
    );
    totalPages = result?.meta?.totalPages ?? 1;
    page += 1;
  }

  courseCache = collected;
  return courseCache;
}

export async function resolveCourseId(courseLabel: string): Promise<string | null> {
  const label = courseLabel.trim();
  if (!label) return null;
  if (/^[0-9a-f-]{36}$/i.test(label)) return label;

  const courses = await loadCourses();
  const lower = label.toLowerCase();
  const exact = courses.find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.code.toLowerCase() === lower ||
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()),
  );
  return exact?.id ?? courses[0]?.id ?? null;
}

export async function getCourseNameById(courseId: string): Promise<string | null> {
  if (!courseId || !/^[0-9a-f-]{36}$/i.test(courseId)) return null;
  const courses = await loadCourses();
  return courses.find((c) => c.id === courseId)?.name ?? null;
}

function resolveStudentCourseLabel(
  metadata: Record<string, unknown>,
  courseName: string,
): string {
  const fromMeta = metadata.course;
  if (typeof fromMeta === 'string' && fromMeta.trim()) {
    return fromMeta.trim();
  }
  return courseName.trim();
}

export async function enrichStudentRecordForUi(
  student: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let course = String(student.course ?? '').trim();
  if (!course && typeof student.courseId === 'string') {
    course = (await getCourseNameById(student.courseId)) ?? '';
  }
  const leadId = student.leadId ?? student.lead_id;
  if (!course && typeof leadId === 'string' && leadId) {
    try {
      const { nestLeadsApi } = await import('@/services/nest/leadsApi');
      const { mapNestLeadToUi } = await import('@/lib/nestLeadMapper');
      const lead = await nestLeadsApi.get(leadId);
      course = mapNestLeadToUi(lead as Parameters<typeof mapNestLeadToUi>[0]).course || '';
    } catch {
      /* lead may be unavailable */
    }
  }
  return course ? { ...student, course } : student;
}

export function mapNestStudentToUi(student: NestStudentWithRelations): Record<string, unknown> {
  const courseName = student.course?.name ?? '';
  const fullName = [student.firstName, student.lastName].filter(Boolean).join(' ').trim();
  const metadata = (student.metadata ?? {}) as Record<string, unknown>;

  return {
    ...metadata,
    id: student.id,
    rollNo: student.rollNo,
    srNo: metadata.srNo ?? student.rollNo,
    centreId: student.centreId,
    courseId: student.courseId,
    batchId: student.batchId,
    firstName: student.firstName,
    lastName: student.lastName ?? '',
    leadName: fullName,
    studentName: fullName,
    email: student.email ?? '',
    emailId: student.email ?? '',
    phone: student.phone,
    contact: student.phone,
    parentsContactNumber: student.parentPhone ?? metadata.parentsContactNumber ?? '',
    parentPhone: student.parentPhone ?? '',
    parentName: student.parentName ?? '',
    address: student.address ?? '',
    course: resolveStudentCourseLabel(metadata, courseName),
    courseDuration:
      metadata.courseDuration?.toString() ?? student.course?.durationMonths?.toString() ?? '',
    leadId: student.leadId ?? metadata.leadId ?? null,
    admissionDate: student.admissionDate,
    status: student.status,
    createdAt: student.createdAt ? new Date(student.createdAt) : new Date(),
    updatedAt: student.updatedAt ? new Date(student.updatedAt) : new Date(),
    _source: 'postgres',
  };
}

export function buildNestCreateStudentPayload(
  studentData: Record<string, unknown>,
  centreId?: string,
): Record<string, unknown> {
  const firstName =
    String(studentData.firstName || '').trim() ||
    splitLeadName(
      String(studentData.leadName || studentData.studentName || 'Unknown'),
    ).firstName;
  const lastName =
    String(studentData.lastName || '').trim() ||
    splitLeadName(String(studentData.leadName || studentData.studentName || '')).lastName;

  const payload: Record<string, unknown> = {
    firstName,
    lastName: lastName || undefined,
    phone: normalizeNestPhone(studentData.phone || studentData.contact),
    email: String(studentData.email || studentData.emailId || '').trim() || undefined,
    parentName: String(studentData.parentName || '').trim() || undefined,
    parentPhone: studentData.parentsContactNumber || studentData.parentPhone
      ? normalizeNestPhone(studentData.parentsContactNumber || studentData.parentPhone)
      : undefined,
    address: String(studentData.address || '').trim() || undefined,
    batchId: studentData.batchId || undefined,
    admissionDate: studentData.admissionDate
      ? new Date(String(studentData.admissionDate)).toISOString().slice(0, 10)
      : undefined,
  };

  if (studentData.courseId && /^[0-9a-f-]{36}$/i.test(String(studentData.courseId))) {
    payload.courseId = studentData.courseId;
  }

  if (centreId && /^[0-9a-f-]{36}$/i.test(centreId)) {
    payload.centreId = centreId;
  }

  const metadata = extractStudentMetadata(studentData);
  if (Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  return payload;
}

export function buildNestUpdateStudentPayload(
  studentData: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (studentData.firstName !== undefined) {
    payload.firstName = String(studentData.firstName).trim();
  }
  if (studentData.lastName !== undefined) {
    payload.lastName = String(studentData.lastName).trim() || null;
  }
  if (studentData.phone !== undefined || studentData.contact !== undefined) {
    payload.phone = normalizeNestPhone(studentData.phone || studentData.contact);
  }
  if (studentData.email !== undefined || studentData.emailId !== undefined) {
    const email = String(studentData.email || studentData.emailId || '').trim();
    payload.email = email || null;
  }
  if (studentData.parentName !== undefined) {
    payload.parentName = String(studentData.parentName).trim() || null;
  }
  if (
    studentData.parentsContactNumber !== undefined ||
    studentData.parentPhone !== undefined
  ) {
    const parentPhone = studentData.parentsContactNumber || studentData.parentPhone;
    payload.parentPhone = parentPhone ? normalizeNestPhone(parentPhone) : null;
  }
  if (studentData.address !== undefined) {
    payload.address = String(studentData.address).trim() || null;
  }

  const metadata = extractStudentMetadata(studentData);
  if (Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  return payload;
}

export async function buildNestUpdateStudentPayloadAsync(
  studentData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const payload = buildNestUpdateStudentPayload(studentData);
  if (studentData.course) {
    const courseId = await resolveCourseId(String(studentData.course));
    if (courseId) payload.courseId = courseId;
  } else if (
    studentData.courseId &&
    /^[0-9a-f-]{36}$/i.test(String(studentData.courseId))
  ) {
    payload.courseId = studentData.courseId;
  }
  return payload;
}

export async function fetchAllNestStudents(centreId?: string): Promise<Record<string, unknown>[]> {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const collected: Record<string, unknown>[] = [];

  while (page <= totalPages && page <= 50) {
    const params: Record<string, unknown> = { page, limit: pageSize };
    if (centreId && /^[0-9a-f-]{36}$/i.test(centreId)) {
      params.centreId = centreId;
    }

    const result = await nestStudentsApi.list(params);
    const items = (result?.items ?? []) as NestStudentWithRelations[];
    collected.push(...items.map(mapNestStudentToUi));
    totalPages = result?.meta?.totalPages || 1;
    page += 1;
  }

  return collected;
}

export async function createNestStudentFromLead(
  leadId: string,
  studentData: Record<string, unknown>,
  centreId?: string,
): Promise<string | null> {
  const { firstName, lastName } = splitLeadName(
    String(
      studentData.firstName ||
        studentData.leadName ||
        studentData.studentName ||
        'Unknown',
    ),
  );

  let courseId: string | null = null;
  const resolvedFromCourseLabel = await resolveCourseId(String(studentData.course || ''));
  if (resolvedFromCourseLabel) {
    courseId = resolvedFromCourseLabel;
  } else if (studentData.courseId && /^[0-9a-f-]{36}$/i.test(String(studentData.courseId))) {
    courseId = String(studentData.courseId);
  } else if (
    studentData.courseInterestId &&
    /^[0-9a-f-]{36}$/i.test(String(studentData.courseInterestId))
  ) {
    courseId = String(studentData.courseInterestId);
  }

  if (!courseId) {
    throw new Error('Could not resolve course for student. Add courses in PostgreSQL first.');
  }

  const convertBody: Record<string, unknown> = {
    courseId,
    firstName,
    lastName: lastName || undefined,
    phone: normalizeNestPhone(studentData.phone || studentData.contact),
    email: String(studentData.email || studentData.emailId || '').trim() || undefined,
    parentPhone:
      studentData.parentsContactNumber || studentData.parentPhone
        ? normalizeNestPhone(studentData.parentsContactNumber || studentData.parentPhone)
        : undefined,
    admissionDate: studentData.admissionDate
      ? new Date(String(studentData.admissionDate)).toISOString().slice(0, 10)
      : undefined,
    batchId: studentData.batchId || undefined,
  };

  const result = await nestLeadsApi.convert(leadId, convertBody);
  const student = (result as { student?: NestStudentWithRelations }).student;
  const studentId = student?.id ?? null;

  const metadata = extractStudentMetadata(studentData);
  if (studentId && Object.keys(metadata).length > 0) {
    await nestStudentsApi.update(studentId, { metadata });
  }

  return studentId;
}

export async function createNestStudent(
  studentData: Record<string, unknown>,
  centreId?: string,
): Promise<string | null> {
  const payload = buildNestCreateStudentPayload(studentData, centreId);

  if (!payload.courseId) {
    const courseId = await resolveCourseId(String(studentData.course || ''));
    if (!courseId) {
      throw new Error('Could not resolve course for student. Add courses in PostgreSQL first.');
    }
    payload.courseId = courseId;
  }

  const created = (await nestStudentsApi.create(payload)) as NestStudentWithRelations;
  return created?.id ?? null;
}

export async function updateNestStudent(
  id: string,
  studentData: Record<string, unknown>,
): Promise<string | null> {
  const payload = await buildNestUpdateStudentPayloadAsync(studentData);
  if (Object.keys(payload).length === 0) return id;
  await nestStudentsApi.update(id, payload);
  return id;
}

export async function deleteNestStudent(id: string): Promise<string | null> {
  await nestStudentsApi.remove(id);
  return id;
}

export async function getNestStudentById(id: string): Promise<Record<string, unknown> | null> {
  const student = (await nestStudentsApi.get(id)) as NestStudentWithRelations;
  if (!student) return null;
  const mapped = mapNestStudentToUi(student);
  return enrichStudentRecordForUi(mapped);
}
