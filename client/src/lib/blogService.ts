import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

export type BlogSectionType = 'heading' | 'text_block' | 'grid_list' | 'image' | 'comparison_table';

export interface BlogSection {
  id: string;
  type: BlogSectionType;
  content: any;
}

export type BlogStatus = 'draft' | 'published';

export interface Blog {
  id?: string;
  title: string;
  slug: string;
  author: string;
  category: string;
  coverImage: string;
  date: Date | Timestamp;
  readTime: string;
  sections: BlogSection[];
  faqs: { question: string; answer: string }[];
  meta: {
    title: string;
    description: string;
    keywords: string;
  };
  status?: BlogStatus;
  publishedAt?: Date | Timestamp;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export const PUBLIC_BLOG_BASE_URL = 'https://zicazimapcmc.com/blogs';

/** Max size of the file the writer can pick (original). */
export const BLOG_IMAGE_MAX_PICK_BYTES = 1024 * 1024; // 1MB

/** Longest side after resize (covers + in-article images). */
export const BLOG_IMAGE_MAX_EDGE = 1200;

/** Target compressed JPEG size before Storage upload. */
export const BLOG_IMAGE_TARGET_BYTES = 500 * 1024;

/** Storage upload timeout — fail fast to embedded fallback when CORS/network blocks. */
const STORAGE_UPLOAD_TIMEOUT_MS = 12_000;

export type ImageUploadPhase = 'preparing' | 'uploading';

const COLLECTION_NAME = 'blogs';

function withPublishTimestamps(blogData: Partial<Blog>): Record<string, unknown> {
  const updates: Record<string, unknown> = { ...blogData };
  if (blogData.status === 'published') {
    updates.publishedAt = serverTimestamp();
  }
  return updates;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Resize and compress to JPEG for fast uploads and small Firestore docs.
 */
async function compressImageToBlob(
  file: File,
  maxEdge = BLOG_IMAGE_MAX_EDGE,
  targetBytes = BLOG_IMAGE_TARGET_BYTES
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.82;
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if (!blob) {
    throw new Error('Could not process image. Try a JPG or PNG file.');
  }

  while (blob.size > targetBytes && quality > 0.5) {
    quality -= 0.08;
    const next = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!next) break;
    blob = next;
  }

  return blob;
}

async function uploadBlobToStorage(blob: Blob, originalName: string): Promise<string> {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '') || 'image';
  const path = `blogs/${Date.now()}_${safeName}.jpg`;
  const storageRef = ref(storage, path);
  await withTimeout(
    uploadBytes(storageRef, blob, { contentType: 'image/jpeg' }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    'Storage upload timed out'
  );
  return getDownloadURL(storageRef);
}

export type ImageUploadResult = {
  url: string;
  method: 'storage' | 'embedded';
};

export const blogService = {
  async getAllBlogs(): Promise<Blog[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Blog[];
  },

  async getBlogBySlug(slug: string): Promise<Blog | null> {
    const q = query(collection(db, COLLECTION_NAME), where('slug', '==', slug));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const docData = querySnapshot.docs[0];
    return {
      id: docData.id,
      ...docData.data()
    } as Blog;
  },

  async createBlog(blogData: Omit<Blog, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...withPublishTimestamps(blogData),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async updateBlog(id: string, blogData: Partial<Blog>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...withPublishTimestamps(blogData),
      updatedAt: serverTimestamp()
    });
  },

  async deleteBlog(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  /**
   * Prepare image (resize/compress) then upload to Firebase Storage.
   * Falls back to a small embedded image only if Storage is unavailable.
   */
  async uploadImage(
    file: File,
    onProgress?: (phase: ImageUploadPhase) => void
  ): Promise<ImageUploadResult> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file (JPG, PNG, or WebP).');
    }
    if (file.size > BLOG_IMAGE_MAX_PICK_BYTES) {
      throw new Error(
        `Image is too large (${Math.round(file.size / 1024)}KB). Please use a file under 1MB, or resize the photo first.`
      );
    }

    onProgress?.('preparing');
    const prepared = await compressImageToBlob(file);

    onProgress?.('uploading');

    if (storage) {
      try {
        const url = await uploadBlobToStorage(prepared, file.name);
        return { url, method: 'storage' };
      } catch (error) {
        console.warn('Firebase Storage upload failed, using embedded fallback:', error);
      }
    }

    const dataUrl = await blobToDataUrl(prepared);
    if (dataUrl.length > 900_000) {
      throw new Error(
        'Could not upload to Storage and the image is still too large to save. Ask an admin to enable Storage CORS, or use a smaller photo.'
      );
    }

    return { url: dataUrl, method: 'embedded' };
  }
};
