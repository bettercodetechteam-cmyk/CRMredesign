import { auth } from '@/lib/firebase';

/**
 * NestJS CRM API client — PostgreSQL is the primary CRM database.
 *
 * Dev default goes through Vite proxy: /nest-api → http://localhost:4000
 * Override with VITE_NEST_API_URL (e.g. http://localhost:4000/api/v1).
 */

export interface NestApiSuccess<T> {
  success: true;
  statusCode: number;
  data: T;
  path: string;
  timestamp: string;
}

export interface NestApiErrorBody {
  success: false;
  statusCode: number;
  message: string;
  errors?: unknown;
  path?: string;
  timestamp?: string;
}

export class NestApiError extends Error {
  readonly statusCode: number;
  readonly errors?: unknown;

  constructor(statusCode: number, message: string, errors?: unknown) {
    super(message);
    this.name = 'NestApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

function nestBaseUrl(): string {
  const configured = import.meta.env.VITE_NEST_API_URL as string | undefined;
  if (configured?.trim()) {
    return configured.replace(/\/$/, '');
  }
  // Proxied in vite.config.ts → Nest global prefix /api/v1
  return '/nest-api/api/v1';
}

/** PostgreSQL via Nest API is the primary CRM storage (default on). */
export function isPostgresPrimary(): boolean {
  return String(import.meta.env.VITE_CRM_STORAGE ?? 'postgres').toLowerCase() !== 'firestore';
}

function nestFeatureEnabled(flag: string | undefined): boolean {
  if (!isPostgresPrimary()) return false;
  return String(flag ?? 'true').toLowerCase() === 'true';
}

export function isNestLeadsEnabled(): boolean {
  return nestFeatureEnabled(import.meta.env.VITE_USE_NEST_LEADS);
}

export function isNestDashboardEnabled(): boolean {
  return nestFeatureEnabled(import.meta.env.VITE_USE_NEST_DASHBOARD);
}

export function isNestFeesEnabled(): boolean {
  return nestFeatureEnabled(import.meta.env.VITE_USE_NEST_FEES);
}

async function authHeaders(): Promise<HeadersInit> {
  if (!auth?.currentUser) {
    throw new NestApiError(401, 'You must be signed in to use the Nest CRM API.');
  }
  const token = await auth.currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function nestRequest<T>(
  method: string,
  path: string,
  options?: { body?: unknown; params?: Record<string, unknown> },
): Promise<T> {
  const headers = await authHeaders();
  const url = `${nestBaseUrl()}${path}${toQuery(options?.params)}`;

  const response = await fetch(url, {
    method,
    headers,
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | NestApiSuccess<T>
    | NestApiErrorBody
    | Record<string, unknown>;

  if (!response.ok || (payload as NestApiErrorBody).success === false) {
    const errorBody = payload as NestApiErrorBody;
    const detail = Array.isArray(errorBody.errors)
      ? errorBody.errors.join('; ')
      : typeof errorBody.errors === 'string'
        ? errorBody.errors
        : undefined;
    throw new NestApiError(
      errorBody.statusCode ?? response.status,
      detail || errorBody.message || `Nest API error (${response.status})`,
      errorBody.errors,
    );
  }

  if ('data' in payload) {
    return (payload as NestApiSuccess<T>).data;
  }

  return payload as T;
}

export const nestApi = {
  get: <T>(path: string, params?: Record<string, unknown>) =>
    nestRequest<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown) =>
    nestRequest<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) =>
    nestRequest<T>('PATCH', path, { body }),
  delete: <T>(path: string) => nestRequest<T>('DELETE', path),
};
