import { getFirebaseAdmin } from '../firebaseConfig';
import admin from 'firebase-admin';
import { createTransport } from 'nodemailer';
import SMSService from './smsService';

export interface ScheduledReminder {
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
  processed?: boolean; // Whether the reminder has been processed by any user
  processedAt?: Timestamp; // When it was processed
  processedBy?: string; // Who processed it
  hasBeenActedUpon?: boolean; // Whether any action has been taken on this reminder
  lastAction?: {
    status: string;
    timestamp: Timestamp;
    userId: string;
    remarks?: string;
  };
}

class ReminderScheduler {
  private scheduledTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private unsubscribeFromReminders: (() => void) | null = null;
  private isInitialized = false;
  private emailTransporter: any = null;
  private processingReminders: Set<string> = new Set(); // Track reminders being processed

  constructor() {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter() {
    // Initialize email transporter for sending email notifications
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  public init() {
    if (this.isInitialized) {
      console.log('🔧 ReminderScheduler: Already initialized');
      return;
    }

    console.log('🔧 ReminderScheduler: Initializing server-side reminder scheduler');
    this.isInitialized = true;
    this.startMonitoring();
    
    // Load existing pending reminders
    this.loadExistingReminders();
  }

  private async loadExistingReminders() {
    try {
      console.log('🔧 ReminderScheduler: Loading existing pending reminders');
      const firebaseAdmin = await getFirebaseAdmin();
      
      if (!firebaseAdmin) {
        console.log('⚠️ ReminderScheduler: Firebase Admin not available, skipping reminder loading');
        return;
      }
      
      const { adminDb } = firebaseAdmin;
      const remindersRef = adminDb.collection('reminders');
      const snapshot = await remindersRef
        .where('status', '==', 'pending')
        .get();

      const reminders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduledReminder[];

      console.log(`🔧 ReminderScheduler: Found ${reminders.length} existing pending reminders`);
      
      // Filter out processed reminders
      const unprocessedReminders = reminders.filter(reminder => 
        !reminder.processed && !reminder.hasBeenActedUpon
      );
      
      console.log(`🔧 ReminderScheduler: Scheduling ${unprocessedReminders.length} unprocessed reminders`);
      
      // Schedule each unprocessed reminder
      unprocessedReminders.forEach(reminder => {
        this.scheduleReminder(reminder);
      });

      // Cancel any reminders that are no longer in the list
      this.scheduledTimeouts.forEach((timeout, reminderId) => {
        const stillExists = unprocessedReminders.some(r => r.id === reminderId);
        if (!stillExists) {
          console.log(`🔧 ReminderScheduler: Cancelling removed reminder ${reminderId}`);
          this.cancelReminder(reminderId);
        }
      });
    } catch (error) {
      console.error('🔧 ReminderScheduler: Error loading existing reminders:', error);
    }
  }

  private startMonitoring() {
    console.log('🔧 ReminderScheduler: Starting real-time reminder monitoring');
    
    // For server-side monitoring, we'll use a polling approach instead of onSnapshot
    // since Firebase Admin SDK doesn't support real-time listeners in the same way
    this.startPolling();
  }

  private startPolling() {
    // Poll every 2 minutes for new reminders (reduced frequency to avoid spam)
    setInterval(async () => {
      try {
        const { adminDb } = getFirebaseAdmin();
        
        const remindersRef = adminDb.collection('reminders');
        const snapshot = await remindersRef
          .where('status', '==', 'pending')
          .get();

        const reminders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ScheduledReminder[];

        // Filter out processed reminders
        const unprocessedReminders = reminders.filter(reminder => 
          !reminder.processed && !reminder.hasBeenActedUpon
        );

        // Only log if there are unprocessed reminders to avoid spam
        if (unprocessedReminders.length > 0 && process.env.NODE_ENV === 'development') {
          console.log(`🔧 ReminderScheduler: Polling found ${unprocessedReminders.length} unprocessed reminders`);
        }

        // Schedule any new unprocessed reminders
        unprocessedReminders.forEach(reminder => {
          if (!this.scheduledTimeouts.has(reminder.id)) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔧 ReminderScheduler: Scheduling new reminder "${reminder.title}"`);
            }
            this.scheduleReminder(reminder);
          }
        });

        // Cancel any reminders that are no longer in the list
        this.scheduledTimeouts.forEach((timeout, reminderId) => {
          const stillExists = unprocessedReminders.some(r => r.id === reminderId);
          if (!stillExists) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔧 ReminderScheduler: Cancelling removed reminder ${reminderId}`);
            }
            this.cancelReminder(reminderId);
          }
        });
      } catch (error) {
        console.error('🔧 ReminderScheduler: Error during polling:', error);
      }
    }, 120000); // 2 minutes instead of 30 seconds
  }

  private scheduleReminder(reminder: ScheduledReminder) {
    // Check if reminder has been processed
    if (reminder.processed || reminder.hasBeenActedUpon) {
      console.log(`🔧 ReminderScheduler: Skipping processed reminder "${reminder.title}" - already acted upon`);
      return;
    }

    // Cancel existing timeout if any
    this.cancelReminder(reminder.id);

    const dueDate = new Date(reminder.dueDate.toMillis());
    const now = new Date();
    const timeUntilDue = dueDate.getTime() - now.getTime();

    console.log(`🔧 ReminderScheduler: Scheduling "${reminder.title}" for ${dueDate.toLocaleString()}`);

    if (timeUntilDue > 0) {
      // Schedule for exact time
      const timeout = setTimeout(() => {
        console.log(`🔧 ReminderScheduler: EXACT TIME - Triggering reminder "${reminder.title}"`);
        this.triggerReminder(reminder);
      }, timeUntilDue);

      this.scheduledTimeouts.set(reminder.id, timeout);
      
      console.log(`🔧 ReminderScheduler: Scheduled reminder "${reminder.title}" to trigger in ${Math.floor(timeUntilDue / 1000)} seconds`);
    } else if (timeUntilDue <= 0 && timeUntilDue > -60 * 60 * 1000) { // Within 1 hour of being overdue
      // Trigger immediately if overdue by less than 1 hour
      console.log(`🔧 ReminderScheduler: Overdue reminder "${reminder.title}" - triggering immediately`);
      this.triggerReminder(reminder);
    } else {
      console.log(`🔧 ReminderScheduler: Reminder "${reminder.title}" is too old (${Math.floor(timeUntilDue / (1000 * 60 * 1000))} hours overdue) - skipping`);
    }
  }

  private cancelReminder(reminderId: string) {
    const timeout = this.scheduledTimeouts.get(reminderId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledTimeouts.delete(reminderId);
      console.log(`🔧 ReminderScheduler: Cancelled reminder ${reminderId}`);
    }
  }

  private async triggerReminder(reminder: ScheduledReminder) {
    // Prevent duplicate processing
    if (this.processingReminders.has(reminder.id)) {
      console.log(`⚠️ ReminderScheduler: Reminder "${reminder.title}" is already being processed, skipping`);
      return;
    }

    this.processingReminders.add(reminder.id);

    try {
      console.log(`🔧 ReminderScheduler: Triggering reminder "${reminder.title}" for lead "${reminder.leadName}"`);

      // Check if reminder still exists before processing
      const firebaseAdmin = await getFirebaseAdmin();
      if (!firebaseAdmin) {
        console.log('⚠️ ReminderScheduler: Firebase Admin not available, skipping reminder trigger');
        this.processingReminders.delete(reminder.id);
        return;
      }
      
      const { adminDb } = firebaseAdmin;
      const reminderRef = adminDb.collection('reminders').doc(reminder.id);
      const reminderDoc = await reminderRef.get();
      
      if (!reminderDoc.exists) {
        console.log(`⚠️ ReminderScheduler: Reminder "${reminder.title}" no longer exists, skipping`);
        this.cancelReminder(reminder.id);
        this.processingReminders.delete(reminder.id);
        return;
      }

      // Mark as notification sent
      await reminderRef.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });

      // Send notifications
      await this.sendNotifications(reminder);

      // Log the triggered reminder
      console.log(`✅ ReminderScheduler: Successfully triggered reminder "${reminder.title}" at ${new Date().toLocaleString()}`);

    } catch (error) {
      console.error(`❌ ReminderScheduler: Error triggering reminder "${reminder.title}":`, error);
    } finally {
      this.processingReminders.delete(reminder.id);
    }
  }

  private async sendNotifications(reminder: ScheduledReminder) {
    const notifications = [];

    // 1. Send SMS notification if phone number is available
    if (reminder.leadPhone) {
      try {
        const smsMessage = this.generateSMSMessage(reminder);
        await SMSService.sendSMS({
          phoneNumber: reminder.leadPhone,
          message: smsMessage,
          studentName: reminder.leadName,
          type: 'custom'
        });
        notifications.push('SMS sent');
        console.log(`📱 ReminderScheduler: SMS sent to ${reminder.leadPhone}`);
      } catch (error) {
        console.error(`❌ ReminderScheduler: Failed to send SMS to ${reminder.leadPhone}:`, error);
      }
    }

    // 2. Send email notification if email is available
    if (reminder.leadEmail && this.emailTransporter) {
      try {
        await this.sendEmailNotification(reminder);
        notifications.push('Email sent');
        console.log(`📧 ReminderScheduler: Email sent to ${reminder.leadEmail}`);
      } catch (error) {
        console.error(`❌ ReminderScheduler: Failed to send email to ${reminder.leadEmail}:`, error);
      }
    }

    // 3. Create system notification in database
    try {
      await this.createSystemNotification(reminder);
      notifications.push('System notification created');
      console.log(`🔔 ReminderScheduler: System notification created for reminder "${reminder.title}"`);
    } catch (error) {
      console.error(`❌ ReminderScheduler: Failed to create system notification:`, error);
    }

    console.log(`📨 ReminderScheduler: Notifications sent for "${reminder.title}": ${notifications.join(', ')}`);
  }

  private generateSMSMessage(reminder: ScheduledReminder): string {
    const dueTime = new Date(reminder.dueDate.toMillis()).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `Dear ${reminder.leadName}, this is a reminder for "${reminder.title}" scheduled for ${dueTime}. ${reminder.description ? `Details: ${reminder.description}` : ''} - ZICA ZIMA CRM`;
  }

  private async sendEmailNotification(reminder: ScheduledReminder) {
    if (!this.emailTransporter || !reminder.leadEmail) return;

    const dueTime = new Date(reminder.dueDate.toMillis()).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: reminder.leadEmail,
      subject: `Reminder: ${reminder.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">ZICA ZIMA CRM - Reminder</h2>
          <p><strong>Dear ${reminder.leadName},</strong></p>
          <p>This is a reminder for your scheduled activity:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">${reminder.title}</h3>
            <p><strong>Type:</strong> ${reminder.type}</p>
            <p><strong>Priority:</strong> ${reminder.priority}</p>
            <p><strong>Scheduled Time:</strong> ${dueTime}</p>
            ${reminder.description ? `<p><strong>Description:</strong> ${reminder.description}</p>` : ''}
            ${reminder.assignedTo ? `<p><strong>Assigned To:</strong> ${reminder.assignedTo}</p>` : ''}
          </div>
          <p>Please take necessary action as per the schedule.</p>
          <p>Best regards,<br>ZICA ZIMA CRM Team</p>
        </div>
      `
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  private async createSystemNotification(reminder: ScheduledReminder) {
    const { adminDb } = getFirebaseAdmin();
    const notificationData = {
      userId: reminder.createdBy,
      centreId: reminder.centreId,
      type: 'reminder' as const,
      title: `Reminder: ${reminder.title}`,
      message: `Reminder for ${reminder.leadName} - ${reminder.description || reminder.title}`,
      isRead: false,
      priority: reminder.priority || 'medium',
      scheduledTime: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      metadata: {
        leadId: reminder.leadId,
        leadName: reminder.leadName,
        reminderId: reminder.id,
        type: reminder.type,
        status: reminder.status
      }
    };

    await adminDb.collection('notifications').add(notificationData);
  }

  public async createTestReminder(centreId: string = 'demo-centre-001') {
    try {
      const { adminDb } = getFirebaseAdmin();
      const testReminder = {
        leadId: "test-lead-123",
        leadName: "Test Lead",
        leadPhone: "+91-9876543210",
        leadEmail: "test@example.com",
        title: "Test Server Reminder - Call Lead",
        description: "This is a test reminder to verify server-side scheduling",
        dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 60000)), // 1 minute from now
        status: "pending" as const,
        priority: "high" as const,
        type: "call" as const,
        notes: "Test reminder for server-side notification system",
        assignedTo: "test-user",
        centreId: centreId,
        createdBy: "test-user",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        notificationSent: false,
        processed: false,
        hasBeenActedUpon: false
      };

      const docRef = await adminDb.collection('reminders').add(testReminder);
      console.log('✅ ReminderScheduler: Test reminder created with ID:', docRef.id);
      console.log('⏰ Reminder will trigger at:', new Date(Date.now() + 60000).toLocaleString());
      
      return docRef.id;
    } catch (error) {
      console.error('❌ ReminderScheduler: Error creating test reminder:', error);
      throw error;
    }
  }

  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      scheduledRemindersCount: this.scheduledTimeouts.size,
      scheduledReminders: Array.from(this.scheduledTimeouts.keys()),
      unsubscribeActive: !!this.unsubscribeFromReminders,
      emailTransporterActive: !!this.emailTransporter,
      smsServiceActive: true // SMS service is static, always available
    };
  }

  public cleanup() {
    console.log('🧹 ReminderScheduler: Cleaning up');
    
    if (this.unsubscribeFromReminders) {
      this.unsubscribeFromReminders();
      this.unsubscribeFromReminders = null;
    }
    
    // Clear all scheduled timeouts
    this.scheduledTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.scheduledTimeouts.clear();
    
    // Clear processing reminders
    this.processingReminders.clear();
    
    this.isInitialized = false;
  }
}

export const reminderScheduler = new ReminderScheduler();
