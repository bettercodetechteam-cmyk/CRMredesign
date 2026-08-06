// Firebase Service Layer for ZICA ZIMA CRM
// This replaces mock data with real Firebase Firestore operations

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  getCountFromServer
} from 'firebase/firestore';
import { db } from './firebase';
import {
  User, Student, Lead, Course, Batch, Assignment, Staff, Expense, Target, Notification,
  InsertUser, InsertStudent, InsertLead, InsertNotification,
  UpdateUser, UpdateStudent, UpdateLead, UpdateNotification
} from '../../../shared/firebaseTypes';
import { quotaMonitor, trackFirebaseOperation, canPerformFirebaseOperation } from './quotaMonitor';
import { handleFirebaseError, FirebaseError } from './firebaseErrorHandler';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  hasMore: boolean;
  lastDoc?: QueryDocumentSnapshot;
}

class FirebaseCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T[], hasMore: boolean, lastDoc?: QueryDocumentSnapshot): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hasMore,
      lastDoc
    });
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new FirebaseCache();

// Helper function to convert Firestore timestamps to Date objects
const convertTimestamps = (data: any): any => {
  if (!data) return data;
  
  const converted = { ...data };
  
  // Convert Firestore timestamps to Date objects
  if (converted.createdAt && converted.createdAt instanceof Timestamp) {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt && converted.updatedAt instanceof Timestamp) {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  if (converted.timestamp && converted.timestamp instanceof Timestamp) {
    converted.timestamp = converted.timestamp.toDate();
  }
  if (converted.loginTime && converted.loginTime instanceof Timestamp) {
    converted.loginTime = converted.loginTime.toDate();
  }
  if (converted.logoutTime && converted.logoutTime instanceof Timestamp) {
    converted.logoutTime = converted.logoutTime.toDate();
  }
  if (converted.admissionDate && converted.admissionDate instanceof Timestamp) {
    converted.admissionDate = converted.admissionDate.toDate();
  }
  if (converted.followUpDate && converted.followUpDate instanceof Timestamp) {
    converted.followUpDate = converted.followUpDate.toDate();
  }
  if (converted.convertedAt && converted.convertedAt instanceof Timestamp) {
    converted.convertedAt = converted.convertedAt.toDate();
  }
  if (converted.dueDate && converted.dueDate instanceof Timestamp) {
    converted.dueDate = converted.dueDate.toDate();
  }
  if (converted.paidDate && converted.paidDate instanceof Timestamp) {
    converted.paidDate = converted.paidDate.toDate();
  }
  if (converted.startDate && converted.startDate instanceof Timestamp) {
    converted.startDate = converted.startDate.toDate();
  }
  if (converted.endDate && converted.endDate instanceof Timestamp) {
    converted.endDate = converted.endDate.toDate();
  }
  if (converted.joiningDate && converted.joiningDate instanceof Timestamp) {
    converted.joiningDate = converted.joiningDate.toDate();
  }
  if (converted.expenseDate && converted.expenseDate instanceof Timestamp) {
    converted.expenseDate = converted.expenseDate.toDate();
  }
  if (converted.recordedDate && converted.recordedDate instanceof Timestamp) {
    converted.recordedDate = converted.recordedDate.toDate();
  }
  if (converted.assignedDate && converted.assignedDate instanceof Timestamp) {
    converted.assignedDate = converted.assignedDate.toDate();
  }
  if (converted.submittedAt && converted.submittedAt instanceof Timestamp) {
    converted.submittedAt = converted.submittedAt.toDate();
  }
  if (converted.evaluatedAt && converted.evaluatedAt instanceof Timestamp) {
    converted.evaluatedAt = converted.evaluatedAt.toDate();
  }
  
  return converted;
};

// Helper function to prepare data for Firestore (convert Date objects to Timestamps)
const prepareForFirestore = (data: any): any => {
  if (!data) return data;
  
  const prepared = { ...data };
  
  // Convert Date objects to Firestore timestamps
  if (prepared.createdAt && prepared.createdAt instanceof Date) {
    prepared.createdAt = Timestamp.fromDate(prepared.createdAt);
  }
  if (prepared.updatedAt && prepared.updatedAt instanceof Date) {
    prepared.updatedAt = Timestamp.fromDate(prepared.updatedAt);
  }
  if (prepared.timestamp && prepared.timestamp instanceof Date) {
    prepared.timestamp = Timestamp.fromDate(prepared.timestamp);
  }
  if (prepared.loginTime && prepared.loginTime instanceof Date) {
    prepared.loginTime = Timestamp.fromDate(prepared.loginTime);
  }
  if (prepared.logoutTime && prepared.logoutTime instanceof Date) {
    prepared.logoutTime = Timestamp.fromDate(prepared.logoutTime);
  }
  if (prepared.admissionDate && prepared.admissionDate instanceof Date) {
    prepared.admissionDate = Timestamp.fromDate(prepared.admissionDate);
  }
  if (prepared.followUpDate && prepared.followUpDate instanceof Date) {
    prepared.followUpDate = Timestamp.fromDate(prepared.followUpDate);
  }
  if (prepared.convertedAt && prepared.convertedAt instanceof Date) {
    prepared.convertedAt = Timestamp.fromDate(prepared.convertedAt);
  }
  if (prepared.dueDate && prepared.dueDate instanceof Date) {
    prepared.dueDate = Timestamp.fromDate(prepared.dueDate);
  }
  if (prepared.paidDate && prepared.paidDate instanceof Date) {
    prepared.paidDate = Timestamp.fromDate(prepared.paidDate);
  }
  if (prepared.startDate && prepared.startDate instanceof Date) {
    prepared.startDate = Timestamp.fromDate(prepared.startDate);
  }
  if (prepared.endDate && prepared.endDate instanceof Date) {
    prepared.endDate = Timestamp.fromDate(prepared.endDate);
  }
  if (prepared.joiningDate && prepared.joiningDate instanceof Date) {
    prepared.joiningDate = Timestamp.fromDate(prepared.joiningDate);
  }
  if (prepared.expenseDate && prepared.expenseDate instanceof Date) {
    prepared.expenseDate = Timestamp.fromDate(prepared.expenseDate);
  }
  if (prepared.recordedDate && prepared.recordedDate instanceof Date) {
    prepared.recordedDate = Timestamp.fromDate(prepared.recordedDate);
  }
  if (prepared.assignedDate && prepared.assignedDate instanceof Date) {
    prepared.assignedDate = Timestamp.fromDate(prepared.assignedDate);
  }
  if (prepared.submittedAt && prepared.submittedAt instanceof Date) {
    prepared.submittedAt = Timestamp.fromDate(prepared.submittedAt);
  }
  if (prepared.evaluatedAt && prepared.evaluatedAt instanceof Date) {
    prepared.evaluatedAt = Timestamp.fromDate(prepared.evaluatedAt);
  }
  
  return prepared;
};

// Generic CRUD operations with pagination
export class FirebaseService {
  // Users
  static async getUsers(page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<{
    data: User[];
    hasMore: boolean;
    total: number;
  }> {
    const cacheKey = `users_${page}_${pageSize}`;
    const cached = cache.get<User>(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        hasMore: cached.hasMore,
        total: cached.data.length
      };
    }

    // Check quota before operation
    const estimatedReads = Math.min(pageSize * 2, 100); // Conservative estimate
    if (!canPerformFirebaseOperation('read', estimatedReads)) {
      throw new FirebaseError('Firebase read quota exceeded', 'quota-exceeded');
    }

    return handleFirebaseError(async () => {
      // Use paginated query instead of fetching all documents
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1) // Get one extra to check if there are more
      );
      
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;
      
      // Track quota usage
      trackFirebaseOperation('read', docs.length);
      
      // Check if there are more documents
      const hasMore = docs.length > pageSize;
      if (hasMore) {
        docs.pop(); // Remove the extra doc
      }
      
      const users = docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      })) as User[];

      const result = {
        data: users,
        hasMore,
        total: users.length // This is approximate for pagination
      };

      cache.set(cacheKey, users, hasMore);
      return result;
    }, {
      enableQuotaMonitoring: true,
      enableRetry: true,
      fallbackData: { data: [], hasMore: false, total: 0 }
    });
  }

  static async getUserById(id: string): Promise<User | null> {
    // Check quota before operation
    if (!canPerformFirebaseOperation('read', 1)) {
      throw new FirebaseError('Firebase read quota exceeded', 'quota-exceeded');
    }

    return handleFirebaseError(async () => {
      const docRef = doc(db, 'users', id);
      const docSnap = await getDoc(docRef);
      
      // Track quota usage
      trackFirebaseOperation('read', 1);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...convertTimestamps(docSnap.data())
        };
      }
      return null;
    }, {
      enableQuotaMonitoring: true,
      enableRetry: true,
      fallbackData: null
    });
  }

  static async createUser(userData: InsertUser): Promise<User> {
    // Check quota before operation
    if (!canPerformFirebaseOperation('write', 1)) {
      throw new FirebaseError('Firebase write quota exceeded', 'quota-exceeded');
    }

    return handleFirebaseError(async () => {
      const docRef = await addDoc(collection(db, 'users'), {
        ...prepareForFirestore(userData),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Track quota usage
      trackFirebaseOperation('write', 1);
      
      // Invalidate user cache
      cache.invalidate('users');
      
      return {
        id: docRef.id,
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }, {
      enableQuotaMonitoring: true,
      enableRetry: true
    });
  }

  static async updateUser(id: string, userData: UpdateUser): Promise<void> {
    // Check quota before operation
    if (!canPerformFirebaseOperation('write', 1)) {
      throw new FirebaseError('Firebase write quota exceeded', 'quota-exceeded');
    }

    return handleFirebaseError(async () => {
      const docRef = doc(db, 'users', id);
      await updateDoc(docRef, {
        ...prepareForFirestore(userData),
        updatedAt: serverTimestamp()
      });
      
      // Track quota usage
      trackFirebaseOperation('write', 1);
      
      // Invalidate user cache
      cache.invalidate('users');
    }, {
      enableQuotaMonitoring: true,
      enableRetry: true
    });
  }

  // Students with pagination
  static async getStudents(
    centreId?: string, 
    page: number = 1, 
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<{
    data: Student[];
    hasMore: boolean;
    total: number;
  }> {
    try {
      const cacheKey = `students_${centreId || 'all'}_${page}_${pageSize}`;
      const cached = cache.get<Student>(cacheKey);
      if (cached) {
        return {
          data: cached.data,
          hasMore: cached.hasMore,
          total: cached.data.length
        };
      }

      let q = collection(db, 'students');
      const constraints = [];
      
      if (centreId) {
        constraints.push(where('centreId', '==', centreId));
      }
      
      // Add ordering for consistent pagination
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(pageSize));
      
      q = query(q, ...constraints);
      const querySnapshot = await getDocs(q);
      
      const students = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      }));

      const result = {
        data: students,
        hasMore: querySnapshot.docs.length === pageSize,
        total: students.length // Note: This is approximate for pagination
      };

      cache.set(cacheKey, students, result.hasMore, querySnapshot.docs[querySnapshot.docs.length - 1]);
      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching students:', error);
      }
      return { data: [], hasMore: false, total: 0 };
    }
  }

  static async getStudentById(id: string): Promise<Student | null> {
    try {
      const docRef = doc(db, 'students', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...convertTimestamps(docSnap.data())
        };
      }
      return null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching student:', error);
      }
      return null;
    }
  }

  static async createStudent(studentData: InsertStudent): Promise<Student> {
    try {
      const docRef = await addDoc(collection(db, 'students'), {
        ...prepareForFirestore(studentData),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate student cache
      cache.invalidate('students');
      
      return {
        id: docRef.id,
        ...studentData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error creating student:', error);
      }
      throw error;
    }
  }

  static async updateStudent(id: string, studentData: UpdateStudent): Promise<void> {
    try {
      const docRef = doc(db, 'students', id);
      await updateDoc(docRef, {
        ...prepareForFirestore(studentData),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate student cache
      cache.invalidate('students');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error updating student:', error);
      }
      throw error;
    }
  }

  static async deleteStudent(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'students', id);
      await deleteDoc(docRef);
      
      // Invalidate student cache
      cache.invalidate('students');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error deleting student:', error);
      }
      throw error;
    }
  }

  // Leads with pagination
  static async getLeads(
    centreId?: string, 
    page: number = 1, 
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<{
    data: Lead[];
    hasMore: boolean;
    total: number;
  }> {
    try {
      const cacheKey = `leads_${centreId || 'all'}_${page}_${pageSize}`;
      const cached = cache.get<Lead>(cacheKey);
      if (cached) {
        return {
          data: cached.data,
          hasMore: cached.hasMore,
          total: cached.data.length
        };
      }

      let q = collection(db, 'leads');
      const constraints = [];
      
      if (centreId) {
        constraints.push(where('centreId', '==', centreId));
      }
      
      // Add ordering for consistent pagination
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(pageSize));
      
      q = query(q, ...constraints);
      const querySnapshot = await getDocs(q);
      
      const leads = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      }));

      const result = {
        data: leads,
        hasMore: querySnapshot.docs.length === pageSize,
        total: leads.length
      };

      cache.set(cacheKey, leads, result.hasMore, querySnapshot.docs[querySnapshot.docs.length - 1]);
      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching leads:', error);
      }
      return { data: [], hasMore: false, total: 0 };
    }
  }

  static async getLeadById(id: string): Promise<Lead | null> {
    try {
      const docRef = doc(db, 'leads', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...convertTimestamps(docSnap.data())
        };
      }
      return null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching lead:', error);
      }
      return null;
    }
  }

  static async createLead(leadData: InsertLead): Promise<Lead> {
    try {
      const docRef = await addDoc(collection(db, 'leads'), {
        ...prepareForFirestore(leadData),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate lead cache
      cache.invalidate('leads');
      
      return {
        id: docRef.id,
        ...leadData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error creating lead:', error);
      }
      throw error;
    }
  }

  static async updateLead(id: string, leadData: UpdateLead): Promise<void> {
    try {
      const docRef = doc(db, 'leads', id);
      await updateDoc(docRef, {
        ...prepareForFirestore(leadData),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate lead cache
      cache.invalidate('leads');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error updating lead:', error);
      }
      throw error;
    }
  }

  static async deleteLead(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'leads', id);
      await deleteDoc(docRef);
      
      // Invalidate lead cache
      cache.invalidate('leads');
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  }

  // Notifications with pagination
  static async getNotifications(
    userId: string, 
    page: number = 1, 
    pageSize: number = DEFAULT_PAGE_SIZE
  ): Promise<{
    data: Notification[];
    hasMore: boolean;
    total: number;
  }> {
    try {
      const cacheKey = `notifications_${userId}_${page}_${pageSize}`;
      const cached = cache.get<Notification>(cacheKey);
      if (cached) {
        return {
          data: cached.data,
          hasMore: cached.hasMore,
          total: cached.data.length
        };
      }

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      
      const querySnapshot = await getDocs(q);
      const notifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      }));

      const result = {
        data: notifications,
        hasMore: querySnapshot.docs.length === pageSize,
        total: notifications.length
      };

      cache.set(cacheKey, notifications, result.hasMore, querySnapshot.docs[querySnapshot.docs.length - 1]);
      return result;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { data: [], hasMore: false, total: 0 };
    }
  }

  static async createNotification(notificationData: InsertNotification): Promise<Notification> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...prepareForFirestore(notificationData),
        createdAt: serverTimestamp()
      });
      
      // Invalidate notification cache
      cache.invalidate('notifications');
      
      return {
        id: docRef.id,
        ...notificationData,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  static async updateNotification(id: string, notificationData: UpdateNotification): Promise<void> {
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, prepareForFirestore(notificationData));
      
      // Invalidate notification cache
      cache.invalidate('notifications');
    } catch (error) {
      console.error('Error updating notification:', error);
      throw error;
    }
  }

  // Real-time listeners with limits
  static subscribeToCollection(
    collectionName: string,
    callback: (data: any[]) => void,
    filters?: { field: string; operator: string; value: any }[],
    maxDocs: number = 50
  ) {
    let q = collection(db, collectionName);
    
    if (filters) {
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator as any, filter.value));
      });
    }
    
    // Add limit to prevent excessive reads
    q = query(q, limit(maxDocs));
    
    return onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      }));
      callback(data);
    });
  }

  // Dashboard stats with caching
  static async getDashboardStats(centreId?: string): Promise<{
    totalStudents: number;
    activeStudents: number;
    totalRevenue: number;
    pendingFees: number;
    newEnquiries: number;
    conversions: number;
  }> {
    try {
      const cacheKey = `dashboard_stats_${centreId || 'all'}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) {
        return cached.data[0];
      }

      // Get students count efficiently using getCountFromServer
      let studentsQuery = collection(db, 'students');
      if (centreId) {
        studentsQuery = query(studentsQuery, where('centreId', '==', centreId)) as any;
      }
      const studentsCountSnapshot = await getCountFromServer(studentsQuery as any);
      const totalStudents = studentsCountSnapshot.data().count;

      // For status-specific counts, we still need to query or use a more complex aggregation
      // For now, let's keep the limit to minimize impact if we must use getDocs
      const activeStudentsQuery = query(
        collection(db, 'students'), 
        where('status', '==', 'active'),
        ...(centreId ? [where('centreId', '==', centreId)] : []),
        limit(1) // We just want to know if there are any for this mock-like logic, 
                 // but the original code was filtering the whole 1000 docs.
                 // Actually, let's use getCountFromServer for these too!
      );
      const activeStudentsCountSnapshot = await getCountFromServer(activeStudentsQuery as any);
      const activeStudents = activeStudentsCountSnapshot.data().count;

      // Get leads count efficiently
      let leadsQuery = collection(db, 'leads');
      if (centreId) {
        leadsQuery = query(leadsQuery, where('centreId', '==', centreId)) as any;
      }
      const leadsCountSnapshot = await getCountFromServer(leadsQuery as any);
      const totalLeads = leadsCountSnapshot.data().count;

      const newEnquiriesQuery = query(
        collection(db, 'leads'),
        where('status', '==', 'new'),
        ...(centreId ? [where('centreId', '==', centreId)] : [])
      );
      const newEnquiriesCountSnapshot = await getCountFromServer(newEnquiriesQuery as any);
      const newEnquiries = newEnquiriesCountSnapshot.data().count;

      const conversionsQuery = query(
        collection(db, 'leads'),
        where('status', '==', 'converted'),
        ...(centreId ? [where('centreId', '==', centreId)] : [])
      );
      const conversionsCountSnapshot = await getCountFromServer(conversionsQuery as any);
      const conversions = conversionsCountSnapshot.data().count;

      // Mock revenue data (you can implement real fee calculation)
      const totalRevenue = 2500000;
      const pendingFees = 450000;

      const result = {
        totalStudents,
        activeStudents,
        totalRevenue,
        pendingFees,
        newEnquiries,
        conversions
      };

      cache.set(cacheKey, [result], false);
      return result;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalStudents: 0,
        activeStudents: 0,
        totalRevenue: 0,
        pendingFees: 0,
        newEnquiries: 0,
        conversions: 0
      };
    }
  }

  // Cache management
  static clearCache(): void {
    cache.clear();
  }

  static invalidateCache(pattern: string): void {
    cache.invalidate(pattern);
  }
}

export default FirebaseService; 