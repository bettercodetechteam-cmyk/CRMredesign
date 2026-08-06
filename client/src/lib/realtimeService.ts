import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot, 
  Unsubscribe,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from '../hooks/useAuth';
import { firebaseListenerManager } from './firebaseListenerManager';
import { centreDataStore } from './centreDataStore';
import { getReminderListenerOptions } from './reminderListenerConfig';

export interface RealtimeUpdate {
  type: 'lead' | 'reminder' | 'staff' | 'student' | 'notification';
  action: 'created' | 'updated' | 'deleted';
  data: any;
  timestamp: number;
}

export interface RealtimeCallbacks {
  onLeadUpdate?: (leads: any[]) => void;
  onReminderUpdate?: (reminders: any[]) => void;
  onStaffUpdate?: (staff: any[]) => void;
  onStudentUpdate?: (students: any[]) => void;
  onNotificationUpdate?: (notifications: any[]) => void;
}

class RealtimeService {
  private unsubscribers: Map<string, Unsubscribe> = new Map();
  private callbacks: RealtimeCallbacks = {};
  private centreId: string | null = null;
  private userId: string | null = null;

  init(centreId: string, userId: string, callbacks: RealtimeCallbacks) {
    // Cleanup any existing listeners before re-initializing to prevent quota leaks
    this.cleanup();

    this.centreId = centreId;
    this.userId = userId;
    this.callbacks = callbacks;
    this.setupAllListeners();
  }

  private setupAllListeners() {
    if (!this.centreId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🔄 RealtimeService: No centreId provided, skipping listeners');
      }
      return;
    }

    // Setup all collection listeners
    this.setupLeadsListener();
    this.setupRemindersListener();
    this.setupStaffListener();
    this.setupStudentsListener();
    this.setupNotificationsListener();
  }

  private setupLeadsListener() {
    if (!this.callbacks.onLeadUpdate || !this.centreId) return;

    const notify = () => {
      const { leads } = centreDataStore.getState();
      this.callbacks.onLeadUpdate?.(leads);
    };

    notify();
    const unsubscribe = centreDataStore.subscribe(notify);
    this.unsubscribers.set('leads', unsubscribe);
  }

  private setupRemindersListener() {
    if (!this.callbacks.onReminderUpdate || !this.centreId) return;
    
    // Use centralized listener manager
    const unsubscribe = firebaseListenerManager.subscribe('reminders', (data) => {
      const reminders = data
        .map((item: any) => ({
          ...item,
          createdAt: item.createdAt?.toDate?.() || new Date(item.createdAt),
          updatedAt: item.updatedAt?.toDate?.() || new Date(item.updatedAt),
          reminderDate: item.reminderDate?.toDate?.() || new Date(item.reminderDate),
        }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.getTime?.() || 0;
          const bTime = b.createdAt?.getTime?.() || 0;
          return bTime - aTime;
        });

      this.callbacks.onReminderUpdate?.(reminders);
    }, getReminderListenerOptions(this.centreId!));

    this.unsubscribers.set('reminders', unsubscribe);
  }

  private setupStaffListener() {
    if (!this.callbacks.onStaffUpdate) return;

    
    const q = query(
      collection(db, 'staff'),
      where('centreId', '==', this.centreId),
      limit(100) // Added limit
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      
      const staff = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        };
      }).sort((a, b) => {
        // Sort by createdAt descending
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      this.callbacks.onStaffUpdate?.(staff);
    }, (error) => {
      console.error('❌ Error listening to staff:', error);
    });

    this.unsubscribers.set('staff', unsubscribe);
  }

  private setupStudentsListener() {
    if (!this.callbacks.onStudentUpdate) return;

    
    const q = query(
      collection(db, 'students'),
      where('centreId', '==', this.centreId),
      limit(100) // Added limit
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      
      const students = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
          dateOfBirth: data.dateOfBirth?.toDate?.() || null,
          admissionDate: data.admissionDate?.toDate?.() || null,
        };
      }).sort((a, b) => {
        // Sort by createdAt descending
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      this.callbacks.onStudentUpdate?.(students);
    }, (error) => {
      console.error('❌ Error listening to students:', error);
    });

    this.unsubscribers.set('students', unsubscribe);
  }

  private setupNotificationsListener() {
    if (!this.callbacks.onNotificationUpdate) return;

    
    const q = query(
      collection(db, 'notifications'),
      where('centreId', '==', this.centreId),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      
      const notifications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        };
      }).sort((a, b) => {
        // Sort by createdAt descending
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      this.callbacks.onNotificationUpdate?.(notifications);
    }, (error) => {
      console.error('❌ Error listening to notifications:', error);
    });

    this.unsubscribers.set('notifications', unsubscribe);
  }

  // Update callbacks
  updateCallbacks(callbacks: Partial<RealtimeCallbacks>) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Cleanup all listeners
  cleanup() {
    
    this.unsubscribers.forEach((unsubscribe, collectionName) => {
      unsubscribe();
    });
    
    this.unsubscribers.clear();
  }

  // Get current data count
  getDataCount() {
    return this.unsubscribers.size;
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
