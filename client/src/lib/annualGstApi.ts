import { auth } from "@/lib/firebase";
import type { GstMonthUpload } from "@shared/annualGstTypes";

const MAX_BYTES = 15 * 1024 * 1024;

async function token(): Promise<string> {
  if (!auth?.currentUser) throw new Error("You must be signed in.");
  return auth.currentUser.getIdToken();
}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body.data as T;
}

export const annualGstApi = {
  list: () => send<GstMonthUpload[]>("/api/annual-gst"),
  upload: (file: File, month: string) => {
    if (file.size > MAX_BYTES) throw new Error("Choose a file of 15 MB or less.");
    const params = new URLSearchParams({ month, name: file.name });
    return send<GstMonthUpload>(`/api/annual-gst/upload?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
  },
  remove: (id: string) => send<{ id: string }>(`/api/annual-gst/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Downloads a stored file with the caller's token and returns a local object URL. Revoke it when done. */
  fileObjectUrl: async (fileUrl: string): Promise<string> => {
    const response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${await token()}` } });
    if (!response.ok) throw new Error(response.status === 404 ? "File not found." : `Could not open the file (${response.status}).`);
    return URL.createObjectURL(await response.blob());
  },
};
