/**
 * Shared API helpers for ZICA/ZIMA Curriculum and Fees pages.
 * Ensures consistent API URLs and path handling in both local and deployed environments.
 */

/** Base URL for API calls. Use VITE_API_BASE if API is on a different host (e.g. production proxy). */
function getApiBase(): string {
  if (typeof import.meta.env.VITE_API_BASE === "string" && import.meta.env.VITE_API_BASE.trim()) {
    return import.meta.env.VITE_API_BASE.trim().replace(/\/+$/, "");
  }
  if (import.meta.env.PROD && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

/** Full URL for an API path (e.g. list-files, delete-file). Works with dev proxy and production. */
export function getAcademicApiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}/api${p}` : `/api${p}`;
}

/** Delete-file URL with fileId in query so it works even when DELETE body is stripped (e.g. some proxies). */
export function getDeleteFileUrl(fileId: string): string {
  const url = getAcademicApiUrl("delete-file");
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}fileId=${encodeURIComponent(fileId)}`;
}

/** Normalize folder path for comparison (strip leading slashes). ImageKit may return paths with or without leading slash. */
export function normalizeFolderPath(path: string): string {
  return (path || "").replace(/^\/+/, "");
}

/** Normalize file path from API (strip leading slashes). */
export function normalizeFilePath(raw: string | undefined): string {
  return (raw || "").replace(/^\/+/, "");
}

/** Parse list-files API response. Server returns array; handle edge cases. */
export function parseListFilesResponse(data: unknown): Array<{ filePath?: string; path?: string; name?: string; url?: string; fileId?: string; size?: number }> {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "files" in data && Array.isArray((data as { files: unknown }).files)) {
    return (data as { files: unknown[] }).files;
  }
  return [];
}

/** Fetch with one retry on failure (helps with transient network issues). */
export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 1): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || i === retries) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    if (i < retries) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastError ?? new Error("Request failed");
}
