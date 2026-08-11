import { auth } from '@/lib/firebase';

export interface StorageUploadResult {
  url: string;
  key: string;
  bucket?: string;
}

async function getAuthHeaders(contentType = 'application/json'): Promise<HeadersInit> {
  if (!auth?.currentUser) {
    throw new Error('You must be signed in to upload files.');
  }
  const token = await auth.currentUser.getIdToken();
  return {
    'Content-Type': contentType,
    Authorization: `Bearer ${token}`,
  };
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file to S3 via the Express API (authenticated).
 */
export async function uploadFileToStorage(
  file: File | Blob,
  storagePath: string,
  fileName?: string
): Promise<StorageUploadResult> {
  const name =
    fileName ||
    (file instanceof File ? file.name : 'upload.bin');
  const contentType =
    (file instanceof File && file.type) || 'application/octet-stream';

  const fileBase64 = await fileToBase64(file);
  const response = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      path: storagePath,
      fileName: name,
      contentType,
      fileBase64,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Upload failed (${response.status})`);
  }

  return {
    url: data.url,
    key: data.key,
    bucket: data.bucket,
  };
}

/**
 * Delete a file from S3 by object key.
 */
export async function deleteFileFromStorage(key: string): Promise<void> {
  const response = await fetch('/api/storage/delete', {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ key }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Delete failed (${response.status})`);
  }
}

/**
 * Upload a blob with a generated path under a folder prefix.
 */
export async function uploadBlob(
  blob: Blob,
  folder: string,
  fileName: string,
  centreId?: string
): Promise<StorageUploadResult> {
  const path = centreId
    ? `uploads/${centreId}/${folder}`
    : `uploads/${folder}`;
  return uploadFileToStorage(blob, path, fileName);
}
