import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { firebaseListenerManager } from './firebaseListenerManager';
import { STANDARD_LEADS_LISTENER_OPTIONS, belongsToOrganisationCentre } from './centreDataStore';
import { firebaseQuotaManager } from './firebaseQuotaManager';
import { getLeadDocRef, mapLeadFieldsToEnquiryUpdate } from './leadDocumentUtils';

export interface DataSyncEvent {
  type: 'lead' | 'reminder' | 'calendar' | 'analytics' | 'notification' | 'status';
  action: 'created' | 'updated' | 'deleted' | 'refreshed' | 'bulk_deleted';
  data?: any;
  timestamp: number;
  source: string;
  leadId?: string;
}

class DataSyncService {
  private centreId: string | null = null;
  private userId: string | null = null;
  private syncCallbacks: Map<string, ((event: DataSyncEvent) => void)[]> = new Map();
  private isInitialized = false;
  private leadUnsubscribe: (() => void) | null = null;

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
      console.warn('🔄 DataSyncService: Invalid centreId, skipping Firebase listeners');
      return;
    }

    try {
      const centreId = this.centreId.trim();

      this.leadUnsubscribe = firebaseListenerManager.subscribeToChanges('leads', (changes) => {
        changes.forEach((change) => {
          if (!belongsToOrganisationCentre(change.data, centreId)) return;

          this.handleDataSync({
            type: 'lead',
            action: change.type === 'added' ? 'created' : change.type === 'modified' ? 'updated' : 'deleted',
            data: { lead: change.data, changeType: change.type },
            timestamp: Date.now(),
            source: 'firebase_realtime',
            leadId: change.data.id
          });
        });
      }, { ...STANDARD_LEADS_LISTENER_OPTIONS });
    } catch (error) {
      console.error('🔄 DataSyncService: Error setting up Firebase listeners:', error);
    }
  }

  private setupGlobalEventListeners() {
    // Listen for lead data updates
    window.addEventListener('leadDataUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleDataSync({
        type: 'lead',
        action: customEvent.detail?.action || 'updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });

    // Listen for status updates
    window.addEventListener('statusUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleDataSync({
        type: 'status',
        action: 'updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });

    // Reminder updates from single shared listener (enhancedReminderService)
    window.addEventListener('reminderDataUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleDataSync({
        type: 'reminder',
        action: customEvent.detail?.action || 'updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'reminderDataUpdated',
        leadId: customEvent.detail?.leadId
      });
    });

    window.addEventListener('reminderUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleDataSync({
        type: 'reminder',
        action: customEvent.detail?.action || 'updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });

    // Listen for calendar updates
    window.addEventListener('calendarUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleDataSync({
        type: 'calendar',
        action: customEvent.detail?.action || 'updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });

    // Listen for analytics updates
    window.addEventListener('analyticsDataUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleDataSync({
        type: 'analytics',
        action: 'updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown'
      });
    });

    // Listen for notification updates
    window.addEventListener('notificationDataUpdated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.handleDataSync({
        type: 'notification',
        action: 'updated',
        data: customEvent.detail,
        timestamp: Date.now(),
        source: customEvent.detail?.source || 'unknown',
        leadId: customEvent.detail?.leadId
      });
    });
  }

  public handleDataSync(event: DataSyncEvent) {
    this.notifySubscribers(event);

    const skipCascade =
      event.source === 'firebase_realtime' ||
      event.source?.endsWith('_sync') ||
      event.data?.preventCascade === true;

    if (skipCascade) {
      return;
    }

    this.triggerCascadingUpdates(event);
  }

  private triggerCascadingUpdates(event: DataSyncEvent) {
    switch (event.type) {
      case 'lead':
        // Lead updates should trigger comprehensive updates
        this.dispatchEvent('analyticsDataUpdated', {
          source: 'lead_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          action: event.action,
          data: event.data
        });
        this.dispatchEvent('calendarDataUpdated', {
          source: 'lead_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          action: event.action,
          data: event.data
        });
        this.dispatchEvent('reminderDataUpdated', {
          source: 'lead_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          action: event.action,
          data: event.data
        });
        this.dispatchEvent('notificationDataUpdated', {
          source: 'lead_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          action: event.action,
          data: event.data
        });
        break;
        
      case 'status':
        // Status updates should trigger comprehensive updates
        this.dispatchEvent('analyticsDataUpdated', {
          source: 'status_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          newStatus: event.data?.newStatus,
          data: event.data
        });
        this.dispatchEvent('notificationDataUpdated', {
          source: 'status_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          newStatus: event.data?.newStatus,
          data: event.data
        });
        this.dispatchEvent('calendarDataUpdated', {
          source: 'status_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          newStatus: event.data?.newStatus,
          data: event.data
        });
        this.dispatchEvent('reminderDataUpdated', {
          source: 'status_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          newStatus: event.data?.newStatus,
          data: event.data
        });
        break;
        
      case 'reminder':
        // Reminder updates should trigger comprehensive updates
        this.dispatchEvent('notificationDataUpdated', {
          source: 'reminder_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          reminderData: event.data,
          data: event.data
        });
        this.dispatchEvent('calendarDataUpdated', {
          source: 'reminder_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          reminderData: event.data,
          data: event.data
        });
        this.dispatchEvent('analyticsDataUpdated', {
          source: 'reminder_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          reminderData: event.data,
          data: event.data
        });
        break;
        
      case 'calendar':
        // Calendar updates should trigger comprehensive updates
        this.dispatchEvent('reminderDataUpdated', {
          source: 'calendar_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          calendarData: event.data,
          data: event.data
        });
        this.dispatchEvent('notificationDataUpdated', {
          source: 'calendar_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          calendarData: event.data,
          data: event.data
        });
        this.dispatchEvent('analyticsDataUpdated', {
          source: 'calendar_sync',
          timestamp: Date.now(),
          leadId: event.leadId,
          calendarData: event.data,
          data: event.data
        });
        break;
        
      case 'analytics':
        // Analytics updates don't trigger other updates to avoid loops
        break;
        
      case 'notification':
        // Notification updates don't trigger other updates to avoid loops
        break;
    }
  }

  private dispatchEvent(eventName: string, detail: any) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  private notifySubscribers(event: DataSyncEvent) {
    const callbacks = this.syncCallbacks.get(event.type) || [];
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('🔄 DataSyncService: Error in sync callback:', error);
      }
    });
  }

  public subscribe(eventType: DataSyncEvent['type'], callback: (event: DataSyncEvent) => void): () => void {
    if (!this.syncCallbacks.has(eventType)) {
      this.syncCallbacks.set(eventType, []);
    }
    
    this.syncCallbacks.get(eventType)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.syncCallbacks.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  public async syncLeadData(leadId: string, updates: any) {
    try {
      // Check quota before operation
      if (!firebaseQuotaManager.shouldAllowOperation()) {
        console.warn('DataSyncService: Operation throttled due to quota limits');
        return false;
      }
      
      const leadRef = getLeadDocRef(db, leadId);
      const isEnquiry = leadId.startsWith('enquiry_');
      const payload = isEnquiry
        ? mapLeadFieldsToEnquiryUpdate(updates)
        : { ...updates, updatedAt: Timestamp.now() };

      await updateDoc(leadRef, payload);

      // Dispatch sync event
      this.handleDataSync({
        type: 'lead',
        action: 'updated',
        data: { leadId, updates },
        timestamp: Date.now(),
        source: 'dataSyncService',
        leadId
      });

      return true;
    } catch (error: any) {
      firebaseQuotaManager.handleQuotaError(error);
      console.error('🔄 DataSyncService: Error syncing lead data:', error);
      return false;
    }
  }

  public async syncStatusUpdate(leadId: string, newStatus: string) {
    try {
      const leadRef = getLeadDocRef(db, leadId);
      const isEnquiry = leadId.startsWith('enquiry_');
      await updateDoc(
        leadRef,
        isEnquiry
          ? { status: newStatus }
          : { status: newStatus, updatedAt: Timestamp.now() }
      );

      // Dispatch sync event
      this.handleDataSync({
        type: 'status',
        action: 'updated',
        data: { leadId, newStatus },
        timestamp: Date.now(),
        source: 'dataSyncService',
        leadId
      });

      return true;
    } catch (error) {
      console.error('🔄 DataSyncService: Error syncing status update:', error);
      return false;
    }
  }

  public forceRefresh(type: DataSyncEvent['type']) {
    this.handleDataSync({
      type,
      action: 'refreshed',
      data: null,
      timestamp: Date.now(),
      source: 'dataSyncService'
    });
  }

  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      centreId: this.centreId,
      userId: this.userId,
      hasLeadListener: !!this.leadUnsubscribe,
      hasReminderListener: false,
      subscribersCount: Array.from(this.syncCallbacks.values()).reduce((total, callbacks) => total + callbacks.length, 0)
    };
  }

  public cleanup() {
    if (this.leadUnsubscribe) {
      this.leadUnsubscribe();
      this.leadUnsubscribe = null;
    }

    this.syncCallbacks.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService(); 