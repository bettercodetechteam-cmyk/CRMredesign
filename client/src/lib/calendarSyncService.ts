import { db } from './firebase';
import { collection, query, where, doc, updateDoc, Timestamp, addDoc } from 'firebase/firestore';
import { firebaseListenerManager } from './firebaseListenerManager';
import { STANDARD_LEADS_LISTENER_OPTIONS, belongsToOrganisationCentre } from './centreDataStore';
import { firebaseQuotaManager } from './firebaseQuotaManager';

export interface CalendarEvent {
  id: string;
  leadId: string;
  leadName: string;
  eventType: 'followup' | 'call' | 'visit' | 'admission' | 'enquiry';
  eventDate: Date;
  status: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  assignedTo?: string;
  centreId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarSyncEvent {
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'data_refreshed';
  data?: any;
  timestamp: number;
  source: string;
  leadId?: string;
}

class CalendarSyncService {
  private centreId: string | null = null;
  private userId: string | null = null;
  private syncCallbacks: ((event: CalendarSyncEvent) => void)[] = [];
  private isInitialized = false;
  private leadsUnsubscribe: (() => void) | null = null;

  public init(centreId: string, userId: string) {
    
    if (this.centreId === centreId && this.userId === userId && this.isInitialized) {
      return;
    }

    // Clean up previous initialization
    if (this.centreId) {
      this.cleanup();
    }

    this.centreId = centreId;
    this.userId = userId;
    this.isInitialized = true;

    // Set up real-time Firebase listeners
    this.setupFirebaseListeners();
    
    // Set up global event listeners
    this.setupGlobalEventListeners();
  }

  private setupFirebaseListeners() {
    if (!this.centreId || this.centreId.trim() === '') {
      console.warn('📅 CalendarSyncService: Invalid centreId, skipping Firebase listeners');
      return;
    }

    try {
      const centreId = this.centreId.trim();

      this.leadsUnsubscribe = firebaseListenerManager.subscribeToChanges('leads', (changes) => {
        changes.forEach((change) => {
          if (!belongsToOrganisationCentre(change.data, centreId)) return;

          this.handleCalendarSync({
            type: change.type === 'added' ? 'event_created' : change.type === 'modified' ? 'event_updated' : 'event_deleted',
            data: { lead: change.data, changeType: change.type },
            timestamp: Date.now(),
            source: 'firebase_realtime',
            leadId: change.data.id
          });
        });
      }, { ...STANDARD_LEADS_LISTENER_OPTIONS });

    } catch (error) {
      console.error('📅 CalendarSyncService: Error setting up Firebase listeners:', error);
    }
  }

  private setupGlobalEventListeners() {
    // Listen for lead data updates
    window.addEventListener('leadDataUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      const source = customEvent.detail?.source || 'unknown';
      if (source === 'firebase_realtime' || source.endsWith('_sync') || source === 'calendarSyncService') {
        return;
      }
      this.handleCalendarSync({
        type: 'event_updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });

    window.addEventListener('reminderDataUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      const source = customEvent.detail?.source || 'reminderDataUpdated';
      if (source === 'firebase_realtime' || source.endsWith('_sync') || source === 'calendarSyncService') {
        return;
      }
      this.handleCalendarSync({
        type: 'event_updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'reminderDataUpdated',
        leadId: customEvent.detail?.leadId
      });
    });

    window.addEventListener('reminderUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      const source = customEvent.detail?.source || 'unknown';
      if (source === 'firebase_realtime' || source.endsWith('_sync') || source === 'calendarSyncService') {
        return;
      }
      this.handleCalendarSync({
        type: 'event_updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });

    // Listen for calendar updates
    window.addEventListener('calendarUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      const source = customEvent.detail?.source || 'unknown';
      if (source === 'firebase_realtime' || source.endsWith('_sync') || source === 'calendarSyncService') {
        return;
      }
      this.handleCalendarSync({
        type: 'event_updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });
  }

  private handleCalendarSync(event: CalendarSyncEvent) {
    this.notifySubscribers(event);

    const skipDispatch =
      event.source === 'firebase_realtime' ||
      event.source === 'calendarSyncService' ||
      event.source?.endsWith('_sync') ||
      event.data?.preventCascade === true;

    if (skipDispatch) {
      return;
    }

    this.dispatchGlobalEvents(event);
  }

  private dispatchGlobalEvents(event: CalendarSyncEvent) {
    // Dispatch calendar-specific events
    window.dispatchEvent(new CustomEvent('calendarDataUpdated', {
      detail: {
        ...event,
        source: 'calendarSyncService'
      }
    }));

    // Dispatch reminder data updates if it's a reminder event
    if (event.data?.reminder) {
      window.dispatchEvent(new CustomEvent('reminderDataUpdated', {
        detail: {
          ...event,
          source: 'calendarSyncService'
        }
      }));
    }

    // Dispatch lead data updates if it's a lead event
    if (event.data?.lead) {
      window.dispatchEvent(new CustomEvent('leadDataUpdated', {
        detail: {
          ...event,
          source: 'calendarSyncService'
        }
      }));
    }
  }

  private notifySubscribers(event: CalendarSyncEvent) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('📅 CalendarSyncService: Error in sync callback:', error);
      }
    });
  }

  public subscribe(callback: (event: CalendarSyncEvent) => void): () => void {
    this.syncCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.syncCallbacks.indexOf(callback);
      if (index > -1) {
        this.syncCallbacks.splice(index, 1);
      }
    };
  }

  public async createCalendarEvent(eventData: Partial<CalendarEvent>): Promise<string | null> {
    try {
      
      const event = {
        ...eventData,
        centreId: this.centreId!,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'calendarEvents'), event);
      
      // Dispatch sync event
      this.handleCalendarSync({
        type: 'event_created',
        data: { event: { id: docRef.id, ...event } },
        timestamp: Date.now(),
        source: 'calendarSyncService',
        leadId: eventData.leadId
      });

      return docRef.id;
    } catch (error) {
      console.error('📅 CalendarSyncService: Error creating calendar event:', error);
      return null;
    }
  }

  public async updateCalendarEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<boolean> {
    try {
      
      const eventRef = doc(db, 'calendarEvents', eventId);
      await updateDoc(eventRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      // Dispatch sync event
      this.handleCalendarSync({
        type: 'event_updated',
        data: { eventId, updates },
        timestamp: Date.now(),
        source: 'calendarSyncService',
        leadId: updates.leadId
      });

      return true;
    } catch (error) {
      console.error('📅 CalendarSyncService: Error updating calendar event:', error);
      return false;
    }
  }

  public forceRefresh() {
    
    this.handleCalendarSync({
      type: 'data_refreshed',
      data: null,
      timestamp: Date.now(),
      source: 'calendarSyncService'
    });
  }

  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      centreId: this.centreId,
      userId: this.userId,
      hasLeadsListener: !!this.leadsUnsubscribe,
      hasRemindersListener: false,
      subscribersCount: this.syncCallbacks.length
    };
  }

  public cleanup() {
    
    // Clean up Firebase listeners
    if (this.leadsUnsubscribe) {
      this.leadsUnsubscribe();
      this.leadsUnsubscribe = null;
    }

    this.syncCallbacks = [];
    this.isInitialized = false;
  }
}

// Export singleton instance
export const calendarSyncService = new CalendarSyncService();
