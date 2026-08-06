import axios from 'axios';

export interface SMSNotification {
  phoneNumber: string;
  message: string;
  studentName: string;
  type?: 'payment_reminder' | 'overdue_notice' | 'receipt' | 'installment_due' | 'custom';
}

export interface SMSResponse {
  success: boolean;
  message: string;
  messageId?: string;
  status?: string;
  error?: string;
}

export interface BulkSMSResponse {
  success: boolean;
  message: string;
  results: {
    total: number;
    successful: number;
    failed: number;
    results: SMSResponse[];
    errors: string[];
  };
}

export class SMSService {
  private static apiKey = process.env.SMS_API_KEY || 'your_msg91_api_key';
  private static senderId = process.env.SMS_SENDER_ID || 'ZICAZM';
  private static baseUrl = 'https://api.msg91.com/api/v5/flow/';

  /**
   * Send a single SMS notification
   */
  static async sendSMS(notification: SMSNotification): Promise<SMSResponse> {
    try {
      console.log(`📱 Sending SMS to ${notification.phoneNumber} (${notification.studentName})`);
      
      // Validate phone number
      const formattedPhone = this.formatPhoneNumber(notification.phoneNumber);
      if (!formattedPhone) {
        throw new Error('Invalid phone number format');
      }

      // Check message length
      const messageLength = notification.message.length;
      if (messageLength > 160) {
        console.warn(`⚠️ Message length (${messageLength}) exceeds 160 characters`);
      }

      // Send SMS using MSG91 API
      const response = await this.sendViaMSG91(formattedPhone, notification.message);
      
      if (response.success) {
        console.log(`✅ SMS sent successfully to ${notification.studentName} (${formattedPhone})`);
        
        // Create notification record
        await this.createNotificationRecord({
          phoneNumber: formattedPhone,
          message: notification.message,
          studentName: notification.studentName,
          type: notification.type || 'custom',
          status: 'sent',
          messageId: response.messageId
        });
      } else {
        console.error(`❌ SMS failed for ${notification.studentName}: ${response.error}`);
      }
      
      return response;
    } catch (error) {
      console.error("Error sending SMS:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Create failed notification record
      await this.createNotificationRecord({
        phoneNumber: notification.phoneNumber,
        message: notification.message,
        studentName: notification.studentName,
        type: notification.type || 'custom',
        status: 'failed',
        error: errorMessage
      });
      
      return {
        success: false,
        message: `Failed to send SMS: ${errorMessage}`,
        error: errorMessage
      };
    }
  }

  /**
   * Send bulk SMS notifications
   */
  static async sendBulkSMS(notifications: SMSNotification[]): Promise<BulkSMSResponse> {
    const results: SMSResponse[] = [];
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    console.log(`📱 Sending bulk SMS to ${notifications.length} recipients`);

    for (const notification of notifications) {
      try {
        const result = await this.sendSMS(notification);
        results.push(result);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
          errors.push(`${notification.studentName} (${notification.phoneNumber}): ${result.error}`);
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${notification.studentName} (${notification.phoneNumber}): ${errorMessage}`);
        results.push({
          success: false,
          message: `Failed to send SMS: ${errorMessage}`,
          error: errorMessage
        });
      }
    }

    return {
      success: successful > 0,
      message: `Bulk SMS completed: ${successful} successful, ${failed} failed`,
      results: {
        total: notifications.length,
        successful,
        failed,
        results,
        errors
      }
    };
  }

  /**
   * Send SMS via MSG91 API (Optimized for Indian numbers)
   */
  private static async sendViaMSG91(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      // If no API key is configured, simulate SMS sending
      if (!this.apiKey || this.apiKey === 'your_msg91_api_key') {
        console.log('🔄 MSG91 API not configured, simulating SMS delivery...');
        return this.simulateSMSSending(phoneNumber, message);
      }

      // Format phone number for Indian numbers
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return {
          success: false,
          message: 'Invalid phone number format',
          error: 'Phone number must be 10 digits for Indian numbers'
        };
      }

      const response = await axios.post(this.baseUrl, {
        flow_id: process.env.MSG91_FLOW_ID || 'your_flow_id',
        sender: this.senderId,
        mobiles: formattedPhone,
        message: message
      }, {
        headers: {
          'Content-Type': 'application/json',
          'authkey': this.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.type === 'success') {
        console.log(`✅ MSG91 SMS sent successfully to ${formattedPhone}`);
        return {
          success: true,
          message: 'SMS sent successfully via MSG91',
          messageId: response.data.message_id || `msg_${Date.now()}`,
          status: 'delivered'
        };
      } else {
        console.error(`❌ MSG91 SMS failed: ${response.data.message}`);
        return {
          success: false,
          message: response.data.message || 'SMS sending failed',
          error: response.data.message || 'Unknown error'
        };
      }
    } catch (error) {
      console.error('MSG91 API error:', error);
      return {
        success: false,
        message: 'MSG91 service unavailable',
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Simulate SMS sending for development/testing
   */
  private static simulateSMSSending(phoneNumber: string, message: string): SMSResponse {
    // Simulate network delay
    const delay = Math.random() * 2000 + 500;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 95% success rate
        const isSuccess = Math.random() > 0.05;
        
        if (isSuccess) {
          resolve({
            success: true,
            message: 'SMS sent successfully (simulated)',
            messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'delivered'
          });
        } else {
          resolve({
            success: false,
            message: 'SMS delivery failed (simulated)',
            error: 'Simulated delivery failure'
          });
        }
      }, delay);
    });
  }

  /**
   * Format phone number for Indian numbers (MSG91 optimized)
   */
  private static formatPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Handle Indian numbers (MSG91 format)
    if (cleaned.length === 10) {
      // 10-digit Indian number: 9307190851 -> 919307190851
      return `91${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      // Already in international format: 919307190851
      return cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      // 11-digit with leading 0: 09307190851 -> 919307190851
      return `91${cleaned.substring(1)}`;
    } else if (cleaned.length === 13 && cleaned.startsWith('+91')) {
      // With + prefix: +919307190851 -> 919307190851
      return cleaned.substring(1);
    }
    
    // Invalid format for Indian numbers
    console.warn(`⚠️ Invalid phone number format: ${phone} (expected 10-digit Indian number)`);
    return null;
  }

  /**
   * Create notification record in database
   */
  private static async createNotificationRecord(data: {
    phoneNumber: string;
    message: string;
    studentName: string;
    type: string;
    status: 'sent' | 'failed';
    messageId?: string;
    error?: string;
  }) {
    try {
      // This would typically save to your database
      console.log(`📝 Creating notification record for ${data.studentName}: ${data.status}`);
      
      // You can integrate this with your existing notification system
      // await storage.createNotification({
      //   userId: 'system',
      //   title: `SMS ${data.status === 'sent' ? 'Sent' : 'Failed'}`,
      //   message: `SMS to ${data.studentName} (${data.phoneNumber})`,
      //   type: data.status === 'sent' ? 'success' : 'error',
      //   metadata: {
      //     phoneNumber: data.phoneNumber,
      //     messageId: data.messageId,
      //     smsType: data.type,
      //     error: data.error
      //   }
      // });
    } catch (error) {
      console.error('Failed to create notification record:', error);
    }
  }

  /**
   * Generate payment reminder message
   */
  static generatePaymentReminder(student: any, dueDate: Date, amount: number): string {
    const formattedDate = dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    return `Dear ${student.firstName}, your fee payment of ₹${amount.toLocaleString()} is due on ${formattedDate}. Please make the payment to avoid late fees. - ZICA ZIMA CRM`;
  }

  /**
   * Generate overdue notice message
   */
  static generateOverdueNotice(student: any, amount: number, daysOverdue: number): string {
    return `Dear ${student.firstName}, your payment of ₹${amount.toLocaleString()} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. Please make the payment immediately. - ZICA ZIMA CRM`;
  }

  /**
   * Generate installment due message
   */
  static generateInstallmentDue(student: any, amount: number): string {
    return `Dear ${student.firstName}, your installment of ₹${amount.toLocaleString()} is due today. Please make the payment. - ZICA ZIMA CRM`;
  }

  /**
   * Generate payment receipt message
   */
  static generatePaymentReceipt(student: any, amount: number, transactionId?: string): string {
    const receiptText = transactionId ? ` (TXN: ${transactionId})` : '';
    return `Dear ${student.firstName}, payment of ₹${amount.toLocaleString()} received successfully${receiptText}. Thank you! - ZICA ZIMA CRM`;
  }

  /**
   * Check SMS service status (MSG91 optimized)
   */
  static async checkStatus(): Promise<{
    configured: boolean;
    providers: string[];
    testNumber: string;
    status: 'ready' | 'not_configured' | 'error';
    message: string;
  }> {
    try {
      const isConfigured = !!(this.apiKey && this.apiKey !== 'your_msg91_api_key');
      
      return {
        configured: isConfigured,
        providers: ['MSG91 (Recommended)', 'TextLocal (Shutting Down)', 'Twilio'],
        testNumber: '9307190851',
        status: isConfigured ? 'ready' : 'not_configured',
        message: isConfigured 
          ? 'MSG91 SMS service is configured and ready for Indian numbers' 
          : 'MSG91 API not configured. Set SMS_API_KEY environment variable. Visit MSG91.com to get your API key.'
      };
    } catch (error) {
      return {
        configured: false,
        providers: ['MSG91 (Recommended)', 'TextLocal (Shutting Down)', 'Twilio'],
        testNumber: '9307190851',
        status: 'error',
        message: 'Failed to check MSG91 SMS service status'
      };
    }
  }
}

export default SMSService; 