import { nestApi } from '@/lib/nestApi';
import { isPostgresPrimary } from '@/lib/nestApi';

const POLL_MS = 5000;

function toIsoDateString(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const maybeToDate = (value as { toDate?: () => Date }).toDate;
    if (typeof maybeToDate === 'function') {
      const parsed = maybeToDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed.toISOString()
        : null;
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('-');
      const parsed = new Date(`${year}-${month}-${day}`);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function serializeDates(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return toIsoDateString(value);
  }

  if (Array.isArray(value)) return value.map(serializeDates);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeDates(v);
    }
    return out;
  }
  return value;
}

function sanitizeFeePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const dateKeys = new Set([
    'createdAt',
    'updatedAt',
    'dueDate',
    'dateOfAdmission',
    'courseStartDate',
    'feesPaidDate',
    'date',
  ]);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'id') continue;
    if (dateKeys.has(key) || (key.startsWith('installment') && key.toLowerCase().includes('date'))) {
      out[key] = toIsoDateString(value);
      continue;
    }
    out[key] = serializeDates(value);
  }
  return out;
}

function reviveDates(record: Record<string, unknown>): Record<string, unknown> {
  const dateKeys = new Set([
    'createdAt',
    'updatedAt',
    'dueDate',
    'dateOfAdmission',
    'courseStartDate',
    'feesPaidDate',
    'date',
  ]);
  const out = { ...record };
  for (const [key, value] of Object.entries(out)) {
    if (
      (dateKeys.has(key) ||
        key.startsWith('installment') && key.toLowerCase().includes('date')) &&
      typeof value === 'string'
    ) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) out[key] = parsed;
    }
  }
  return out;
}

export async function listFeeRecords(centreId?: string): Promise<Record<string, unknown>[]> {
  const items = await nestApi.get<Record<string, unknown>[]>('/crm-records/fees', {
    centreId,
  });
  return (items ?? []).map((item) => reviveDates(item));
}

export async function getFeeRecordById(id: string): Promise<Record<string, unknown>> {
  const item = await nestApi.get<Record<string, unknown>>(`/crm-records/fees/${id}`);
  return reviveDates(item);
}

export async function createFeeRecord(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const body = sanitizeFeePayload(payload);
  const created = await nestApi.post<Record<string, unknown>>('/crm-records/fees', body);
  return reviveDates(created);
}

export async function updateFeeRecord(
  id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const body = sanitizeFeePayload(payload);
  const updated = await nestApi.patch<Record<string, unknown>>(
    `/crm-records/fees/${id}`,
    body,
  );
  return reviveDates(updated);
}

export async function deleteFeeRecord(id: string): Promise<void> {
  await nestApi.delete(`/crm-records/fees/${id}`);
}

export async function listGstRecords(centreId?: string): Promise<Record<string, unknown>[]> {
  const items = await nestApi.get<Record<string, unknown>[]>('/crm-records/gst', {
    centreId,
  });
  return (items ?? []).map((item) => reviveDates(item));
}

export async function createGstRecord(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const body = serializeDates(payload) as Record<string, unknown>;
  const created = await nestApi.post<Record<string, unknown>>('/crm-records/gst', body);
  return reviveDates(created);
}

export async function updateGstRecord(
  id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const body = serializeDates(payload) as Record<string, unknown>;
  const updated = await nestApi.patch<Record<string, unknown>>(
    `/crm-records/gst/${id}`,
    body,
  );
  return reviveDates(updated);
}

export async function deleteGstRecord(id: string): Promise<void> {
  await nestApi.delete(`/crm-records/gst/${id}`);
}

export async function listCustomCourses(
  centreId?: string,
): Promise<Array<{ id: string; courseName: string }>> {
  return nestApi.get('/crm-records/custom-courses', { centreId });
}

export async function createCustomCourse(
  courseName: string,
  centreId?: string,
): Promise<{ id: string; courseName: string }> {
  return nestApi.post('/crm-records/custom-courses', { courseName, centreId });
}

export function subscribeFeeRecords(
  centreId: string,
  onData: (records: Record<string, unknown>[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  let active = true;

  const tick = async () => {
    if (!active) return;
    try {
      const records = await listFeeRecords(centreId);
      if (active) onData(records);
    } catch (error) {
      onError?.(error);
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), POLL_MS);
  return () => {
    active = false;
    clearInterval(timer);
  };
}

export function subscribeGstRecords(
  centreId: string,
  onData: (records: Record<string, unknown>[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  let active = true;

  const tick = async () => {
    if (!active) return;
    try {
      const records = await listGstRecords(centreId);
      if (active) onData(records);
    } catch (error) {
      onError?.(error);
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), POLL_MS);
  return () => {
    active = false;
    clearInterval(timer);
  };
}

export function usePostgresCrmRecords(): boolean {
  return isPostgresPrimary();
}
