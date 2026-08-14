import type { LeadRecord } from '@/lib/centreDataStore';
import type { NestLead } from '@/services/nest/leadsApi';
import { nestCoursesApi } from '@/services/nest/coursesApi';

/** UI label ← Nest LeadStatus */
const NEST_STATUS_TO_UI: Record<string, string> = {
  new: 'Not Contacted',
  contacted: 'Not Contacted',
  interested: 'Hot Lead',
  visit_scheduled: 'Visited',
  visited: 'Visited',
  converted: 'Admission Done',
  lost: 'Not Interested',
};

/** UI label → Nest LeadStatus */
const UI_STATUS_TO_NEST: Record<string, string> = {
  'Not Contacted': 'new',
  'Cold Lead': 'contacted',
  'Hot Lead': 'interested',
  Visited: 'visited',
  Placement: 'interested',
  'Job Seeker': 'interested',
  'Admission Done': 'converted',
  'Not Interested': 'lost',
  Converted: 'converted',
  Lost: 'lost',
  New: 'new',
  Contacted: 'contacted',
  Interested: 'interested',
};

/** UI source label → Nest LeadSource enum */
const UI_SOURCE_TO_NEST: Record<string, string> = {
  'Direct Walk-in': 'walk_in',
  'Walk-in': 'walk_in',
  Walkin: 'walk_in',
  'Website Inquiry': 'online',
  Website: 'online',
  Online: 'online',
  'Google Ad': 'online',
  Facebook: 'social_media',
  Instagram: 'social_media',
  'Social Media': 'social_media',
  'Parent Referral': 'referral',
  'Student Referral': 'referral',
  Referral: 'referral',
  Phone: 'phone',
  'Phone Call': 'phone',
  Event: 'event',
  'Career Fair / Exhibition': 'event',
  Webinar: 'event',
  Import: 'import',
  Other: 'other',
};

const NEST_SOURCE_TO_UI: Record<string, string> = {
  walk_in: 'Direct Walk-in',
  online: 'Website Inquiry',
  referral: 'Parent Referral',
  social_media: 'Social Media',
  phone: 'Phone Call',
  event: 'Event',
  import: 'Import',
  other: 'Other',
};

export function mapNestStatusToUi(status: string): string {
  return NEST_STATUS_TO_UI[status] ?? status;
}

export function mapUiStatusToNest(status: string): string {
  return UI_STATUS_TO_NEST[status] ?? 'new';
}

export function mapNestSourceToUi(source: string): string {
  return NEST_SOURCE_TO_UI[source] ?? source;
}

export function mapUiSourceToNest(source: string): string {
  if (!source) return 'other';
  if (UI_SOURCE_TO_NEST[source]) return UI_SOURCE_TO_NEST[source];
  const lower = source.toLowerCase();
  if (lower.includes('walk')) return 'walk_in';
  if (lower.includes('refer')) return 'referral';
  if (lower.includes('facebook') || lower.includes('instagram') || lower.includes('social')) {
    return 'social_media';
  }
  if (lower.includes('phone') || lower.includes('call')) return 'phone';
  if (lower.includes('web') || lower.includes('google') || lower.includes('online')) {
    return 'online';
  }
  return 'other';
}

/** Normalize to Indian 10-digit mobile for Nest validation. */
export function normalizeNestPhone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  const ten = digits.length >= 10 ? digits.slice(-10) : digits;
  return ten;
}

export function isValidNestPhone(value: unknown): boolean {
  return /^[6-9][0-9]{9}$/.test(normalizeNestPhone(value));
}

function ensureNestFirstName(fullName: string): { firstName: string; lastName?: string } {
  const { firstName, lastName } = splitLeadName(fullName);
  const safeFirst =
    firstName.length >= 2 ? firstName : firstName.length === 1 ? `${firstName}.` : 'Unknown';
  return { firstName: safeFirst, lastName };
}

export function splitLeadName(fullName: string): { firstName: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown' };
  if (parts.length === 1) return { firstName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
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

/** Map UI course label → Postgres course id for lead/student writes. */
export async function resolveCourseInterestId(courseLabel?: string): Promise<string | null> {
  const label = String(courseLabel ?? '').trim();
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
  return exact?.id ?? null;
}

async function applyCourseToPayload(
  payload: Record<string, unknown>,
  input: { course?: string; courseInterestId?: string | null },
): Promise<void> {
  if (input.course?.trim()) {
    const resolved = await resolveCourseInterestId(input.course);
    if (resolved) {
      payload.courseInterestId = resolved;
      return;
    }
  }
  if (input.courseInterestId && /^[0-9a-f-]{36}$/i.test(input.courseInterestId)) {
    payload.courseInterestId = input.courseInterestId;
  }
}

/**
 * Map Nest lead → UI LeadRecord shape used by Leads.tsx / LeadForm.
 */
export function mapNestLeadToUi(lead: NestLead & Record<string, unknown>): LeadRecord {
  const firstName = String(lead.firstName ?? '');
  const lastName = lead.lastName ? String(lead.lastName) : '';
  const leadName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const assigned =
    (lead.assignedTo as { firstName?: string; lastName?: string } | undefined) ?? undefined;
  const counselorName = assigned
    ? [assigned.firstName, assigned.lastName].filter(Boolean).join(' ')
    : '';
  const courseInterest = lead.courseInterest as { name?: string } | undefined;

  return {
    id: lead.id,
    leadNo: lead.leadNo,
    leadName,
    contact: lead.phone,
    emailId: lead.email ?? '',
    course: courseInterest?.name ?? '',
    courseDuration: '',
    education: '',
    source: mapNestSourceToUi(lead.source),
    status: mapNestStatusToUi(lead.status),
    counselorName,
    cityArea: '',
    remark: lead.notes ?? '',
    notes: lead.notes ?? '',
    centreId: lead.centreId,
    assignedToId: lead.assignedToId,
    courseInterestId: lead.courseInterestId,
    version: lead.version,
    nextFollowUpDate: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null,
    followUpDate: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null,
    createdAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
    updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : new Date(),
    enquiryDate: lead.createdAt ? new Date(lead.createdAt) : new Date(),
    _sourceCollection: 'nest',
    nestStatus: lead.status,
    nestSource: lead.source,
  } as LeadRecord;
}

export async function buildNestCreatePayloadAsync(input: {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  status?: string;
  notes?: string;
  remark?: string;
  nextFollowUpDate?: Date | string | null;
  followUpDate?: Date | string | null;
  course?: string;
  courseInterestId?: string;
  assignedToId?: string;
  centreId?: string;
}): Promise<Record<string, unknown>> {
  const payload = buildNestCreatePayload(input);
  await applyCourseToPayload(payload, {
    course: input.course,
    courseInterestId: input.courseInterestId,
  });
  return payload;
}

export function buildNestCreatePayload(input: {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  status?: string;
  notes?: string;
  remark?: string;
  nextFollowUpDate?: Date | string | null;
  followUpDate?: Date | string | null;
  courseInterestId?: string;
  assignedToId?: string;
  centreId?: string;
}): Record<string, unknown> {
  const { firstName, lastName } = ensureNestFirstName(input.name);
  const phone = normalizeNestPhone(input.phone);
  if (!isValidNestPhone(phone)) {
    throw new Error('Enter a valid 10-digit Indian mobile number (starting with 6–9).');
  }
  const followUp = input.nextFollowUpDate || input.followUpDate;
  let followUpIso: string | undefined;
  if (followUp) {
    const parsed = followUp instanceof Date ? followUp : new Date(followUp);
    if (!Number.isNaN(parsed.getTime())) {
      followUpIso = parsed.toISOString();
    }
  }

  const payload: Record<string, unknown> = {
    firstName,
    lastName,
    phone,
    source: mapUiSourceToNest(input.source ?? 'Other'),
    status: mapUiStatusToNest(input.status ?? 'Not Contacted'),
    notes: input.notes || input.remark || undefined,
    nextFollowUpAt: followUpIso,
  };

  if (input.email?.trim()) payload.email = input.email.trim();
  if (input.courseInterestId) payload.courseInterestId = input.courseInterestId;
  if (input.assignedToId) payload.assignedToId = input.assignedToId;
  // Only pass centreId if it looks like a UUID (Postgres centres)
  if (input.centreId && /^[0-9a-f-]{36}$/i.test(input.centreId)) {
    payload.centreId = input.centreId;
  }

  // Converted must go through convert endpoint — never create as converted
  if (payload.status === 'converted') {
    payload.status = 'interested';
  }
  if (payload.status === 'lost' && !payload.notes) {
    payload.status = 'new';
  }

  return payload;
}

export async function buildNestUpdatePayloadAsync(input: {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  remark?: string;
  nextFollowUpDate?: Date | string | null;
  followUpDate?: Date | string | null;
  version?: number;
  course?: string;
  courseInterestId?: string | null;
}): Promise<Record<string, unknown>> {
  const payload = buildNestUpdatePayload(input);
  if (input.course !== undefined || input.courseInterestId !== undefined) {
    await applyCourseToPayload(payload, {
      course: input.course,
      courseInterestId: input.courseInterestId,
    });
  }
  return payload;
}

export function buildNestUpdatePayload(input: {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  remark?: string;
  nextFollowUpDate?: Date | string | null;
  followUpDate?: Date | string | null;
  version?: number;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const { firstName, lastName } = splitLeadName(input.name);
    payload.firstName = firstName;
    payload.lastName = lastName ?? null;
  }
  if (input.phone !== undefined) payload.phone = normalizeNestPhone(input.phone);
  if (input.email !== undefined) payload.email = input.email?.trim() || null;
  if (input.source !== undefined) payload.source = mapUiSourceToNest(input.source);
  if (input.notes !== undefined || input.remark !== undefined) {
    payload.notes = input.notes || input.remark || null;
  }
  if (input.nextFollowUpDate !== undefined || input.followUpDate !== undefined) {
    const followUp = input.nextFollowUpDate ?? input.followUpDate;
    payload.nextFollowUpAt =
      followUp instanceof Date
        ? followUp.toISOString()
        : followUp
          ? new Date(String(followUp)).toISOString()
          : null;
  }
  if (input.version !== undefined) payload.version = input.version;

  return payload;
}

export function isNestBackedLead(lead: { id?: string; _sourceCollection?: unknown } | null | undefined): boolean {
  if (!lead) return false;
  if (lead._sourceCollection === 'nest') return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(lead.id ?? ''),
  );
}
