import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  writeBatch,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.GOOGLE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export interface CRUDError extends Error {
  code: string;
  details?: any;
}

export class CRUDService {
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  // Create a new document
  async create(data: any): Promise<any> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newDoc = await getDoc(docRef);
      return { id: docRef.id, ...newDoc.data() };
    } catch (error) {
      console.error(`Error creating ${this.collectionName}:`, error);
      throw this.createError('CREATE_ERROR', error);
    }
  }

  // Get all documents with optional filters
  async getAll(filters: Record<string, any> = {}): Promise<any[]> {
    try {
      let q = collection(db, this.collectionName);
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          q = query(q, where(key, '==', value));
        }
      });
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error fetching ${this.collectionName}:`, error);
      throw this.createError('FETCH_ERROR', error);
    }
  }

  // Get a single document by ID
  async getById(id: string): Promise<any | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching ${this.collectionName} by ID:`, error);
      throw this.createError('FETCH_ERROR', error);
    }
  }

  // Update a document
  async update(id: string, data: any): Promise<any> {
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      const updatedDoc = await getDoc(docRef);
      return { id: updatedDoc.id, ...updatedDoc.data() };
    } catch (error) {
      console.error(`Error updating ${this.collectionName}:`, error);
      throw this.createError('UPDATE_ERROR', error);
    }
  }

  // Delete a document
  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting ${this.collectionName}:`, error);
      throw this.createError('DELETE_ERROR', error);
    }
  }

  // Batch operations
  async batchCreate(items: any[]): Promise<any[]> {
    try {
      const batch = writeBatch(db);
      const results: any[] = [];
      
      items.forEach((item, index) => {
        const docRef = doc(collection(db, this.collectionName));
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        results.push({ docRef, index });
      });
      
      await batch.commit();
      
      // Fetch the created documents
      const createdDocs = await Promise.all(
        results.map(async ({ docRef }) => {
          const docSnap = await getDoc(docRef);
          return { id: docSnap.id, ...docSnap.data() };
        })
      );
      
      return createdDocs;
    } catch (error) {
      console.error(`Error batch creating ${this.collectionName}:`, error);
      throw this.createError('BATCH_CREATE_ERROR', error);
    }
  }

  // Search documents with complex queries
  async search(field: string, value: any, operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'array-contains' = '=='): Promise<any[]> {
    try {
      const q = query(collection(db, this.collectionName), where(field, operator, value));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error searching ${this.collectionName}:`, error);
      throw this.createError('SEARCH_ERROR', error);
    }
  }

  // Get documents with pagination
  async getPaginated(page: number = 1, limit: number = 10, orderByField: string = 'createdAt', orderDirection: 'asc' | 'desc' = 'desc'): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  }> {
    try {
      // Get total count
      const totalSnapshot = await getDocs(collection(db, this.collectionName));
      const total = totalSnapshot.size;
      
      // Calculate offset
      const offset = (page - 1) * limit;
      
      // Get paginated data
      const q = query(
        collection(db, this.collectionName),
        orderBy(orderByField, orderDirection),
        limit(limit)
      );
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        data,
        total,
        page,
        limit,
        hasNext: offset + limit < total
      };
    } catch (error) {
      console.error(`Error getting paginated ${this.collectionName}:`, error);
      throw this.createError('PAGINATION_ERROR', error);
    }
  }

  // Custom query method
  async customQuery(queryFn: (collection: any) => any): Promise<any[]> {
    try {
      const q = queryFn(collection(db, this.collectionName));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error executing custom query on ${this.collectionName}:`, error);
      throw this.createError('CUSTOM_QUERY_ERROR', error);
    }
  }

  private createError(code: string, originalError: any): CRUDError {
    const error = new Error(`CRUD operation failed: ${code}`) as CRUDError;
    error.code = code;
    error.details = originalError;
    return error;
  }
}

// Specific service instances for different collections
export const studentService = new CRUDService('students');
export const leadService = new CRUDService('leads');
export const courseService = new CRUDService('courses');
export const batchService = new CRUDService('batches');
export const feeService = new CRUDService('feeTransactions');
export const assignmentService = new CRUDService('assignments');
export const staffService = new CRUDService('staff');
export const expenseService = new CRUDService('expenses');
export const targetService = new CRUDService('targets');
export const performanceService = new CRUDService('performanceMetrics');
export const notificationService = new CRUDService('notifications');
export const userService = new CRUDService('users'); 