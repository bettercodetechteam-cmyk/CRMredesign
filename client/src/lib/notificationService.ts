import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs } from 'firebase/firestore';

export interface Notification {
  id: string;
  userId: string;
  centreId: string;
  type: 'reminder' | 'alert' | 'system' | 'payment' | 'task';
  title: string;
  message: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledTime?: Timestamp;
  dueTime?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: {
    leadId?: string;
    leadName?: string;
    amount?: number;
    status?: string;
    taskId?: string;
    event?: string;
    taskTitle?: string;
    assignedByName?: string;
    assignedToNames?: string[];
    dueDate?: string;
    priority?: string;
    taskStatus?: string;
    [key: string]: unknown;
  };
}

export interface NotificationSettings {
  id: string;
  userId: string;
  centreId: string;
  enabled: boolean;
  sound: boolean;
  browserNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  reminderFrequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
  reminderTime: string; // HH:mm format
  timezone: string;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  notificationTypes: {
    reminders: boolean;
    alerts: boolean;
    system: boolean;
    payments: boolean;
    tasks: boolean;
  };
}

class NotificationService {
  private centreId: string | null = null;
  private userId: string | null = null;
  private unsubscribeFromNotifications: (() => void) | null = null;
  private notificationCallbacks: ((notifications: Notification[]) => void)[] = [];
  private settingsCallbacks: ((settings: NotificationSettings) => void)[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private scheduledTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private settings: NotificationSettings | null = null;
  private notifications: Map<string, Notification> = new Map();

  public init(centreId: string, userId: string) {
    
    if (this.centreId === centreId && this.userId === userId) {
      return;
    }

    // Clean up previous initialization
    if (this.centreId) {
      this.cleanup();
    }

    this.centreId = centreId;
    this.userId = userId;
    
    this.startNotificationMonitoring(userId);
    this.loadSettings(userId);
    this.startScheduledChecking();
    
    // Request browser notification permission
    this.requestNotificationPermission();
  }

  private async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('🔔 NotificationService: Error requesting notification permission:', error);
        }
      }
    }
  }

  private startNotificationMonitoring(userId: string) {
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', userId));

    this.unsubscribeFromNotifications = onSnapshot(q, (snapshot) => {
      
      const newNotifications = new Map<string, Notification>();
      snapshot.docs.forEach(doc => {
        const notification = { id: doc.id, ...doc.data() } as Notification;
        newNotifications.set(notification.id, notification);
      });

      // Update notifications and schedule any new ones
      this.updateNotifications(newNotifications);
      
      const notifications = Array.from(newNotifications.values());
      
      // Filter notifications based on settings
      const filteredNotifications = this.filterNotifications(notifications);
      
      // Notify subscribers
      this.notificationCallbacks.forEach(callback => callback(filteredNotifications));
      
      // Show browser notifications for unread notifications
      this.showBrowserNotifications(filteredNotifications.filter(n => !n.isRead));
    }, (error) => {
      if (process.env.NODE_ENV === 'development') {
      console.error('🔔 NotificationService: Error listening to notifications:', error);
      }
    });
  }

  private updateNotifications(newNotifications: Map<string, Notification>) {
    // Clear old timeouts for removed notifications
    this.scheduledTimeouts.forEach((timeout, notificationId) => {
      if (!newNotifications.has(notificationId)) {
        clearTimeout(timeout);
        this.scheduledTimeouts.delete(notificationId);
      }
    });

    // Update notifications and schedule new ones
    this.notifications = newNotifications;
    this.scheduleNotifications();
  }

  private scheduleNotifications() {
    const now = new Date();
    
    this.notifications.forEach((notification, notificationId) => {
      if (notification.scheduledTime && !notification.isRead) {
        const scheduledTime = new Date(notification.scheduledTime.toMillis());
        const timeUntilScheduled = scheduledTime.getTime() - now.getTime();
        
        // Clear existing timeout for this notification
        if (this.scheduledTimeouts.has(notificationId)) {
          clearTimeout(this.scheduledTimeouts.get(notificationId)!);
        }

        // Schedule notification for exact scheduled time
        if (timeUntilScheduled > 0) {
          
          const timeout = setTimeout(() => {
            this.triggerScheduledNotification(notification);
          }, timeUntilScheduled);
          
          this.scheduledTimeouts.set(notificationId, timeout);
        } else if (timeUntilScheduled <= 0 && timeUntilScheduled > -60 * 60 * 1000) { // Within 1 hour of being overdue
          // Show overdue notification immediately
          this.triggerScheduledNotification(notification);
        }
      }
    });
  }

  private triggerScheduledNotification(notification: Notification) {
    // Mark as read
    this.markAsRead(notification.id);
    
    // Show browser notification
    this.showBrowserNotifications([notification]);
    
    // Notify subscribers
    this.notificationCallbacks.forEach(callback => callback([notification]));
    
  }

  private async loadSettings(userId: string) {
    try {
      const settingsRef = collection(db, 'notificationSettings');
      const q = query(settingsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        this.settings = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        } as NotificationSettings;
      } else {
        // Create default settings
        this.settings = {
          id: '',
          userId,
          centreId: this.centreId!,
          enabled: true,
          sound: true,
          browserNotifications: true,
          emailNotifications: true,
          smsNotifications: false,
          reminderFrequency: 'daily',
          reminderTime: '09:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          },
          notificationTypes: {
            reminders: true,
            alerts: true,
            system: true,
            payments: true,
            tasks: true,
          }
        };
        
        // Save default settings
        await this.saveSettings(this.settings);
      }
      
      // Notify settings subscribers
      this.settingsCallbacks.forEach(callback => callback(this.settings!));
      
    } catch (error) {
      console.error('🔔 NotificationService: Error loading settings:', error);
    }
  }

  private getNotificationTypeEnabled(type: Notification['type']): boolean {
    const typeMap: Record<Notification['type'], keyof NotificationSettings['notificationTypes']> = {
      reminder: 'reminders',
      alert: 'alerts',
      system: 'system',
      payment: 'payments',
      task: 'tasks',
    };
    const key = typeMap[type];
    return this.settings?.notificationTypes[key] ?? true;
  }

  private filterNotifications(notifications: Notification[]): Notification[] {
    if (!this.settings?.enabled) return [];
    
    return notifications.filter(notification => {
      if (!this.getNotificationTypeEnabled(notification.type)) {
        return false;
      }
      
      // Check quiet hours
      if (this.settings!.quietHours.enabled) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMin] = this.settings!.quietHours.start.split(':').map(Number);
        const [endHour, endMin] = this.settings!.quietHours.end.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        if (startTime <= endTime) {
          // Same day quiet hours
          if (currentTime >= startTime && currentTime <= endTime) {
            return false;
          }
        } else {
          // Overnight quiet hours
          if (currentTime >= startTime || currentTime <= endTime) {
            return false;
          }
        }
      }
      
      return true;
    });
  }

  private showBrowserNotifications(notifications: Notification[]) {
    if (!this.settings?.browserNotifications || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    notifications.forEach(notification => {
      // Don't show if already shown recently
      const lastShown = localStorage.getItem(`notification_${notification.id}`);
      if (lastShown && Date.now() - parseInt(lastShown) < 30000) { // 30 seconds
        return;
      }

      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
        badge: '/favicon.ico'
      });

      // Play sound if enabled
      if (this.settings?.sound) {
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.log('🔔 NotificationService: Could not play sound:', e));
        } catch (error) {
        }
      }

      // Mark as shown
      localStorage.setItem(`notification_${notification.id}`, Date.now().toString());

      // Auto-close after 5 seconds for non-urgent notifications
      if (notification.priority !== 'urgent') {
        setTimeout(() => {
          browserNotification.close();
        }, 5000);
      }
    });
  }

  private startScheduledChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check every 30 seconds for scheduled notifications
    this.checkInterval = setInterval(() => {
      this.checkScheduledNotifications();
    }, 30000);

    // Also check immediately
    this.checkScheduledNotifications();
  }

  private async checkScheduledNotifications() {
    if (!this.userId) return;

    try {
      const now = new Date();
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', this.userId),
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(q);
      const scheduledNotifications = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((notification) => {
          const scheduledTime = (notification as { scheduledTime?: { toDate?: () => Date } }).scheduledTime;
          if (!scheduledTime?.toDate) return false;
          return scheduledTime.toDate() <= now;
        }) as Notification[];

      if (scheduledNotifications.length > 0) {
        
        // Mark as read and show
        for (const notification of scheduledNotifications) {
          await this.markAsRead(notification.id);
        }
        
        // Trigger notification display
        this.notificationCallbacks.forEach(callback => callback(scheduledNotifications));
      }
    } catch (error) {
      console.error('🔔 NotificationService: Error checking scheduled notifications:', error);
    }
  }

  public subscribe(callback: (notifications: Notification[]) => void): () => void {
    this.notificationCallbacks.push(callback);
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  public subscribeToSettings(callback: (settings: NotificationSettings) => void): () => void {
    this.settingsCallbacks.push(callback);
    if (this.settings) {
      callback(this.settings);
    }
    return () => {
      const index = this.settingsCallbacks.indexOf(callback);
      if (index > -1) {
        this.settingsCallbacks.splice(index, 1);
      }
    };
  }

  public async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('🔔 NotificationService: Error creating notification:', error);
      throw error;
    }
  }

  public async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        updatedAt: Timestamp.now()
      });
      
    } catch (error) {
      console.error('🔔 NotificationService: Error marking notification as read:', error);
      throw error;
    }
  }

  public async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      if (!this.settings?.id) {
        throw new Error('Settings not loaded');
      }

      const updatedSettings = { ...this.settings, ...settings };
      const settingsRef = doc(db, 'notificationSettings', this.settings.id);
      await updateDoc(settingsRef, {
        ...updatedSettings,
        updatedAt: Timestamp.now()
      });

      this.settings = updatedSettings;
      
      // Notify settings subscribers
      this.settingsCallbacks.forEach(callback => callback(this.settings!));
      
    } catch (error) {
      console.error('🔔 NotificationService: Error updating settings:', error);
      throw error;
    }
  }

  private async saveSettings(settings: NotificationSettings): Promise<void> {
    try {
      const docRef = await addDoc(collection(db, 'notificationSettings'), {
        ...settings,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      this.settings = { ...settings, id: docRef.id };
    } catch (error) {
      console.error('🔔 NotificationService: Error saving settings:', error);
      throw error;
    }
  }

  public async scheduleNotification(
    title: string,
    message: string,
    scheduledTime: Date,
    type: Notification['type'] = 'reminder',
    priority: Notification['priority'] = 'medium',
    metadata?: Notification['metadata']
  ): Promise<string> {
    if (!this.centreId || !this.userId) {
      throw new Error('NotificationService not initialized');
    }

    return this.createNotification({
      userId: this.userId,
      centreId: this.centreId,
      type,
      title,
      message,
      isRead: false,
      priority,
      scheduledTime: Timestamp.fromDate(scheduledTime),
      metadata
    });
  }

  public cleanup() {
    
    if (this.unsubscribeFromNotifications) {
      this.unsubscribeFromNotifications();
      this.unsubscribeFromNotifications = null;
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
    
    this.notificationCallbacks = [];
    this.settingsCallbacks = [];
    this.notifications.clear();
    this.centreId = null;
    this.userId = null;
    this.settings = null;
  }
}

export const notificationService = new NotificationService(); 