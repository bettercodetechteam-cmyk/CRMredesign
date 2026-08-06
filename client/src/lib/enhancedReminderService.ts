import { db } from './firebase';
import { collection, query, where, doc, updateDoc, Timestamp, getDoc, getDocs, addDoc } from 'firebase/firestore';
import { firebaseListenerManager } from './firebaseListenerManager';
import { getReminderListenerOptions, isActiveReminderStatus } from './reminderListenerConfig';

export interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone?: string;
  leadEmail?: string;
  title: string;
  description: string;
  dueDate: Timestamp;
  status: 'pending' | 'completed' | 'snoozed' | 'call_made' | 'meeting_scheduled' | 'followup_scheduled' | 'admission_processed' | 'rescheduled' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  type?: 'call' | 'meeting' | 'followup' | 'admission' | 'other';
  notes?: string;
  assignedTo?: string;
  centreId: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;
  notificationSent?: boolean;
  notificationSentAt?: Timestamp;
  lastNotificationTime?: number; // Track when last notification was shown
  notificationCount?: number; // Track how many times notification was shown
  processed?: boolean;
  hasBeenActedUpon?: boolean;
}

export interface ActiveNotification {
  reminder: Reminder;
  type: 'due' | 'overdue' | 'upcoming';
  minutesDiff: number;
}

class EnhancedReminderService {
  private centreId: string | null = null;
  private unsubscribeFromReminders: (() => void) | null = null;
  private notificationCallbacks: ((notifications: ActiveNotification[]) => void)[] = [];
  private activeNotifications: Map<string, ActiveNotification> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastNotificationTime: Map<string, number> = new Map();
  private scheduledTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private reminders: Map<string, Reminder> = new Map();
  private isInitialized = false;
  private notificationSound: HTMLAudioElement | null = null;
  private dismissedNotifications: Set<string> = new Set(); // Track dismissed notifications
  private maxNotificationCount = 3; // Maximum times to show notification for same reminder

  public init(centreId: string) {
    if (process.env.NODE_ENV === 'development') {
    }
    
    if (this.centreId === centreId && this.isInitialized) {
      if (process.env.NODE_ENV === 'development') {
      }
      return;
    }

    // Clean up previous initialization
    if (this.centreId) {
      this.cleanup();
    }

    this.centreId = centreId;
    this.isInitialized = true;
    this.startReminderMonitoring(centreId);
    this.setupEventListeners();
    this.loadNotificationSound();
    
    // Force check for overdue reminders on initialization
    setTimeout(() => {
      this.checkForOverdueReminders();
    }, 2000); // Check after 2 seconds to allow data to load
    
    if (process.env.NODE_ENV === 'development') {
    }
  }

  private loadNotificationSound() {
    try {
      this.notificationSound = new Audio('/notification-sound.mp3');
      this.notificationSound.preload = 'auto';
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Could not load notification sound:', error);
      }
    }
  }

  private setupEventListeners() {
    // Listen for reminder reschedule events
    window.addEventListener('reminderRescheduled', this.handleReminderRescheduled);
    window.addEventListener('reminderServiceRefresh', this.handleReminderServiceRefresh);
    
    // Listen for status updates to cancel reminders
    window.addEventListener('statusUpdated', this.handleStatusUpdate);
    
    // Listen for reminder dismissals
    window.addEventListener('reminderDismissed', this.handleReminderDismissed);
  }

  private handleStatusUpdate = (event: CustomEvent) => {
    const { leadId, newStatus } = event.detail;
    if (process.env.NODE_ENV === 'development') {
    }
    
    // Cancel reminders for certain status changes
    const statusesCancellingReminders = [
      "Call Made", "Call Cancelled", "Follow-up Completed", "Follow-up Cancelled",
      "Visit Completed", "Visit Cancelled", "Not Interested", "Lost", "Dropped", 
      "Fake", "Admission Done", "Converted", "Done"
    ];
    
    if (statusesCancellingReminders.includes(newStatus)) {
      this.cancelRemindersForLead(leadId);
    }
  };

  private handleReminderDismissed = (event: CustomEvent) => {
    const { reminderId } = event.detail;
    if (process.env.NODE_ENV === 'development') {
    }
    this.dismissedNotifications.add(reminderId);
    
    // Remove from active notifications
    this.activeNotifications.delete(reminderId);
    this.notifySubscribers();
  };

  private async cancelRemindersForLead(leadId: string) {
    if (!this.centreId) return;
    
    try {
      if (process.env.NODE_ENV === 'development') {
      }
      
      const remindersRef = collection(db, 'reminders');
      const q = query(
        remindersRef,
        where('leadId', '==', leadId),
        where('centreId', '==', this.centreId),
        where('status', 'in', ['pending', 'snoozed'])
      );
      
      const snapshot = await getDocs(q);
      const updatePromises = snapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          status: 'cancelled',
          updatedAt: Timestamp.now(),
          updatedBy: 'system'
        })
      );
      
      await Promise.all(updatePromises);
      if (process.env.NODE_ENV === 'development') {
      }
      
      // Remove from active notifications
      snapshot.docs.forEach(doc => {
        this.activeNotifications.delete(doc.id);
        this.dismissedNotifications.add(doc.id);
      });
      
      this.notifySubscribers();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error cancelling reminders for lead:', error);
      }
    }
  }

  private startReminderMonitoring(centreId: string) {
    if (process.env.NODE_ENV === 'development') {
    }

    this.unsubscribeFromReminders = firebaseListenerManager.subscribe(
      'reminders',
      (data) => {
        const newReminders = new Map<string, Reminder>();
        (data as Array<Record<string, unknown> & { id: string }>).forEach((item) => {
          const reminder = item as unknown as Reminder;
          if (!isActiveReminderStatus(reminder.status)) return;
          if (reminder.processed || reminder.hasBeenActedUpon) return;
          newReminders.set(reminder.id, reminder);
        });

        if (process.env.NODE_ENV === 'development') {
        }

        this.updateReminders(newReminders);
        this.dispatchCalendarUpdateEvent(newReminders);
      },
      getReminderListenerOptions(centreId)
    );
  }

  private updateReminders(newReminders: Map<string, Reminder>) {
    // Clear old timeouts for removed reminders
    this.scheduledTimeouts.forEach((timeout, reminderId) => {
      if (!newReminders.has(reminderId)) {
        clearTimeout(timeout);
        this.scheduledTimeouts.delete(reminderId);
      }
    });

    // Update reminders and schedule new notifications
    this.reminders = newReminders;
    this.scheduleNotifications();
  }

  private scheduleNotifications() {
    const now = new Date();
    if (process.env.NODE_ENV === 'development') {
    }
    
    this.reminders.forEach((reminder, reminderId) => {
      // Skip processed or acted upon reminders
      if (reminder.processed || reminder.hasBeenActedUpon || reminder.status === 'completed') {
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }
      
      // Handle different date formats for dueDate
      let dueDate: Date;
      if (reminder.dueDate && typeof reminder.dueDate === 'object' && 'toMillis' in reminder.dueDate) {
        // Handle Firestore Timestamp
        dueDate = new Date(reminder.dueDate.toMillis());
      } else if (reminder.dueDate instanceof Date) {
        // Handle Date object
        dueDate = reminder.dueDate;
      } else if (typeof reminder.dueDate === 'string' || typeof reminder.dueDate === 'number') {
        // Handle string or number
        dueDate = new Date(reminder.dueDate);
      } else {
        console.warn('🔧 EnhancedReminderService: Unknown dueDate format for reminder:', reminder.id, reminder.dueDate);
        return;
      }

      const timeUntilDue = dueDate.getTime() - now.getTime();
      
      // Clear existing timeout for this reminder
      if (this.scheduledTimeouts.has(reminderId)) {
        clearTimeout(this.scheduledTimeouts.get(reminderId)!);
      }

      if (process.env.NODE_ENV === 'development') {
      }

      // Schedule notifications for future times
      if (timeUntilDue > 0) {
        if (process.env.NODE_ENV === 'development') {
        }
        
        const timeout = setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
          }
          this.triggerNotification(reminder, 'due', 0);
        }, timeUntilDue);
        
        this.scheduledTimeouts.set(reminderId, timeout);
      } else if (timeUntilDue <= 0) { // Overdue reminders
        // Show overdue notifications for all pending reminders
        if (process.env.NODE_ENV === 'development') {
        }
        this.triggerNotification(reminder, 'overdue', Math.abs(timeUntilDue));
      }
    });

    // Start frequent checking as backup (every 30 seconds) but don't show immediate notifications
    this.startFrequentChecking();
  }

  private startFrequentChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check every 30 seconds for precise timing
    this.checkInterval = setInterval(() => {
      this.checkForActiveNotifications();
    }, 30000);

    // Also check immediately
    this.checkForActiveNotifications();
  }

  private checkForActiveNotifications() {
    if (process.env.NODE_ENV === 'development') {
    }
    
    if (!this.centreId || this.reminders.size === 0) {
      if (process.env.NODE_ENV === 'development') {
      }
      return;
    }

    const now = new Date();
    const newActiveNotifications = new Map<string, ActiveNotification>();

    this.reminders.forEach((reminder, reminderId) => {
      // Skip processed or acted upon reminders
      if (reminder.processed || reminder.hasBeenActedUpon || reminder.status === 'completed') {
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }

      // Skip dismissed notifications
      if (this.dismissedNotifications.has(reminderId)) {
        return;
      }

      // Skip if already has an active notification (prevent duplicates)
      if (this.activeNotifications.has(reminderId)) {
        return;
      }

      // Handle different date formats for dueDate
      let dueDate: Date;
      if (reminder.dueDate && typeof reminder.dueDate === 'object' && 'toMillis' in reminder.dueDate) {
        dueDate = new Date(reminder.dueDate.toMillis());
      } else if (reminder.dueDate instanceof Date) {
        dueDate = reminder.dueDate;
      } else if (typeof reminder.dueDate === 'string' || typeof reminder.dueDate === 'number') {
        dueDate = new Date(reminder.dueDate);
      } else {
        if (process.env.NODE_ENV === 'development') {
        console.warn('🔧 EnhancedReminderService: Unknown dueDate format for reminder:', reminder.id, reminder.dueDate);
        }
        return;
      }

      const timeDiff = dueDate.getTime() - now.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));

      // Validate minutesDiff to prevent NaN
      if (isNaN(minutesDiff)) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`🔧 EnhancedReminderService: Invalid minutesDiff for reminder "${reminder.title}":`, minutesDiff);
        }
        return;
      }

      // Check if notification should be shown
      let shouldShow = false;
      let notificationType: 'due' | 'overdue' | 'upcoming' = 'upcoming';

      // Only show notifications for reminders that are actually due or overdue
      // Don't show notifications for newly created reminders
      if (timeDiff <= 0) {
        // Due or overdue - but only if reminder was created before current time
        let reminderCreatedAt: Date;
        if (reminder.createdAt && typeof reminder.createdAt === 'object' && 'toMillis' in reminder.createdAt) {
          reminderCreatedAt = new Date(reminder.createdAt.toMillis());
        } else if (reminder.createdAt instanceof Date) {
          reminderCreatedAt = reminder.createdAt;
        } else {
          reminderCreatedAt = new Date(reminder.createdAt);
        }
        
        const timeSinceCreation = now.getTime() - reminderCreatedAt.getTime();
        
        if (timeSinceCreation > 60000) { // Created more than 1 minute ago - show all overdue reminders
          shouldShow = true;
          notificationType = timeDiff < 0 ? 'overdue' : 'due';
        }
      }
      // Removed the 5-minute early notification logic - notifications will only show at exact time or when overdue

      // Check notification count limit (temporarily disabled for debugging)
      const notificationCount = reminder.notificationCount || 0;
      if (notificationCount >= this.maxNotificationCount) {
        if (process.env.NODE_ENV === 'development') {
        }
        // return; // Temporarily disabled
      }

      // Check if we should show notification (avoid spam) - temporarily disabled for debugging
      const lastNotification = this.lastNotificationTime.get(reminderId);
      const timeSinceLastNotification = lastNotification ? now.getTime() - lastNotification : Infinity;
      const minInterval = 2 * 60 * 1000; // 2 minutes minimum between notifications

      if (shouldShow) { // Temporarily removed time interval check for debugging
        const notification: ActiveNotification = {
          reminder,
          type: notificationType,
          minutesDiff
        };
        newActiveNotifications.set(reminderId, notification);
      }
    });

    // Update active notifications
    this.activeNotifications = newActiveNotifications;
    
    // Notify subscribers if there are new notifications
    if (newActiveNotifications.size > 0) {
      if (process.env.NODE_ENV === 'development') {
      }
      this.notifySubscribers();
    }
  }

  private triggerNotification(reminder: Reminder, type: 'due' | 'overdue' | 'upcoming', minutesDiff: number) {
    // Check if notification was dismissed
    if (this.dismissedNotifications.has(reminder.id)) {
      if (process.env.NODE_ENV === 'development') {
      }
      return;
    }

    // Check if already has an active notification (prevent duplicates)
    if (this.activeNotifications.has(reminder.id)) {
      if (process.env.NODE_ENV === 'development') {
      }
      return;
    }

    // Check notification count limit (temporarily disabled for debugging)
    const notificationCount = reminder.notificationCount || 0;
    if (notificationCount >= this.maxNotificationCount) {
      if (process.env.NODE_ENV === 'development') {
      }
      // return; // Temporarily disabled
    }

    // Validate minutesDiff to prevent NaN
    if (isNaN(minutesDiff)) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`🔧 EnhancedReminderService: Invalid minutesDiff for reminder "${reminder.title}":`, minutesDiff);
      }
      return;
    }

    const notification: ActiveNotification = {
      reminder,
      type,
      minutesDiff
    };

    // Add to active notifications
    this.activeNotifications.set(reminder.id, notification);
    
    // Mark as shown and increment count
    this.lastNotificationTime.set(reminder.id, Date.now());
    
    // Update notification count in database
    this.updateNotificationCount(reminder.id, notificationCount + 1);
    
    // Play notification sound
    this.playNotificationSound();
    
    // Show browser notification
    this.showBrowserNotification(reminder, type, minutesDiff);
    
    // Notify subscribers
    this.notifySubscribers();
    
    if (process.env.NODE_ENV === 'development') {
    }
  }

  private async updateNotificationCount(reminderId: string, count: number) {
    try {
      const reminderRef = doc(db, 'reminders', reminderId);
      await updateDoc(reminderRef, {
        notificationCount: count,
        lastNotificationTime: Date.now(),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error updating notification count:', error);
      }
    }
  }

  private playNotificationSound() {
    if (this.notificationSound) {
      try {
        this.notificationSound.play().catch(error => {
          if (process.env.NODE_ENV === 'development') {
          console.warn('Could not play notification sound:', error);
          }
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.warn('Error playing notification sound:', error);
        }
      }
    }
  }

  private showBrowserNotification(reminder: Reminder, type: 'due' | 'overdue' | 'upcoming', minutesDiff: number) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    let title = "";
    let body = "";

    switch (type) {
      case "upcoming":
        title = `Reminder Coming Up: ${reminder.title}`;
        body = `${reminder.leadName} - Due in ${minutesDiff} minutes`;
        break;
      case "due":
        title = `Reminder Due: ${reminder.title}`;
        body = `${reminder.leadName} - ${reminder.description || "No description"}`;
        break;
      case "overdue":
        title = `Reminder Overdue: ${reminder.title}`;
        body = `${reminder.leadName} - ${Math.abs(minutesDiff)} minutes overdue`;
        break;
    }

    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `${reminder.id}-${type}`,
      requireInteraction: true,
      data: {
        reminderId: reminder.id,
        leadId: reminder.leadId,
        type,
      },
    });

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close notification after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);
  }

  private notifySubscribers() {
    const notifications = Array.from(this.activeNotifications.values());
    if (process.env.NODE_ENV === 'development') {
    }
    
    this.notificationCallbacks.forEach(callback => {
      callback(notifications);
    });
  }

  public subscribe(callback: (notifications: ActiveNotification[]) => void): () => void {
    this.notificationCallbacks.push(callback);
    
    // Immediately call with current notifications
    callback(Array.from(this.activeNotifications.values()));
    
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  public async updateReminderStatus(reminderId: string, status: string, notes?: string, updatedBy?: string) {
    try {
      const reminderRef = doc(db, 'reminders', reminderId);
      const updateData: any = {
        status,
        updatedAt: Timestamp.now()
      };
      
      if (notes) {
        updateData.notes = notes;
      }
      
      if (updatedBy) {
        updateData.updatedBy = updatedBy;
      }
      
      await updateDoc(reminderRef, updateData);
      
      // Remove from active notifications and tracking if status is not pending
      if (status !== 'pending') {
        this.activeNotifications.delete(reminderId);
        this.lastNotificationTime.delete(reminderId);
        this.dismissedNotifications.add(reminderId);
        
        // Clear scheduled timeout
        if (this.scheduledTimeouts.has(reminderId)) {
          clearTimeout(this.scheduledTimeouts.get(reminderId)!);
          this.scheduledTimeouts.delete(reminderId);
        }
        
        this.notifySubscribers();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error updating reminder status:', error);
      }
      throw error;
    }
  }

  public async snoozeReminder(reminderId: string, minutes: number) {
    try {
      const reminderRef = doc(db, 'reminders', reminderId);
      const newDueDate = new Date();
      newDueDate.setMinutes(newDueDate.getMinutes() + minutes);
      
      await updateDoc(reminderRef, {
        dueDate: Timestamp.fromDate(newDueDate),
        status: 'snoozed',
        updatedAt: Timestamp.now()
      });
      
      // Remove from active notifications and tracking
      this.activeNotifications.delete(reminderId);
      this.lastNotificationTime.delete(reminderId);
      this.dismissedNotifications.add(reminderId);
      
      // Clear scheduled timeout
      if (this.scheduledTimeouts.has(reminderId)) {
        clearTimeout(this.scheduledTimeouts.get(reminderId)!);
        this.scheduledTimeouts.delete(reminderId);
      }
      
      this.notifySubscribers();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Error snoozing reminder:', error);
      }
    }
  }

  public dismissNotification(reminderId: string) {
    if (process.env.NODE_ENV === 'development') {
    }
    this.dismissedNotifications.add(reminderId);
    this.activeNotifications.delete(reminderId);
    this.notifySubscribers();
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('reminderDismissed', {
      detail: { reminderId }
    }));
  }

  public forceRefresh() {
    if (process.env.NODE_ENV === 'development') {
    }
    this.checkForActiveNotifications();
  }

  private checkForOverdueReminders() {
    if (process.env.NODE_ENV === 'development') {
    }
    const now = new Date();
    let overdueCount = 0;
    
    this.reminders.forEach((reminder, reminderId) => {
      // Skip processed or acted upon reminders
      if (reminder.processed || reminder.hasBeenActedUpon || reminder.status === 'completed') {
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }
      
      if (reminder.status !== 'pending') return;
      
      let dueDate: Date;
      if (reminder.dueDate && typeof reminder.dueDate === 'object' && 'toMillis' in reminder.dueDate) {
        dueDate = new Date(reminder.dueDate.toMillis());
      } else if (reminder.dueDate instanceof Date) {
        dueDate = reminder.dueDate;
      } else if (typeof reminder.dueDate === 'string' || typeof reminder.dueDate === 'number') {
        dueDate = new Date(reminder.dueDate);
      } else {
        console.warn('🔧 EnhancedReminderService: Invalid dueDate format for reminder:', reminder.id, reminder.dueDate);
        return;
      }

      const timeUntilDue = dueDate.getTime() - now.getTime();
      
      if (timeUntilDue <= 0) {
        overdueCount++;
        this.triggerNotification(reminder, 'overdue', Math.abs(timeUntilDue));
      }
    });
    
  }

  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      centreId: this.centreId,
      remindersCount: this.reminders.size,
      activeNotificationsCount: this.activeNotifications.size,
      scheduledTimeoutsCount: this.scheduledTimeouts.size,
      checkIntervalActive: !!this.checkInterval,
      unsubscribeActive: !!this.unsubscribeFromReminders,
      dismissedNotificationsCount: this.dismissedNotifications.size
    };
  }

  public debugReminderTiming(reminderId: string) {
    const reminder = this.reminders.get(reminderId);
    if (!reminder) {
      return;
    }

    const now = new Date();
    let dueDate: Date;
    
    if (reminder.dueDate && typeof reminder.dueDate === 'object' && 'toMillis' in reminder.dueDate) {
      dueDate = new Date(reminder.dueDate.toMillis());
    } else if (reminder.dueDate instanceof Date) {
      dueDate = reminder.dueDate;
    } else {
      dueDate = new Date(reminder.dueDate);
    }

    const timeUntilDue = dueDate.getTime() - now.getTime();
    const minutesUntilDue = Math.floor(timeUntilDue / (1000 * 60));

  }

  public getActiveNotifications() {
    return Array.from(this.activeNotifications.values());
  }


  public debugCheckOverdueReminders() {
    
    this.reminders.forEach((reminder, reminderId) => {
    });
    
    this.checkForOverdueReminders();
  }

  // Function to clear all handled reminders for testing
  public clearAllHandledReminders() {
    this.dismissedNotifications.clear();
    this.lastNotificationTime.clear();
    this.activeNotifications.clear();
  }

  public cleanup() {
    
    if (this.unsubscribeFromReminders) {
      this.unsubscribeFromReminders();
      this.unsubscribeFromReminders = null;
    }
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Clear all scheduled timeouts
    this.scheduledTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.scheduledTimeouts.clear();
    
    // Remove event listeners
    window.removeEventListener('reminderRescheduled', this.handleReminderRescheduled);
    window.removeEventListener('reminderServiceRefresh', this.handleReminderServiceRefresh);
    window.removeEventListener('statusUpdated', this.handleStatusUpdate);
    window.removeEventListener('reminderDismissed', this.handleReminderDismissed);
    
    this.notificationCallbacks = [];
    this.activeNotifications.clear();
    this.lastNotificationTime.clear();
    this.dismissedNotifications.clear();
    this.reminders.clear();
    this.centreId = null;
    this.isInitialized = false;
  }

  private dispatchCalendarUpdateEvent(reminders: Map<string, Reminder>) {
    
    // Dispatch global event for calendar synchronization
    window.dispatchEvent(new CustomEvent('reminderDataUpdated', {
      detail: {
        action: 'updated',
        source: 'enhancedReminderService',
        centreId: this.centreId,
        timestamp: Date.now(),
        remindersCount: reminders.size,
        reminders: Array.from(reminders.values())
      }
    }));

    // Also dispatch calendar-specific event
    window.dispatchEvent(new CustomEvent('calendarDataUpdated', {
      detail: {
        action: 'updated',
        source: 'enhancedReminderService',
        timestamp: Date.now(),
        remindersCount: reminders.size,
        reminders: Array.from(reminders.values())
      }
    }));
  }

  private handleReminderRescheduled = (event: CustomEvent) => {
    const { reminderId, newDueDate } = event.detail;
    this.rescheduleReminder(reminderId, newDueDate);
  };

  private handleReminderServiceRefresh = (event: CustomEvent) => {
    if (event.detail.centreId === this.centreId) {
      this.refreshReminders();
    }
  };

  private rescheduleReminder(reminderId: string, newDueDate: Date) {
    
    // Clear existing timeout for this reminder
    if (this.scheduledTimeouts.has(reminderId)) {
      clearTimeout(this.scheduledTimeouts.get(reminderId)!);
      this.scheduledTimeouts.delete(reminderId);
    }

    const now = new Date();
    const timeUntilDue = newDueDate.getTime() - now.getTime();
    
    if (timeUntilDue > 0) {
      
      const timeout = setTimeout(() => {
        const reminder = this.reminders.get(reminderId);
        if (reminder) {
          this.triggerNotification(reminder, 'due', 0);
        }
      }, timeUntilDue);
      
      this.scheduledTimeouts.set(reminderId, timeout);
    } else {
      const reminder = this.reminders.get(reminderId);
      if (reminder) {
        this.triggerNotification(reminder, 'overdue', Math.floor(timeUntilDue / (1000 * 60)));
      }
    }
  }

  private refreshReminders() {
    // Force a re-schedule of all reminders
    this.scheduleNotifications();
  }
}

export const enhancedReminderService = new EnhancedReminderService();
