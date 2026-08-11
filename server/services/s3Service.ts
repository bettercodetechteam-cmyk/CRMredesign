import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
}

function sanitizeStorageKey(raw: string): string {
  const normalized = raw
    .replace(/\\/g, '/')
    .replace(/\.\.+/g, '')
    .replace(/^\/+/, '')
    .trim();

  if (!normalized) {
    throw new Error('Invalid storage path');
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_\-.]*$/.test(normalized)) {
    throw new Error('Storage path contains invalid characters');
  }

  return normalized;
}

export class S3StorageService {
  private client: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly enabled: boolean;

  constructor() {
    this.bucket = (process.env.AWS_S3_BUCKET || '').trim();
    this.region = (process.env.AWS_REGION || 'ap-south-1').trim();
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    this.enabled = Boolean(this.bucket && accessKeyId && secretAccessKey);

    if (this.enabled) {
      const config: S3ClientConfig = {
        region: this.region,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
      };
      this.client = new S3Client(config);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      bucket: this.bucket || null,
      region: this.region,
    };
  }

  getPublicUrl(key: string): string {
    const publicBase = process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (publicBase) {
      return `${publicBase}/${key}`;
    }
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`;
  }

  async upload(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<S3UploadResult> {
    if (!this.client || !this.bucket) {
      throw new Error('S3 storage is not configured. Set AWS_S3_BUCKET and credentials in .env');
    }

    if (params.body.length > MAX_UPLOAD_BYTES) {
      throw new Error(`File exceeds maximum upload size (${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`);
    }

    const key = sanitizeStorageKey(params.key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.body,
        ContentType: params.contentType || 'application/octet-stream',
      })
    );

    return {
      key,
      url: this.getPublicUrl(key),
      bucket: this.bucket,
    };
  }

  async delete(key: string): Promise<void> {
    if (!this.client || !this.bucket) {
      throw new Error('S3 storage is not configured');
    }

    const sanitized = sanitizeStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: sanitized,
      })
    );
  }
}

export const s3StorageService = new S3StorageService();

export function buildStorageKey(folder: string, fileName: string, centreId?: string): string {
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/^\/+|\/+$/g, '');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
  const prefix = centreId ? `uploads/${centreId}` : 'uploads';
  return `${prefix}/${safeFolder}/${Date.now()}_${safeName}`;
}
