import { apiRequest } from "./queryClient";
import { ZICA_CENTRE_ADDRESS } from "@/constants/centreAddress";

export interface SMSNotification {
  phoneNumber: string;
  message: string;
  studentName: string;
  channel?: 'whatsapp' | 'sms' | 'email';
}

export interface BulkSMSNotification {
  notifications: SMSNotification[];
}

export interface SMSResponse {
  success: boolean;
  message: string;
  notification?: any;
  channel?: 'whatsapp' | 'sms' | 'email';
  provider?: string;
}

export interface BulkSMSResponse {
  success: boolean;
  message: string;
  results: {
    total: number;
    successful: number;
    failed: number;
    results: any[];
    errors: any[];
  };
}

class SMSService {
  /**
   * Send a single notification (WhatsApp preferred, SMS fallback)
   */
  async sendSMS(notification: SMSNotification): Promise<SMSResponse> {
    try {
      if (process.env.NODE_ENV === 'development') {
      console.log(`📱 Attempting to send ${notification.channel || 'WhatsApp'} to ${notification.phoneNumber} (${notification.studentName})`);
      console.log(`Message: ${notification.message}`);
      }
      
      const response = await apiRequest("POST", "/api/sms/send", notification);
      
      if (response.success) {
        const channel = response.notification?.channel || notification.channel || 'whatsapp';
        if (process.env.NODE_ENV === 'development') {
        console.log(`✅ ${channel.toUpperCase()} sent successfully to ${notification.phoneNumber}`);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
        console.error(`❌ Message failed for ${notification.phoneNumber}: ${response.message}`);
        }
      }
      
      return response;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error("Error sending message:", error);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to send message: ${errorMessage}`);
    }
  }

  /**
   * Send WhatsApp notification (preferred method)
   */
  async sendWhatsApp(notification: SMSNotification): Promise<SMSResponse> {
    return this.sendSMS({
      ...notification,
      channel: 'whatsapp'
    });
  }

  /**
   * Send SMS notification (fallback method)
   */
  async sendSMSOnly(notification: SMSNotification): Promise<SMSResponse> {
    return this.sendSMS({
      ...notification,
      channel: 'sms'
    });
  }

  /**
   * Send bulk notifications
   */
  async sendBulkSMS(notifications: SMSNotification[]): Promise<BulkSMSResponse> {
    try {
      const response = await apiRequest("POST", "/api/sms/bulk-send", { notifications });
      return response;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error("Error sending bulk messages:", error);
      }
      throw new Error("Failed to send bulk messages");
    }
  }

  /**
   * Send a test WhatsApp message to verify functionality
   */
  async sendTestWhatsApp(phoneNumber: string = "9307190851"): Promise<SMSResponse> {
    const testMessage = `📚 Test WhatsApp from ZICA ZIMA CRM

Hello! This is a test message to verify WhatsApp functionality.

✅ If you received this, WhatsApp integration is working perfectly!

- ZICA ZIMA Team`;
    
    return this.sendWhatsApp({
      phoneNumber,
      message: testMessage,
      studentName: "Test User"
    });
  }

  /**
   * Generate WhatsApp fee reminder message (rich format)
   */
  generateWhatsAppFeeReminder(student: any, dueDate: Date, amount: number): string {
    const formattedDate = dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    return `📚 *ZICA ZIMA Fee Reminder*

Dear *${student.firstName}*,

Your fee payment of *₹${amount.toLocaleString()}* is due on *${formattedDate}*.

Please make the payment to avoid any late fees.

💳 *Payment Methods:*
• UPI: zica@upi
• Bank Transfer: [Account Details]
• Cash: Visit our office

📞 *Contact:* +91-XXXXXXXXXX
📍 *Address:*
${ZICA_CENTRE_ADDRESS}

Reply *STOP* to unsubscribe.

- *ZICA ZIMA Team*`;
  }

  /**
   * Generate WhatsApp overdue notice message
   */
  generateWhatsAppOverdueNotice(student: any, amount: number, daysOverdue: number): string {
    return `⚠️ *ZICA ZIMA - Urgent Payment Notice*

Dear *${student.firstName}*,

Your payment of *₹${amount.toLocaleString()}* is *${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue*.

🚨 *Please make the payment immediately* to avoid additional charges.

💳 *Quick Payment:*
• UPI: zica@upi
• Bank Transfer: [Account Details]

📞 *Call us:* +91-XXXXXXXXXX

Reply *STOP* to unsubscribe.

- *ZICA ZIMA Team*`;
  }

  /**
   * Generate WhatsApp payment receipt message
   */
  generateWhatsAppPaymentReceipt(student: any, amount: number, transactionId?: string): string {
    const receiptText = `✅ *Payment Received - ZICA ZIMA*

Dear *${student.firstName}*,

Thank you for your payment of *₹${amount.toLocaleString()}*.

${transactionId ? `🔢 *Transaction ID:* ${transactionId}` : ''}

Your payment has been received successfully.

📚 *Continue your learning journey with us!*

Reply *STOP* to unsubscribe.

- *ZICA ZIMA Team*`;
    
    return receiptText;
  }

  /**
   * Generate WhatsApp fee reminder for specific student
   */
  generateWhatsAppFeeReminderSimple(student: any): string {
    const balance = parseFloat(student.feesBalance || '0');
    const dueDate = student.dueDate ? new Date(student.dueDate) : null;
    
    if (balance <= 0) {
      return `✅ *ZICA ZIMA - Account Status*

Dear *${student.firstName}*,

Your fee account is up to date! 

Thank you for your timely payments.

📚 *Keep up the great work!*

- *ZICA ZIMA Team*`;
    }
    
    if (dueDate && dueDate < new Date()) {
      const daysOverdue = Math.ceil((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return this.generateWhatsAppOverdueNotice(student, balance, daysOverdue);
    }
    
    if (dueDate) {
      return this.generateWhatsAppFeeReminder(student, dueDate, balance);
    }
    
    return `📚 *ZICA ZIMA Fee Notice*

Dear *${student.firstName}*,

You have a pending fee balance of *₹${balance.toLocaleString()}*.

Please make the payment at your earliest convenience.

💳 *Payment Methods:*
• UPI: zica@upi
• Bank Transfer: [Account Details]

Reply *STOP* to unsubscribe.

- *ZICA ZIMA Team*`;
  }

  /**
   * Validate phone number format (basic Indian format)
   */
  validatePhoneNumber(phone: string): boolean {
    // Basic validation for Indian phone numbers
    const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  }

  /**
   * Format phone number for SMS
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it starts with 91 and has 12 digits, add +
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = '+' + cleaned;
    }
    
    // If it's 10 digits and doesn't start with +, add +91
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      cleaned = '+91' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Check if message length is within SMS limits
   */
  checkMessageLength(message: string): { isValid: boolean; length: number; maxLength: number } {
    const maxLength = 160; // Standard SMS character limit
    const length = message.length;
    
    return {
      isValid: length <= maxLength,
      length,
      maxLength
    };
  }

  /**
   * Get SMS character count and estimated cost
   */
  getSMSCost(message: string): { characterCount: number; messageCount: number; estimatedCost: number } {
    const characterCount = message.length;
    const maxCharsPerMessage = 160;
    const messageCount = Math.ceil(characterCount / maxCharsPerMessage);
    const estimatedCostPerMessage = 0.15; // Approximate cost in INR
    const estimatedCost = messageCount * estimatedCostPerMessage;
    
    return {
      characterCount,
      messageCount,
      estimatedCost
    };
  }

  /**
   * Check SMS service status and configuration
   */
  async checkSMSStatus(): Promise<{
    configured: boolean;
    providers: string[];
    testNumber: string;
    status: 'ready' | 'not_configured' | 'error';
    message: string;
  }> {
    try {
      const response = await apiRequest("GET", "/api/sms/status");
      return response;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error("Error checking SMS status:", error);
      }
      return {
        configured: false,
        providers: [],
        testNumber: "9307190851",
        status: 'error',
        message: 'Failed to check SMS status'
      };
    }
  }

  /**
   * Send fee reminders to multiple students
   */
  async sendFeeReminders(students: any[]): Promise<BulkSMSResponse> {
    const notifications: SMSNotification[] = students
      .filter(student => student.phone && this.validatePhoneNumber(student.phone))
      .map(student => ({
        phoneNumber: this.formatPhoneNumber(student.phone),
        message: this.generateWhatsAppFeeReminderSimple(student),
        studentName: `${student.firstName} ${student.lastName}`
      }));

    if (notifications.length === 0) {
      throw new Error("No valid phone numbers found for fee reminders");
    }

    return this.sendBulkSMS(notifications);
  }

  /**
   * Send payment receipt to student
   */
  async sendPaymentReceipt(student: any, amount: number, transactionId?: string): Promise<SMSResponse> {
    if (!student.phone || !this.validatePhoneNumber(student.phone)) {
      throw new Error("Invalid phone number for student");
    }

    return this.sendSMS({
      phoneNumber: this.formatPhoneNumber(student.phone),
      message: this.generateWhatsAppPaymentReceipt(student, amount, transactionId),
      studentName: `${student.firstName} ${student.lastName}`
    });
  }
}

export const smsService = new SMSService();
export default smsService; 